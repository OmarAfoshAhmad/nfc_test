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
            .select('id, terminal_id, created_at, status, processed, metadata', { count: 'exact' });

        if (terminalId) {
            scanQuery = scanQuery.eq('terminal_id', terminalId);
        }

        const { count: totalScans, data: scans } = await scanQuery;

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

        // إحصائيات النتائج
        let securedScans = 0;
        let totalErrors = 0;
        let successfulScans = 0;

        if (Array.isArray(scans)) {
            const errorStatuses = new Set(['unknown_card', 'unsupported_card', 'error', 'failed']);

            for (const s of scans) {
                const statusRaw = typeof s.status === 'string' ? s.status : '';
                const status = statusRaw.toLowerCase();
                const isErrorStatus = errorStatuses.has(status);
                const hasErrorMeta = Boolean(s?.metadata?.error);
                const isError = isErrorStatus || hasErrorMeta;

                if (isError) {
                    totalErrors += 1;
                } else if (status === 'present' || status === 'success' || s.processed === true) {
                    successfulScans += 1;
                }

                if (s?.metadata?.secured === true) {
                    securedScans += 1;
                }
            }
        }

        const denominator = successfulScans + totalErrors;
        const successRate = denominator > 0
            ? ((successfulScans / denominator) * 100).toFixed(2)
            : '100';

        const stats = {
            totalScans: totalScans || 0,
            totalErrors,
            activeDevices: activeDevices || 0,
            securedScans,
            unsecuredScans: (totalScans || 0) - securedScans,
            successfulScans,
            successRate
        };

        return successResponse(stats);
    } catch (error) {
        return handleApiError(error, 'GET /api/analytics/device-stats');
    }
}
