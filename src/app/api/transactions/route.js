import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/rateLimit';
import { successResponse, handleApiError } from '@/lib/errorHandler';
import { enforceMaintenance } from '@/lib/maintenance';

export async function GET(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    // Apply rate limiting
    const rateLimit = await rateLimitMiddleware(RATE_LIMITS.READ)(request, '/api/transactions');
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { message: rateLimit.message },
            {
                status: 429,
                headers: {
                    'X-RateLimit-Limit': RATE_LIMITS.READ.maxAttempts.toString(),
                    'X-RateLimit-Remaining': rateLimit.remaining.toString(),
                    'X-RateLimit-Reset': rateLimit.resetAt.toISOString()
                }
            }
        );
    }

    const url = new URL(request.url);
    const customerId = url.searchParams.get('customer_id');

    try {
        let query = supabase
            .from('transactions')
            .select(`
                *,
                customers (full_name),
                discounts (name)
            `);

        if (customerId) {
            query = query.eq('customer_id', customerId);
        }

        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        const rows = data.map(t => ({
            ...t,
            customer_name: t.customers?.full_name || null,
            discount_name: t.metadata?.discount_name || t.discounts?.name || null,
            // Extract campaign/package info from metadata
            campaign_name: t.metadata?.campaign_name || null,
            coupon_count: t.metadata?.coupon_count || 0,
            bundle_info: t.metadata?.bundle_info || null
        }));

        return successResponse(rows);
    } catch (error) {
        return handleApiError(error, 'GET /api/transactions');
    }
}

export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    // Enforce Maintenance Mode
    const maintenance = await enforceMaintenance(session);
    if (maintenance) return maintenance;

    // Apply rate limiting
    const rateLimit = await rateLimitMiddleware(RATE_LIMITS.API)(request, '/api/transactions');
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { message: rateLimit.message },
            {
                status: 429,
                headers: {
                    'X-RateLimit-Limit': RATE_LIMITS.API.maxAttempts.toString(),
                    'X-RateLimit-Remaining': rateLimit.remaining.toString(),
                    'X-RateLimit-Reset': rateLimit.resetAt.toISOString()
                }
            }
        );
    }

    try {
        const body = await request.json();
        const {
            customer_id,
            card_id,
            discount_id, // For Instant Discounts (Admin defined)
            coupon_id,   // For Customer Coupons (Wallet)
            campaign_id, // For Bundle Purchases
            amount,
            manual_discount = 0,
            manual_discount_type = 'percentage',
            payment_method = 'CASH',
            is_topup = false
        } = body;

        // CRITICAL SECURITY FIX: Validate customer_id
        if (!customer_id || customer_id === 'undefined' || customer_id === 'null') {
            return NextResponse.json({
                message: 'Customer ID is required for this operation',
                code: 'MISSING_CUSTOMER_ID'
            }, { status: 400 });
        }

        // --- Wallet Top-up Handler ---
        if (is_topup) {
            const { topUp } = await import('@/lib/wallet');
            const newBalance = await topUp(customer_id, amount, session.id);
            const { data: updatedCust } = await supabaseAdmin.from('customers').select('*').eq('id', customer_id).single();
            return successResponse({
                status: 'success',
                message: 'Wallet recharged successfully',
                new_balance: newBalance,
                updated_customer: updatedCust
            }, 201);
        }

        let amount_after = parseFloat(amount) || 0;
        let applied_discount_name = null;

        // 1. Validate & Apply Instant Discount (Legacy/Admin)
        if (discount_id) {
            const { data: discountData, error: discountErr } = await supabase
                .from('discounts')
                .select('*')
                .eq('id', discount_id)
                .single();

            if (discountErr) throw discountErr;

            if (discountData) {
                applied_discount_name = discountData.name;
                if (discountData.type === 'percentage') {
                    amount_after = amount_after - (amount_after * (discountData.value / 100));
                } else if (discountData.type === 'fixed_amount') {
                    amount_after = amount_after - discountData.value;
                }
            }
        }
        // 1.5 Validate & Apply Coupon (New Campaign Engine)
        else if (coupon_id) {
            console.log(`[API /transactions] Attempting to use coupon: ${coupon_id} for customer: ${customer_id}`);

            const { data: coupon, error: couponErr } = await supabase
                .from('customer_coupons')
                .select('*, campaigns(*)')
                .eq('id', coupon_id)
                .eq('customer_id', customer_id) // Security check
                .eq('status', 'ACTIVE') // Validity check
                .single();

            if (couponErr || !coupon) {
                console.error('[API /transactions] Coupon fetch failed:', couponErr || 'Coupon not found/inactive');
                return NextResponse.json({
                    message: 'Coupon invalid, expired or not found',
                    details: couponErr?.message || 'Check customer_id and status'
                }, { status: 400 });
            }

            // Security Check: Enforce Expiration
            if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
                console.warn(`[API /transactions] Coupon expired: ${coupon.expires_at}`);
                // Auto-expire it in DB for cleanliness
                await supabase.from('customer_coupons').update({ status: 'EXPIRED' }).eq('id', coupon_id);
                return NextResponse.json({
                    message: 'This coupon has expired',
                    expired_at: coupon.expires_at
                }, { status: 400 });
            }

            const reward = coupon.campaigns.reward_config;
            applied_discount_name = `Coupon: ${coupon.campaigns.name}`; // Or coupon.code

            // Check if coupon has individual discount value (from split bundles)
            const individualDiscount = coupon.metadata?.discount_value;

            if (individualDiscount !== undefined && individualDiscount !== null) {
                // Use the individual part discount value
                if (reward.type === 'PERCENTAGE') {
                    amount_after = amount_after - (amount_after * (individualDiscount / 100));
                } else {
                    amount_after = amount_after - individualDiscount;
                }
                applied_discount_name += ` (${individualDiscount}%)`;
            } else if (reward.type === 'PERCENTAGE') {
                amount_after = amount_after - (amount_after * (reward.value / 100));
            } else { // FIXED
                amount_after = amount_after - reward.value;
            }
        }

        // 2. Apply Manual Discount
        const manVal = parseFloat(manual_discount) || 0;
        if (manVal > 0) {
            if (manual_discount_type === 'percentage') {
                amount_after = amount_after - (amount_after * (manVal / 100));
            } else {
                amount_after = amount_after - manVal;
            }
        }

        // 2.5 Apply Membership Discount (if no coupon or instant discount used)
        if (!discount_id && !coupon_id && manVal === 0 && customer_id) {
            const { data: cust } = await supabaseAdmin.from('customers').select('*').eq('id', customer_id).single();
            if (cust) {
                let memberDiscount = cust.discount_percent !== null
                    ? parseFloat(cust.discount_percent)
                    : (cust.type === 'family' ? 25 : 12);

                if (memberDiscount > 0) {
                    amount_after = amount_after - (amount_after * (memberDiscount / 100));
                    applied_discount_name = `خصم عضوية ${cust.type === 'family' ? 'العائلة' : 'الأفراد'} (${memberDiscount}%)`;
                    console.log(`[API /transactions] Applied Membership Discount: ${memberDiscount}%`);
                }
            }
        }

        if (amount_after < 0) amount_after = 0;

        // --- Wallet Payment Handler ---
        if (payment_method === 'WALLET') {
            const { getBalance } = await import('@/lib/wallet');
            const balance = await getBalance(customer_id);
            if (balance < amount_after) {
                return NextResponse.json({ message: 'Insufficient wallet balance' }, { status: 400 });
            }
        }

        // 3. Create Transaction
        const { data: transaction, error: transError } = await supabaseAdmin
            .from('transactions')
            .insert([
                {
                    customer_id,
                    card_id,
                    discount_id: discount_id || null, // We only store instant discount ID for now
                    amount_before: amount,
                    amount_after,
                    points_earned: 0, // Legacy: 0
                    payment_method,
                    status: 'success',
                    metadata: {
                        discount_name: applied_discount_name,
                        manual_discount_type,
                        manual_discount
                    }
                }
            ])
            .select()
            .single();

        if (transError) throw transError;
        const transaction_id = transaction.id;

        // --- Wallet Deduction ---
        if (payment_method === 'WALLET') {
            const { payWithWallet } = await import('@/lib/wallet');
            await payWithWallet(customer_id, amount_after, transaction_id, session.id);
        }

        // 4. Mark Coupon as USED (if applicable) + Reduce Bonus Bundle
        if (coupon_id) {
            // First, get the coupon details to check if it's part of a bundle split
            const { data: usedCoupon } = await supabaseAdmin
                .from('customer_coupons')
                .select('*')
                .eq('id', coupon_id)
                .single();

            const { error: updateErr } = await supabaseAdmin
                .from('customer_coupons')
                .update({ status: 'USED', used_at: new Date().toISOString() })
                .eq('id', coupon_id);

            if (updateErr) {
                console.error('CRITICAL: Failed to mark coupon as USED:', updateErr);
            }

            // NEW: If a PAID_PACKAGE split part is used, check if it's the LAST one before consuming BUNDLE_BONUS
            if (usedCoupon?.metadata?.source === 'PAID_PACKAGE' && usedCoupon?.metadata?.transaction_id) {
                const originalTransactionId = usedCoupon.metadata.transaction_id;
                const bundleId = usedCoupon.metadata.bundle_id;

                // Check for other ACTIVE PAID_PACKAGE parts in the SAME bundle
                const { data: otherParts } = await supabaseAdmin
                    .from('customer_coupons')
                    .select('id')
                    .eq('customer_id', customer_id)
                    .eq('status', 'ACTIVE')
                    .eq('metadata->>bundle_id', bundleId)
                    .eq('metadata->>source', 'PAID_PACKAGE') // Filter only for paid parts
                    .neq('id', coupon_id);

                if (!otherParts || otherParts.length === 0) {
                    // Last part used - consume bonus COMPLETELY
                    const { data: bonusCoupon } = await supabaseAdmin
                        .from('customer_coupons')
                        .select('id, metadata')
                        .eq('customer_id', customer_id)
                        .eq('status', 'ACTIVE')
                        .eq('metadata->>source', 'BUNDLE_BONUS')
                        .eq('metadata->>bundle_id', bundleId)
                        .maybeSingle();

                    if (bonusCoupon) {
                        await supabaseAdmin
                            .from('customer_coupons')
                            .update({
                                status: 'USED',
                                used_at: new Date().toISOString(),
                                metadata: {
                                    ...bonusCoupon.metadata,
                                    consumed_with_last_part: true,
                                    final_value_at_consumption: 0,
                                    consumed_at: new Date().toISOString(),
                                    trigger_coupon_id: coupon_id
                                }
                            })
                            .eq('id', bonusCoupon.id);
                        console.log(`[BUNDLE] Correctly Zeroed: Last part used - auto-consumed bonus for bundle ${bundleId}`);
                    }
                } else {
                    // Reduce bonus value
                    const usedDiscount = usedCoupon.metadata?.discount_value || 0;
                    const { data: bonusCoupon } = await supabaseAdmin
                        .from('customer_coupons')
                        .select('*')
                        .eq('customer_id', customer_id)
                        .eq('status', 'ACTIVE')
                        .eq('metadata->>source', 'BUNDLE_BONUS')
                        .eq('metadata->>bundle_id', bundleId)
                        .maybeSingle();

                    if (bonusCoupon && usedDiscount > 0) {
                        const currentBonusVal = bonusCoupon.metadata?.discount_value || 0;
                        const newBonusVal = Math.max(0, currentBonusVal - usedDiscount);
                        await supabaseAdmin
                            .from('customer_coupons')
                            .update({
                                metadata: {
                                    ...bonusCoupon.metadata,
                                    discount_value: newBonusVal,
                                    last_reduced_by: usedDiscount,
                                    last_reduction_at: new Date().toISOString()
                                }
                            })
                            .eq('id', bonusCoupon.id);
                        console.log(`[BUNDLE] Reduced bonus from ${currentBonusVal} to ${newBonusVal}`);
                    }
                }
            }
            // NEW: If BUNDLE_BONUS is used, mark all related split coupons as USED
            else if (usedCoupon?.metadata?.source === 'BUNDLE_BONUS' && usedCoupon?.metadata?.transaction_id) {
                const originalTransactionId = usedCoupon.metadata.transaction_id;
                const { data: splitCoupons } = await supabaseAdmin
                    .from('customer_coupons')
                    .select('id')
                    .eq('customer_id', customer_id)
                    .eq('status', 'ACTIVE')
                    .eq('metadata->>source', 'PAID_PACKAGE')
                    .eq('metadata->>transaction_id', originalTransactionId);

                if (splitCoupons && splitCoupons.length > 0) {
                    const splitIds = splitCoupons.map(c => c.id);
                    await supabaseAdmin
                        .from('customer_coupons')
                        .update({
                            status: 'USED',
                            used_at: new Date().toISOString(),
                            metadata: { consumed_with_bonus: true, consumed_at: new Date().toISOString() }
                        })
                        .in('id', splitIds);
                    console.log(`[BUNDLE] Bonus used - marked ${splitCoupons.length} parts as USED`);
                }
            }
        }

        // 5. Campaign Engine: Check for AUTO_SPEND Rewards
        let new_rewards = [];

        // NEW: Check if we used a coupon for this transaction
        const isCouponUse = !!coupon_id;

        try {
            // A. Explicit Bundle Purchase (if campaign_id provided)
            if (campaign_id) {
                const { data: targetCampaign } = await supabase
                    .from('campaigns')
                    .select('*')
                    .eq('id', campaign_id)
                    .single();

                if (targetCampaign && targetCampaign.type === 'BUNDLE') {
                    // ✅ OWNERSHIP CHECK: Prevent duplicate active bundles
                    const { data: existingBundle } = await supabaseAdmin
                        .from('customer_coupons')
                        .select('id')
                        .eq('customer_id', customer_id)
                        .eq('campaign_id', campaign_id)
                        .eq('status', 'ACTIVE')
                        .limit(1)
                        .maybeSingle();

                    if (existingBundle) {
                        return NextResponse.json({
                            message: 'العميل يمتلك هذه الباقة بالفعل وهي لا تزال نشطة. لا يمكن تفعيلها مرتين في نفس الوقت.',
                            code: 'ALREADY_OWNED'
                        }, { status: 400 });
                    }

                    // Logic: Split bundle discount based on bundle_type or campaign name
                    const totalDiscount = targetCampaign.reward_config?.value || 10;
                    const bundleType = targetCampaign.bundle_type || '';
                    const campaignName = targetCampaign.name || '';
                    const customSplits = targetCampaign.reward_config?.splits || null;

                    // Define fixed split configurations for each bundle type
                    const getBundleSplitConfig = (type, name, total, dynSplits) => {
                        // HIGH PRIORITY: Use dynamic splits from database if defined
                        if (dynSplits && Array.isArray(dynSplits) && dynSplits.length > 0) {
                            return { splits: dynSplits, bonusBundle: total, label: name };
                        }

                        // First check explicit bundle_type from database
                        if (type === 'family') {
                            return { splits: [3, 5, 7, 10], bonusBundle: 25, label: 'عائلة' };
                        }
                        if (type === 'meat_family') {
                            return { splits: [2, 2, 3, 3], bonusBundle: 10, label: 'لحمة عائلة' };
                        }
                        if (type === 'youth') {
                            return { splits: [2, 4, 3, 3], bonusBundle: 12, label: 'شباب' };
                        }
                        if (type === 'meat_individual') {
                            return { splits: [2.5, 2.5], bonusBundle: 5, label: 'لحمة أفراد' };
                        }
                        if (type === 'individual') {
                            return { splits: [3, 3, 3, 3], bonusBundle: 12, label: 'أفراد' };
                        }

                        // Fallback: analyze campaign name for backward compatibility
                        const lowerName = (name || '').toLowerCase();
                        if (lowerName.includes('عائل') && !lowerName.includes('لحم')) {
                            return { splits: [3, 5, 7, 10], bonusBundle: 25, label: 'عائلة' };
                        }
                        if (lowerName.includes('لحم') && lowerName.includes('عائل')) {
                            return { splits: [2, 2, 3, 3], bonusBundle: 10, label: 'لحمة عائلة' };
                        }
                        if (lowerName.includes('شباب')) {
                            return { splits: [2, 4, 3, 3], bonusBundle: 12, label: 'شباب' };
                        }
                        if (lowerName.includes('لحم') && (lowerName.includes('افراد') || lowerName.includes('أفراد') || lowerName.includes('فرد'))) {
                            return { splits: [2.5, 2.5], bonusBundle: 5, label: 'لحمة أفراد' };
                        }
                        if (lowerName.includes('افراد') || lowerName.includes('أفراد') || lowerName.includes('فرد')) {
                            return { splits: [3, 3, 3, 3], bonusBundle: 12, label: 'أفراد' };
                        }

                        // Default: Split total into 4 equal parts + bonus bundle
                        const part = Math.round((total / 4) * 10) / 10;
                        return { splits: [part, part, part, part], bonusBundle: total, label: 'افتراضي' };
                    };

                    const splitConfig = getBundleSplitConfig(bundleType, campaignName, totalDiscount, customSplits);
                    const { splits, bonusBundle, label } = splitConfig;
                    console.log(`[BUNDLE] ${label}: Creating ${splits.length} coupons:`, splits, `+ bonus ${bonusBundle}%`);

                    let expires_at = null;
                    if (targetCampaign.validity_days) {
                        const d = new Date();
                        d.setDate(d.getDate() + targetCampaign.validity_days);
                        expires_at = d.toISOString();
                    }

                    // Create split coupons
                    const bundle_id = `BNDL-${Date.now()}`;
                    const items_total_count = splits.length;

                    const couponsToInsert = splits.map((discountValue, index) => ({
                        customer_id,
                        campaign_id: targetCampaign.id,
                        code: `PKG-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                        status: 'ACTIVE',
                        metadata: {
                            source: 'PAID_PACKAGE',
                            transaction_id,
                            bundle_id,
                            part: index + 1,
                            total_parts: items_total_count,
                            discount_value: discountValue,
                            original_total: totalDiscount,
                            bundle_type: label
                        },
                        expires_at
                    }));

                    // Add the bonus bundle coupon (full percentage)
                    couponsToInsert.push({
                        customer_id,
                        campaign_id: targetCampaign.id,
                        code: `BNS-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                        status: 'ACTIVE',
                        metadata: {
                            source: 'BUNDLE_BONUS',
                            transaction_id,
                            bundle_id,
                            part: 'BONUS',
                            total_parts: items_total_count,
                            discount_value: bonusBundle,
                            original_total: totalDiscount,
                            bundle_type: label
                        },
                        expires_at
                    });

                    if (couponsToInsert.length > 0) {
                        const { error: insErr } = await supabaseAdmin.from('customer_coupons').insert(couponsToInsert);
                        if (insErr) {
                            console.error('CRITICAL: Coupon Insertion Failed:', insErr);
                            throw new Error(`Failed to create package coupons: ${insErr.message}`);
                        }

                        // Update transaction metadata with bundle info for display in logs
                        await supabaseAdmin
                            .from('transactions')
                            .update({
                                metadata: {
                                    ...transaction.metadata,
                                    campaign_name: targetCampaign.name,
                                    coupon_count: splits.length + 1, // splits + bonus
                                    bundle_info: `${label}: ${splits.join('% + ')}% + ${bonusBundle}% بونص`
                                }
                            })
                            .eq('id', transaction_id);

                        new_rewards.push({
                            name: `${targetCampaign.name} (${splits.length} كوبونات + باقة ${bonusBundle}%)`,
                            type: 'BUNDLE',
                            parts: [...splits, bonusBundle]
                        });
                    }
                }
            }

            // B. Auto-Spend Rewards (Logic remains same)
            const { data: campaigns } = await supabase
                .from('campaigns')
                .select('*')
                .eq('type', 'AUTO_SPEND')
                .eq('is_active', true);

            if (campaigns && campaigns.length > 0) {
                for (const camp of campaigns) {
                    const minSpend = camp.trigger_condition?.min_spend || 0;
                    // Only grant if amount_after (final paid) > minSpend
                    if (amount_after >= minSpend) {
                        // Create Coupon
                        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                        let expires_at = null;
                        if (camp.reward_config?.validity_days) {
                            const d = new Date();
                            d.setDate(d.getDate() + camp.reward_config.validity_days);
                            expires_at = d.toISOString();
                        }

                        const { data: newCoupon } = await supabase
                            .from('customer_coupons')
                            .insert({
                                customer_id,
                                campaign_id: camp.id,
                                code,
                                status: 'ACTIVE',
                                metadata: { source: 'AUTO_REWARD', transaction_id },
                                expires_at
                            })
                            .select()
                            .single();

                        if (newCoupon) new_rewards.push({ name: camp.name, type: camp.reward_config.type });
                    }
                }
            }

            // C. Stamp Card Progress (Only check if NOT an explicit package purchase)
            if (!campaign_id && !isCouponUse) {
                const { data: bundleCampaigns } = await supabase
                    .from('campaigns')
                    .select('*')
                    .eq('type', 'BUNDLE')
                    .eq('is_active', true);

                if (bundleCampaigns && bundleCampaigns.length > 0) {
                    for (const bundle of bundleCampaigns) {
                        // Check only Stamp Cards (Price 0 or low?) or Fallback Price Match
                        const isPaidPackage = bundle.price > 0;
                        if (isPaidPackage) {
                            if (Math.abs(amount_after - bundle.price) < 0.01) {
                                // Fallback: Price Match logic
                                const usageLimit = bundle.usage_limit || 1;
                                let expires_at = null;
                                if (bundle.validity_days) {
                                    const d = new Date();
                                    d.setDate(d.getDate() + bundle.validity_days);
                                    expires_at = d.toISOString();
                                }
                                const couponsToInsert = [];
                                for (let i = 0; i < usageLimit; i++) {
                                    couponsToInsert.push({
                                        customer_id,
                                        campaign_id: bundle.id,
                                        code: `PKG-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                                        status: 'ACTIVE',
                                        metadata: { source: 'PAID_PACKAGE_FALLBACK', transaction_id },
                                        expires_at
                                    });
                                }
                                if (couponsToInsert.length > 0) {
                                    await supabase.from('customer_coupons').insert(couponsToInsert);
                                    new_rewards.push({ name: `Package Purchased: ${bundle.name}`, type: 'BUNDLE' });
                                }
                            }
                        } else {
                            // Stamp Card Logic
                            const targetCount = bundle.trigger_condition?.target_count || 5;
                            const { data: progress } = await supabase.from('customer_campaign_progress').select('*').eq('customer_id', customer_id).eq('campaign_id', bundle.id).single();
                            let currentCount = progress ? progress.current_count + 1 : 1;
                            if (currentCount >= targetCount) {
                                // Grant Reward
                                const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                                let expires_at = null;
                                if (bundle.reward_config?.validity_days) {
                                    const d = new Date();
                                    d.setDate(d.getDate() + bundle.reward_config.validity_days);
                                    expires_at = d.toISOString();
                                }
                                await supabase.from('customer_coupons').insert({
                                    customer_id, campaign_id: bundle.id, code, status: 'ACTIVE', metadata: { source: 'BUNDLE_REWARD', transaction_id }, expires_at
                                });
                                new_rewards.push({ name: bundle.name + ' (Completed!)', type: bundle.reward_config.type });
                                currentCount = 0;
                            }
                            if (progress) { await supabase.from('customer_campaign_progress').update({ current_count: currentCount, updated_at: new Date() }).eq('id', progress.id); }
                            else { await supabase.from('customer_campaign_progress').insert({ customer_id, campaign_id: bundle.id, current_count: currentCount, target_count: targetCount }); }
                        }
                    }
                }
            }

        } catch (e) {
            console.error('Campaign Engine Error:', e);
            if (campaign_id) throw e;
        }

        const { data: updatedCustomer } = await supabase
            .from('customers')
            .select('balance')
            .eq('id', customer_id)
            .single();

        return successResponse({
            status: 'success',
            transaction_id,
            amount_after,
            new_rewards, // Return this so UI can show "You earned a coupon!"
            updated_customer: updatedCustomer || null
        }, 201);

    } catch (error) {
        return handleApiError(error, 'POST /api/transactions');
    }
}

export async function DELETE(request) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Enforce Maintenance Mode
    const maintenance = await enforceMaintenance(session);
    if (maintenance) return maintenance;

    try {
        const { error } = await supabase.from('transactions').delete().neq('id', 0); // Delete all
        if (error) throw error;
        return successResponse({ message: 'Audit trail cleared' });
    } catch (error) {
        return handleApiError(error, 'DELETE /api/transactions');
    }
}

