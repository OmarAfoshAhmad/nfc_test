-- Update get_dashboard_stats to accurately reflect available packages (coupons)
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'totalCustomers', (SELECT count(*) FROM public.customers WHERE deleted_at IS NULL),
        'totalPoints', (
            SELECT count(*) 
            FROM public.customer_coupons 
            WHERE status = 'ACTIVE' 
            AND (expires_at IS NULL OR expires_at >= NOW())
        ), -- This field represents "Number of Packages" (عدد الباقات)
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
