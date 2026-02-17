import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
    try {
        const body = await request.json();
        const { uid } = body;

        if (!uid) {
            return NextResponse.json({
                status: 'error',
                error: 'Card UID is required'
            }, { status: 400 });
        }

        console.log(`[API /scan] Processing card UID: ${uid}`);

        // 1. Look up the card in the database
        const { data: card, error: cardError } = await supabaseAdmin
            .from('cards')
            .select('*')
            .eq('uid', uid)
            .eq('is_active', true)
            .is('deleted_at', null)
            .maybeSingle();

        if (cardError) {
            console.error('[API /scan] Database error:', cardError);
            return NextResponse.json({
                status: 'error',
                error: 'Database error'
            }, { status: 500 });
        }

        // 2. Handle unknown card
        if (!card) {
            console.log(`[API /scan] Unknown card: ${uid}`);
            return NextResponse.json({
                status: 'unknown_card',
                message: 'Card not found in system',
                card: { uid }
            });
        }

        // 3. Check if card is signed/secured
        const metadata = typeof card.metadata === 'string'
            ? JSON.parse(card.metadata)
            : (card.metadata || {});

        if (!metadata.secured) {
            console.log(`[API /scan] Unsupported card (not signed): ${uid}`);
            return NextResponse.json({
                status: 'unsupported_card',
                message: 'This card is not supported',
                card: { uid }
            });
        }

        // 4. Check if card is expired
        if (card.expires_at) {
            const expiryDate = new Date(card.expires_at);
            const now = new Date();
            if (expiryDate < now) {
                console.log(`[API /scan] Expired card: ${uid}`);
                return NextResponse.json({
                    status: 'expired',
                    message: 'Card has expired',
                    card,
                    customer: null
                });
            }
        }

        // 5. Get customer details
        let customer = null;
        if (card.customer_id) {
            const { data: custData, error: customerError } = await supabaseAdmin
                .from('customers')
                .select('*')
                .eq('id', card.customer_id)
                .maybeSingle();
            customer = custData;
        }

        if (!customer && card.customer_id) {
            console.warn('[API /scan] Customer ID exists but customer not found for card:', uid);
        }

        // Check if customer is required for the specific scan page logic
        // But the API itself should return the card status
        const isLinked = !!customer;

        const now = new Date().toISOString();

        // 6. Active Coupons (Include those with NO expiration date)
        const { data: coupons, error: couponsError } = await supabaseAdmin
            .from('customer_coupons')
            .select('*, campaigns(*)')
            .or(`status.eq.ACTIVE,status.eq.active`)
            .or(`expires_at.is.null,expires_at.gt.${now}`);

        // 7. Get available campaigns filtered by customer type
        const { data: campaigns, error: campaignsError } = await supabaseAdmin
            .from('campaigns')
            .select('*')
            .eq('is_active', true)
            .is('deleted_at', null)
            .eq('customer_type', customer?.type || 'single');

        // 8. Return success response
        console.log(`[API /scan] Scan successful for UID: ${uid}${customer ? `, Customer: ${customer.full_name}` : ' (Unlinked)'}`);
        return NextResponse.json({
            status: 'success',
            card,
            customer,
            coupons: coupons || [],
            availableBundles: campaigns || [],
            customerType: customer?.type || 'single',
            isLinked
        });

    } catch (error) {
        console.error('[API /scan] Fatal error:', error);
        return NextResponse.json({
            status: 'error',
            error: 'Internal server error',
            message: error.message
        }, { status: 500 });
    }
}

// Keep GET handler for backward compatibility if needed
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const customer_id = searchParams.get('customer_id');

    if (!customer_id) {
        return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    try {
        // 1. Get Customer details
        const { data: customer, error: customerError } = await supabaseAdmin
            .from('customers')
            .select('*')
            .eq('id', customer_id)
            .single();

        if (customerError || !customer) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        // 2. Get Active Quotas (Coupons)
        const { data: activeQuotas, error: quotasError } = await supabaseAdmin
            .from('customer_coupons')
            .select('*')
            .eq('customer_id', customer_id)
            .eq('status', 'ACTIVE');

        // 3. Get Available Campaigns/Bundles
        // Filter by customer type (Single/Family)
        const { data: campaigns, error: campaignsError } = await supabaseAdmin
            .from('campaigns')
            .select('*')
            .eq('is_active', true)
            .is('deleted_at', null)
            .eq('customer_type', customer?.type || 'single');

        return NextResponse.json({
            customer,
            activeQuotas: activeQuotas || [],
            availableCampaigns: campaigns || []
        });

    } catch (error) {
        console.error('Scan API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
