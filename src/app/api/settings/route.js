import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { getSystemSettings } from '@/lib/loyalty';
import { logAudit } from '@/lib/audit';
import cache, { CacheKeys } from '@/lib/cache';
import { successResponse, handleApiError } from '@/lib/errorHandler';

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const settings = await getSystemSettings();
    return successResponse(settings);
}

export async function POST(request) {
    const session = await getSession();
    const isSuperAdmin = session?.role === 'superadmin';
    const isAdmin = session?.role === 'admin';

    if (!session || (!isAdmin && !isSuperAdmin)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await request.json();

        // Upsert settings in Supabase
        const keys = Object.keys(body);
        const upsertData = keys.map(key => ({
            key_name: key,
            value: String(body[key])
        }));

        const { error } = await supabase
            .from('settings')
            .upsert(upsertData, { onConflict: 'key_name' });

        if (error) throw error;

        // Audit Log
        await logAudit({
            action: 'UPDATE_SETTINGS',
            entity: 'settings',
            details: body,
            req: request
        });

        // Clear Settings Cache
        cache.delete(CacheKeys.SETTINGS);

        return successResponse(null, 200, 'Settings saved');
    } catch (error) {
        return handleApiError(error, 'POST /api/settings');
    }
}
