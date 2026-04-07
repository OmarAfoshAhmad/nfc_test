import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { logWalletAction } from '@/lib/wallet';

function getMonthBounds(year, month) {
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    return { start, end };
}

export async function POST(request, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    try {
        const body = await request.json().catch(() => ({}));

        const now = new Date();
        const year = Number.isInteger(Number(body?.year)) ? Number(body.year) : now.getUTCFullYear();
        const month = Number.isInteger(Number(body?.month)) ? Number(body.month) : now.getUTCMonth() + 1;

        if (month < 1 || month > 12) {
            return NextResponse.json({ message: 'Invalid month. Expected 1..12' }, { status: 400 });
        }

        const depositToWallet = body?.deposit_to_wallet !== false;
        const { start, end } = getMonthBounds(year, month);

        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('id, amount_before, amount_after, status, created_at')
            .eq('customer_id', id)
            .eq('status', 'success')
            .gte('created_at', start.toISOString())
            .lt('created_at', end.toISOString());

        if (error) throw error;

        const rows = transactions || [];
        const purchasesCount = rows.length;

        let totalDiscount = 0;
        for (const tx of rows) {
            const before = parseFloat(tx.amount_before || 0);
            const after = parseFloat(tx.amount_after || 0);
            const delta = Math.max(0, before - after);
            totalDiscount += delta;
        }

        totalDiscount = Math.round(totalDiscount * 100) / 100;

        let newBalance = null;
        if (depositToWallet && totalDiscount > 0) {
            newBalance = await logWalletAction({
                customer_id: parseInt(id, 10),
                amount: totalDiscount,
                type: 'DEPOSIT',
                reason: `Monthly discount settlement ${year}-${String(month).padStart(2, '0')}`,
                admin_id: session.id
            });
        }

        try {
            await logAudit({
                action: 'MONTHLY_SETTLEMENT',
                entity: 'customers',
                entityId: id,
                details: {
                    year,
                    month,
                    purchases_count: purchasesCount,
                    total_discount: totalDiscount,
                    deposited_to_wallet: depositToWallet,
                    new_balance: newBalance
                },
                req: request
            });
        } catch (auditErr) {
            console.warn('[MONTHLY_SETTLEMENT] Audit logging failed:', auditErr);
        }

        return NextResponse.json({
            status: 'success',
            customer_id: Number(id),
            period: {
                year,
                month,
                from: start.toISOString(),
                to: end.toISOString()
            },
            purchases_count: purchasesCount,
            total_discount: totalDiscount,
            deposited_to_wallet: depositToWallet && totalDiscount > 0,
            new_balance: newBalance
        });
    } catch (error) {
        return NextResponse.json({
            message: error?.message || 'Monthly settlement failed'
        }, { status: 500 });
    }
}
