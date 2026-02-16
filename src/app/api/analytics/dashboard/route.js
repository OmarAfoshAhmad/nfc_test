import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Check Authentication
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // 2. Fetch Aggregated Stats
        let stats;
        try {
            const { data, error: rpcError } = await supabase.rpc('get_dashboard_stats');
            if (rpcError) throw rpcError;

            // Format RPC data for frontend
            stats = {
                ...data,
                chartData: (data.chartData || []).map(day => ({
                    date: new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }),
                    fullDate: day.date,
                    count: parseInt(day.count)
                }))
            };

            // Fetch discounts data even if RPC succeeded (RPC might not have it)
            if (!stats.discountsChartData) {
                const { data: discountsData } = await supabaseAdmin.from('transactions')
                    .select('created_at, amount_before, amount_after')
                    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

                const discountDays = {};
                for (let i = 6; i >= 0; i--) {
                    const d = new Date(); d.setDate(d.getDate() - i);
                    const dateKey = d.toISOString().split('T')[0];
                    discountDays[dateKey] = { count: 0, total: 0 };
                }

                (discountsData || []).forEach(row => {
                    const dateStr = row.created_at.split('T')[0];
                    if (discountDays[dateStr] !== undefined) {
                        const discountAmount = (row.amount_before || 0) - (row.amount_after || 0);
                        if (discountAmount > 0) {
                            discountDays[dateStr].count++;
                            discountDays[dateStr].total += discountAmount;
                        }
                    }
                });

                stats.discountsChartData = Object.entries(discountDays).map(([date, dayData]) => ({
                    date: new Date(date).toLocaleDateString('ar-EG', { weekday: 'short' }),
                    fullDate: date,
                    count: dayData.count,
                    total: Math.round(dayData.total * 100) / 100
                }));
            }
        } catch (err) {
            console.warn('RPC get_dashboard_stats failed or not found, using legacy fallback logic.', err.message);

            const [
                { count: totalCustomers, error: customersError },
                { count: totalPackages, error: packagesError },
                { count: totalTransactions, error: txError },
                { data: recentActivity, error: activityError },
                { data: chartData, error: chartError },
                { data: discountsData, error: discountsError }
            ] = await Promise.all([
                supabase.from('customers').select('*', { count: 'exact', head: true }),
                supabase.from('customer_coupons')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'ACTIVE')
                    .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`),
                supabaseAdmin.from('transactions').select('*', { count: 'exact', head: true }),
                supabaseAdmin.from('transactions')
                    .select(`id, amount_before, amount_after, payment_method, status, created_at, customers ( full_name )`)
                    .order('created_at', { ascending: false })
                    .limit(5),
                supabaseAdmin.from('transactions')
                    .select('created_at')
                    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
                // Get transactions with discounts (same query, filter in JS)
                supabaseAdmin.from('transactions')
                    .select('created_at, amount_before, amount_after')
                    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            ]);

            if (customersError || txError || activityError || packagesError || chartError) throw new Error('Legacy fallback failed');

            const days = {};
            const discountDays = {};
            for (let i = 6; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i);
                const dateKey = d.toISOString().split('T')[0];
                days[dateKey] = 0;
                discountDays[dateKey] = { count: 0, total: 0 };
            }
            chartData.forEach(row => {
                const dateStr = row.created_at.split('T')[0];
                if (days[dateStr] !== undefined) days[dateStr]++;
            });

            // Calculate discounts per day
            (discountsData || []).forEach(row => {
                const dateStr = row.created_at.split('T')[0];
                if (discountDays[dateStr] !== undefined) {
                    const discountAmount = (row.amount_before || 0) - (row.amount_after || 0);
                    if (discountAmount > 0) {
                        discountDays[dateStr].count++;
                        discountDays[dateStr].total += discountAmount;
                    }
                }
            });

            stats = {
                totalCustomers: totalCustomers || 0,
                totalPoints: totalPackages || 0, // Now represents count of active coupons
                totalTransactions: totalTransactions || 0,
                recentActivity: (recentActivity || []).map(tx => ({
                    id: tx.id,
                    points: tx.amount_before - tx.amount_after, // Discount amount as "points"
                    amount_before: tx.amount_before,
                    amount_after: tx.amount_after,
                    reason: tx.payment_method,
                    created_at: tx.created_at,
                    customers: tx.customers
                })),
                chartData: Object.entries(days).map(([date, count]) => ({
                    date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
                    fullDate: date,
                    count
                })),
                // New: Discounts statistics per day
                discountsChartData: Object.entries(discountDays).map(([date, data]) => ({
                    date: new Date(date).toLocaleDateString('ar-EG', { weekday: 'short' }),
                    fullDate: date,
                    count: data.count,
                    total: Math.round(data.total * 100) / 100
                }))
            };
        }

        return NextResponse.json({ data: stats });

    } catch (error) {
        console.error('Dashboard Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
