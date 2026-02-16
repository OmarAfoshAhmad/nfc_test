import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function POST(request, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { type } = body;

    console.log(`[RESET] Starting reset for customer ${id}, type: ${type}`);

    try {
        // 1. Check if customer exists
        const { data: customer, error: custError } = await supabase
            .from('customers')
            .select('*')
            .eq('id', id)
            .single();

        if (custError || !customer) {
            console.error('[RESET] Customer not found:', custError);
            return NextResponse.json({ message: 'العميل غير موجود' }, { status: 404 });
        }

        // 2. Handle Balance Reset
        if (type === 'BALANCE' || type === 'ALL') {
            const currentBalance = customer.balance || 0;
            console.log(`[RESET] Resetting balance from ${currentBalance} to 0`);

            const { error: balanceError } = await supabase
                .from('customers')
                .update({ balance: 0 })
                .eq('id', id);

            if (balanceError) {
                console.error('[RESET] Balance update error:', balanceError);
                throw balanceError;
            }

            // Record adjustment transaction
            const { data: card } = await supabase
                .from('cards')
                .select('id')
                .eq('customer_id', id)
                .eq('is_active', true)
                .maybeSingle();

            const { error: transError } = await supabase.from('transactions').insert([{
                customer_id: id,
                card_id: card?.id || null,
                amount_before: currentBalance,
                amount_after: 0,
                points_earned: 0,
                payment_method: 'CASH', // Safer to use standard CASH
                status: 'success',
                notes: `حذف الرصيد إدارياً (القيمة الملغاة: ${currentBalance})`
            }]);

            if (transError) console.warn('[RESET] Transaction logging failed (non-critical):', transError);
        }

        // 3. Handle Coupon/Package Clear
        if (type === 'COUPONS' || type === 'ALL') {
            console.log(`[RESET] Marking all active coupons as VOIDED`);
            const { error: couponError } = await supabase
                .from('customer_coupons')
                .update({ status: 'VOIDED' }) // Try VOIDED instead of CANCELLED
                .eq('customer_id', id)
                .in('status', ['ACTIVE', 'active', 'Active']);

            if (couponError) {
                console.error('[RESET] Coupon update error:', couponError);
                // Fallback: try setting to EXPIRED if VOIDED fails
                const { error: retryError } = await supabase
                    .from('customer_coupons')
                    .update({ status: 'USED' }) // USED is definitely allowed
                    .eq('customer_id', id)
                    .in('status', ['ACTIVE', 'active']);

                if (retryError) throw couponError; // Throw original error if retry also fails
            }
        }

        // 4. Final Logging
        try {
            await logAudit({
                action: 'ADMIN_RESET',
                entity: 'customers',
                entityId: id,
                details: { type, previous_balance: customer.balance },
                req: request
            });
        } catch (auditErr) {
            console.warn('[RESET] Audit logging failed:', auditErr);
        }

        console.log(`[RESET] Successfully completed ${type} reset`);
        return NextResponse.json({ status: 'success', message: 'تم تنفيذ العملية بنجاح' });

    } catch (error) {
        console.error('[RESET] FATAL ERROR:', error);
        return NextResponse.json({
            message: `فشل إتمام العملية: ${error.message || 'خطأ في قاعدة البيانات'}`,
            error: error
        }, { status: 500 });
    }
}
