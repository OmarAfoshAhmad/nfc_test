import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getSession();
        if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // 1. Fetch Transactions for the last 14 days (Current week + Previous week)
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const { data: transactions, error: txError } = await supabase
            .from('transactions')
            .select('*')
            .eq('status', 'success')
            .gte('created_at', fourteenDaysAgo.toISOString());

        if (txError) throw txError;

        // 2. Fetch Wallet Top-ups
        const { data: topups, error: topupError } = await supabase
            .from('balance_ledger')
            .select('amount, created_at')
            .eq('type', 'DEPOSIT')
            .gte('created_at', fourteenDaysAgo.toISOString());

        if (topupError) throw topupError;

        // 3. Aggregate Stats (Separating Current vs Previous Week)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoISO = sevenDaysAgo.toISOString();

        let currentTotalRevenue = 0;
        let prevTotalRevenue = 0;
        let totalCash = 0;
        let totalWalletSpend = 0;
        let totalSavings = 0;
        let totalTopups = 0;
        const packageUsage = {};

        transactions.forEach(tx => {
            const amount_after = parseFloat(tx.amount_after) || 0;
            const amount_before = parseFloat(tx.amount_before) || 0;
            const isCurrentWeek = tx.created_at >= sevenDaysAgoISO;

            if (isCurrentWeek) {
                if (tx.payment_method === 'CASH') totalCash += amount_after;
                else if (tx.payment_method === 'WALLET') totalWalletSpend += amount_after;

                currentTotalRevenue += amount_after;
                totalSavings += (amount_before - amount_after);

                const pkgName = tx.metadata?.discount_name || 'Generic Purchase';
                packageUsage[pkgName] = (packageUsage[pkgName] || 0) + 1;
            } else {
                prevTotalRevenue += amount_after;
            }
        });

        topups.forEach(t => {
            if (t.created_at >= sevenDaysAgoISO) {
                totalTopups += (parseFloat(t.amount) || 0);
            }
        });

        // 4. Calculate Growth
        let growthPercent = 0;
        if (prevTotalRevenue > 0) {
            growthPercent = ((currentTotalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100;
        } else if (currentTotalRevenue > 0) {
            growthPercent = 100; // First time growth
        }

        // 5. Daily Chart Data (Targeting last 7 days)
        const days = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            days[d.toISOString().split('T')[0]] = { cash: 0, wallet: 0 };
        }

        transactions.forEach(tx => {
            if (tx.created_at >= sevenDaysAgoISO) {
                const dateStr = tx.created_at.split('T')[0];
                if (days[dateStr]) {
                    const val = parseFloat(tx.amount_after) || 0;
                    if (tx.payment_method === 'CASH') days[dateStr].cash += val;
                    else days[dateStr].wallet += val;
                }
            }
        });

        const chartData = Object.entries(days).map(([date, vals]) => ({
            date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
            fullDate: date,
            cash: vals.cash,
            wallet: vals.wallet,
            total: vals.cash + vals.wallet
        }));

        const topPackages = Object.entries(packageUsage)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return NextResponse.json({
            data: {
                totalCash,
                totalWalletSpend,
                totalTopups,
                totalSavings,
                chartData,
                topPackages,
                walletRetention: totalTopups - totalWalletSpend,
                growth_percentage: growthPercent.toFixed(1),
                is_positive_growth: growthPercent >= 0
            }
        });

    } catch (error) {
        console.error('Finance Hub API Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
