import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSystemSettings } from '@/lib/loyalty';
import { logAudit } from '@/lib/audit';

export async function GET(request) {
    try {
        // 1. Security Check: Allow if Admin Session OR Bearer Secret (for external Cron)
        const authHeader = request.headers.get('authorization');
        const isCronAuth = authHeader === `Bearer ${process.env.CRON_SECRET}`;

        // Manual trigger via Admin Dashboard (if we add a button later)
        // const session = await getSession();
        // const isAdmin = session?.role === 'admin' || session?.role === 'superadmin';

        if (!isCronAuth && process.env.NODE_ENV === 'production') {
            // allows local testing without secret, but strict in prod
            // For now, we'll keep it open or require a simple key if provided
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // 2. Fetch Settings
        const settings = await getSystemSettings();
        const enableCleanup = settings.enable_db_cleanup === 'true';
        const daysToKeep = parseInt(settings.db_cleanup_days || '10');

        if (!enableCleanup) {
            return NextResponse.json({
                success: false,
                message: 'Cleanup is disabled in settings.'
            });
        }

        // 3. Calculate Cutoff
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        const cutoffISO = cutoffDate.toISOString();

        // 4. Perform Deletion
        // Only delete PROCESSED events
        const { count, error } = await supabase
            .from('scan_events')
            .delete({ count: 'exact' })
            .eq('processed', true)
            .lt('created_at', cutoffISO);

        if (error) throw error;

        // 5. Log Audit
        if (count > 0) {
            await logAudit({
                action: 'SYSTEM_CLEANUP',
                entity: 'scan_events',
                details: { deleted_count: count, cutoff_date: cutoffISO },
                req: request
            });
        }

        return NextResponse.json({
            success: true,
            message: `Cleanup completed. Deleted ${count} records older than ${daysToKeep} days.`,
            deleted_count: count
        });

    } catch (error) {
        console.error('Cleanup Error:', error);
        return NextResponse.json({
            success: false,
            message: error.message
        }, { status: 500 });
    }
}
