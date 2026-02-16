-- Migration to optimize Analytics Dashboard performance
-- Creates a single function to fetch all dashboard stats via one DB call

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'totalCustomers', (SELECT count(*) FROM public.customers),
        'totalPoints', (SELECT COALESCE(sum(points_balance), 0) FROM public.customers),
        'totalTransactions', (SELECT count(*) FROM public.points_ledger),
        'recentActivity', (
            SELECT json_agg(act) FROM (
                SELECT 
                    pl.id,
                    pl.points,
                    pl.reason,
                    pl.created_at,
                    c.full_name as customer_name
                FROM public.points_ledger pl
                JOIN public.customers c ON pl.customer_id = c.id
                ORDER BY pl.created_at DESC
                LIMIT 5
            ) act
        ),
        'chartData', (
            SELECT json_agg(daily) FROM (
                SELECT 
                    date_trunc('day', created_at)::date as date,
                    count(*) as count
                FROM public.points_ledger
                WHERE created_at >= NOW() - INTERVAL '7 days'
                GROUP BY 1
                ORDER BY 1 ASC
            ) daily
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
