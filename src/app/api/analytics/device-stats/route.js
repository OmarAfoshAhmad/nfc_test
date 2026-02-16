import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { successResponse, handleApiError } from '@/lib/errorHandler';

export async function GET(request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const terminalId = searchParams.get('terminal_id');

        // جلب إحصائيات المسحات
        let scanQuery = supabase
            .from('scan_events')
            .select('id, terminal_id, created_at, secured', { count: 'exact' });

        if (terminalId) {
            scanQuery = scanQuery.eq('terminal_id', terminalId);
        }

        const { count: totalScans, data: scans } = await scanQuery;

        // حساب عدد الأخطاء (المسحات غير المعالجة)
        let errorQuery = supabase
            .from('scan_events')
            .select('id', { count: 'exact' })
            .eq('processed', false);

        if (terminalId) {
            errorQuery = errorQuery.eq('terminal_id', terminalId);
        }

        const { count: totalErrors } = await errorQuery;

        // الأجهزة النشطة
        let deviceQuery = supabase
            .from('terminals')
            .select('id, name, is_active', { count: 'exact' })
            .eq('is_active', true)
            .is('deleted_at', null);

        if (terminalId) {
            deviceQuery = deviceQuery.eq('id', terminalId);
        }

        const { count: activeDevices } = await deviceQuery;

        // إحصائيات البطاقات المؤمنة
        let securedScans = 0;
        if (scans) {
            securedScans = scans.filter(s => s.secured).length;
        }

        const stats = {
            totalScans: totalScans || 0,
            totalErrors: totalErrors || 0,
            activeDevices: activeDevices || 0,
            securedScans,
            unsecuredScans: (totalScans || 0) - securedScans,
            successRate: totalScans > 0 ? (((totalScans || 0) - (totalErrors || 0)) / (totalScans || 0) * 100).toFixed(2) : '100'
        };

        return successResponse(stats);
    } catch (error) {
        return handleApiError(error, 'GET /api/analytics/device-stats');
    }
}
