import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { logWalletAction } from '@/lib/wallet';

export async function POST(request, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { type, target_balance = 0, cleanup_automation = true, clear_coupons = true } = body;

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

        // 2. Handle Balance Reset / Set Balance
        if (type === 'BALANCE' || type === 'ALL') {
            const currentBalance = parseFloat(customer.balance || 0);
            const target = Number.isFinite(parseFloat(target_balance)) ? Math.max(0, parseFloat(target_balance)) : 0;
            const delta = target - currentBalance;

            console.log(`[RESET] Adjusting balance from ${currentBalance} to ${target} (delta: ${delta})`);

            if (delta !== 0) {
                await logWalletAction({
                    customer_id: parseInt(id, 10),
                    amount: delta,
                    type: delta > 0 ? 'DEPOSIT' : 'WITHDRAWAL',
                    reason: `Admin balance adjustment to ${target}`,
                    admin_id: session.id
                });
            }

            // Optional automation cleanup to prevent auto-created bundles/progress after reset.
            if (cleanup_automation) {
                const { error: progressError } = await supabase
                    .from('customer_campaign_progress')
                    .delete()
                    .eq('customer_id', id);

                if (progressError) {
                    console.error('[RESET] Campaign progress cleanup error:', progressError);
                    throw progressError;
                }

                if (clear_coupons) {
                    const { error: couponError } = await supabase
                        .from('customer_coupons')
                        .update({ status: 'VOIDED' })
                        .eq('customer_id', id)
                        .in('status', ['ACTIVE', 'active', 'Active']);

                    if (couponError) {
                        console.error('[RESET] Coupon cleanup error:', couponError);
                        throw couponError;
                    }
                }
            }
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
                details: {
                    type,
                    previous_balance: customer.balance,
                    target_balance,
                    cleanup_automation,
                    clear_coupons
                },
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
