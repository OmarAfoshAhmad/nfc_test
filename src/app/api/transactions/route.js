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
            const { data: coupon, error: couponErr } = await supabase
                .from('customer_coupons')
                .select('*, campaigns(*)')
                .eq('id', coupon_id)
                .eq('customer_id', customer_id) // Security check
                .eq('status', 'ACTIVE') // Validity check
                .single();

            if (couponErr || !coupon) {
                return NextResponse.json({ message: 'Coupon invalid, expired or not found' }, { status: 400 });
            }

            // Security Check: Enforce Expiration
            if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
                // Auto-expire it in DB for cleanliness
                await supabase.from('customer_coupons').update({ status: 'EXPIRED' }).eq('id', coupon_id);
                return NextResponse.json({ message: 'This coupon has expired' }, { status: 400 });
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

            // NEW: If this coupon is from a bundle split (PAID_PACKAGE), reduce the bonus bundle
            if (usedCoupon?.metadata?.source === 'PAID_PACKAGE' && usedCoupon?.metadata?.transaction_id) {
                const usedDiscountValue = usedCoupon.metadata.discount_value || 0;
                const originalTransactionId = usedCoupon.metadata.transaction_id;

                // Find the related BUNDLE_BONUS coupon from the same purchase
                const { data: bonusCoupon } = await supabaseAdmin
                    .from('customer_coupons')
                    .select('*')
                    .eq('customer_id', customer_id)
                    .eq('status', 'ACTIVE')
                    .eq('metadata->>source', 'BUNDLE_BONUS')
                    .eq('metadata->>transaction_id', originalTransactionId)
                    .single();

                if (bonusCoupon && bonusCoupon.metadata?.discount_value > 0) {
                    const currentBonusValue = bonusCoupon.metadata.discount_value;
                    const newBonusValue = Math.max(0, currentBonusValue - usedDiscountValue);

                    console.log(`[BUNDLE] Reducing bonus from ${currentBonusValue}% to ${newBonusValue}% (used ${usedDiscountValue}%)`);

                    if (newBonusValue > 0) {
                        // Update the bonus coupon with reduced value
                        await supabaseAdmin
                            .from('customer_coupons')
                            .update({
                                metadata: {
                                    ...bonusCoupon.metadata,
                                    discount_value: newBonusValue,
                                    original_bonus: currentBonusValue,
                                    reductions: [...(bonusCoupon.metadata.reductions || []), {
                                        used_coupon_id: coupon_id,
                                        reduced_by: usedDiscountValue,
                                        at: new Date().toISOString()
                                    }]
                                }
                            })
                            .eq('id', bonusCoupon.id);
                    } else {
                        // Bonus fully consumed - mark as USED
                        await supabaseAdmin
                            .from('customer_coupons')
                            .update({
                                status: 'USED',
                                used_at: new Date().toISOString(),
                                metadata: {
                                    ...bonusCoupon.metadata,
                                    discount_value: 0,
                                    fully_consumed: true
                                }
                            })
                            .eq('id', bonusCoupon.id);

                        console.log(`[BUNDLE] Bonus coupon fully consumed and marked as USED`);
                    }
                }
            }
            // NEW: If BUNDLE_BONUS is used, delete all related split coupons (PAID_PACKAGE)
            else if (usedCoupon?.metadata?.source === 'BUNDLE_BONUS' && usedCoupon?.metadata?.transaction_id) {
                const originalTransactionId = usedCoupon.metadata.transaction_id;

                // Find and mark all related split coupons as USED
                const { data: splitCoupons, error: splitErr } = await supabaseAdmin
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
                            metadata: {
                                consumed_with_bonus: true,
                                consumed_at: new Date().toISOString()
                            }
                        })
                        .in('id', splitIds);

                    console.log(`[BUNDLE] Full bonus used - marked ${splitCoupons.length} split coupons as USED`);
                }
            }
        }

        // 5. Campaign Engine: Check for AUTO_SPEND Rewards
        let new_rewards = [];
        try {
            // A. Explicit Bundle Purchase (if campaign_id provided)
            if (campaign_id) {
                const { data: targetCampaign } = await supabase
                    .from('campaigns')
                    .select('*')
                    .eq('id', campaign_id)
                    .single();

                if (targetCampaign && targetCampaign.type === 'BUNDLE') {
                    // Logic: Split bundle discount based on bundle_type or campaign name
                    const totalDiscount = targetCampaign.reward_config?.value || 10;
                    const bundleType = targetCampaign.bundle_type || '';
                    const campaignName = (targetCampaign.name || '').toLowerCase();

                    // Define fixed split configurations for each bundle type
                    const getBundleSplitConfig = (type, name, total) => {
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
                            return { splits: [2, 2, 3, 3], bonusBundle: 10, label: 'أفراد' };
                        }

                        // Fallback: analyze campaign name for backward compatibility
                        if (name.includes('عائل') && !name.includes('لحم')) {
                            return { splits: [3, 5, 7, 10], bonusBundle: 25, label: 'عائلة' };
                        }
                        if (name.includes('لحم') && name.includes('عائل')) {
                            return { splits: [2, 2, 3, 3], bonusBundle: 10, label: 'لحمة عائلة' };
                        }
                        if (name.includes('شباب')) {
                            return { splits: [2, 4, 3, 3], bonusBundle: 12, label: 'شباب' };
                        }
                        if (name.includes('لحم') && (name.includes('افراد') || name.includes('أفراد') || name.includes('فرد'))) {
                            return { splits: [2.5, 2.5], bonusBundle: 5, label: 'لحمة أفراد' };
                        }
                        if (name.includes('افراد') || name.includes('أفراد') || name.includes('فرد')) {
                            return { splits: [2, 2, 3, 3], bonusBundle: 10, label: 'أفراد' };
                        }

                        // Default: Split total into 4 equal parts + bonus bundle
                        const part = Math.round((total / 4) * 10) / 10;
                        return { splits: [part, part, part, part], bonusBundle: total, label: 'افتراضي' };
                    };

                    const splitConfig = getBundleSplitConfig(bundleType, campaignName, totalDiscount);
                    console.log(`[BUNDLE] ${splitConfig.label}: Creating ${splitConfig.splits.length} coupons:`, splitConfig.splits, `+ bonus ${splitConfig.bonusBundle}%`);

                    let expires_at = null;
                    if (targetCampaign.validity_days) {
                        const d = new Date();
                        d.setDate(d.getDate() + targetCampaign.validity_days);
                        expires_at = d.toISOString();
                    }

                    // Create split coupons
                    const couponsToInsert = splitConfig.splits.map((discountValue, index) => ({
                        customer_id,
                        campaign_id: targetCampaign.id,
                        code: `PKG-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                        status: 'ACTIVE',
                        metadata: {
                            source: 'PAID_PACKAGE',
                            transaction_id,
                            part: index + 1,
                            discount_value: discountValue,
                            original_total: totalDiscount,
                            bundle_type: splitConfig.label
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
                            part: 'BONUS',
                            discount_value: splitConfig.bonusBundle,
                            original_total: totalDiscount,
                            bundle_type: splitConfig.label
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
                                    coupon_count: splitConfig.splits.length + 1, // splits + bonus
                                    bundle_info: `${splitConfig.label}: ${splitConfig.splits.join('% + ')}% + ${splitConfig.bonusBundle}% بونص`
                                }
                            })
                            .eq('id', transaction_id);

                        new_rewards.push({
                            name: `${targetCampaign.name} (${splitConfig.splits.length} كوبونات + باقة ${splitConfig.bonusBundle}%)`,
                            type: 'BUNDLE',
                            parts: [...splitConfig.splits, splitConfig.bonusBundle]
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
            // If campaign_id was passed, we assume it was a paid package, so we might skip this OR let it run in parallel?
            // Usually buying a package shouldn't ALSO give you a stamp unless configured. 
            // Let's keep existing "Price Match" logic as fallback if campaign_id missing, OR for Step C.

            if (!campaign_id) {
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
                                // Fallback: Price Match logic (same as before) for backward compat
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
                            // ... (Rest of logic is fine, can be preserved or parallelized)
                            // Increment progress
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
            // If it was an explicit bundle purchase, we SHOULD fail the transaction or at least notify
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

