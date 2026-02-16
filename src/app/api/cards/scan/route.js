import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { logPoints } from '@/lib/loyalty';
import { successResponse, handleApiError } from '@/lib/errorHandler';

export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { uid } = body;

        if (!uid) return NextResponse.json({ message: 'UID is required' }, { status: 400 });

        // 1. Find Card & Customer in Supabase
        const { data: card, error: cardError } = await supabase
            .from('cards')
            .select('*, customers(full_name, points_balance, id)')
            .eq('uid', uid)
            .eq('is_active', true)
            .maybeSingle();

        if (cardError) throw cardError;

        if (!card) {
            return NextResponse.json({ success: false, message: 'Card not found or inactive' }, { status: 404 });
        }

        const customer = card.customers;

        // 2. Find Best Active Discount
        const { data: discounts, error: discError } = await supabase
            .from('discounts')
            .select('*')
            .eq('is_active', true)
            .order('value', { ascending: false })
            .limit(1);

        if (discError) throw discError;

        let appliedDiscount = null;
        if (discounts && discounts.length > 0) {
            appliedDiscount = discounts[0];
        }

        // 3. Create Transaction
        const { data: transaction, error: transError } = await supabase
            .from('transactions')
            .insert([
                {
                    customer_id: customer.id,
                    card_id: card.id,
                    discount_id: appliedDiscount ? appliedDiscount.id : null,
                    status: 'success'
                }
            ])
            .select()
            .single();

        if (transError) throw transError;

        // 4. Update points (+10 points per scan via logPoints)
        await logPoints({
            customer_id: customer.id,
            points: 10,
            reason: 'Card Scan Reward',
            transaction_id: transaction.id,
            admin_id: session.id
        });

        return successResponse({
            success: true,
            customer: {
                name: customer.full_name,
                points: (customer.points_balance || 0) + 10
            },
            discount: appliedDiscount,
            message: 'Scan successful'
        });

    } catch (error) {
        return handleApiError(error, 'POST /api/cards/scan');
    }
}
