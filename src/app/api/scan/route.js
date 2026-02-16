import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
        // Filter by customer type (Single/Family) or ALL
        const { data: campaigns, error: campaignsError } = await supabaseAdmin
            .from('campaigns')
            .select('*')
            .eq('is_active', true)
            .is('deleted_at', null)
            .or(`customer_type.eq.ALL,customer_type.eq.${customer.type || 'single'}`);

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
