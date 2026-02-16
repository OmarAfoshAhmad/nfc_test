import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request) {
    try {
        const body = await request.json();
        const { customer_id, campaign_id, reason } = body;

        if (!customer_id || !campaign_id) {
            return NextResponse.json({ error: 'Customer and Campaign ID required' }, { status: 400 });
        }

        // 1. Fetch Campaign Details
        const { data: campaign, error: campError } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', campaign_id)
            .single();

        if (campError || !campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        // 2. Generate Unique Code (Simple 6 char alphanumeric)
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();

        // 3. Determine Expiry
        let expires_at = null;
        if (campaign.reward_config?.validity_days) {
            const date = new Date();
            date.setDate(date.getDate() + campaign.reward_config.validity_days);
            expires_at = date.toISOString();
        }

        // 4. Create Coupon
        const { data, error } = await supabase
            .from('customer_coupons')
            .insert([{
                customer_id,
                campaign_id,
                code,
                status: 'ACTIVE',
                metadata: { reason: reason || 'Manual Grant' },
                expires_at
            }])
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Also GET to fetch coupons for a customer
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const customer_id = searchParams.get('customer_id');

    if (!customer_id) return NextResponse.json([], { status: 200 });

    const { data, error } = await supabase
        .from('customer_coupons')
        .select(`
            *,
            campaigns ( name, description, reward_config )
        `)
        .eq('customer_id', customer_id)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
}
