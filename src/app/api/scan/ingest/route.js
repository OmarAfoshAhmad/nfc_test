import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { handleApiError } from '@/lib/errorHandler';

// This API is called by the NFC Reader Middleware in the branches
// It "pushes" the scan data to the cloud.
export async function POST(request) {
    try {
        const body = await request.json();
        const { terminal_id, terminal_secret, uid } = body;

        if (!terminal_id || !terminal_secret || !uid) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        // 1. Verify Terminal Identity via Supabase
        const { data: terminal, error: termError } = await supabase
            .from('terminals')
            .select('*, branches(id)')
            .eq('id', terminal_id)
            .eq('terminal_secret', terminal_secret)
            .eq('is_active', true)
            .maybeSingle();

        if (termError) throw termError;

        if (!terminal) {
            return NextResponse.json({ message: 'Unauthorized terminal' }, { status: 401 });
        }

        // 2. Broadcast to Supabase Realtime (via DB insert)
        // This will trigger the frontend listeners
        const { error: eventError } = await supabase
            .from('scan_events')
            .insert([
                {
                    terminal_id: terminal.id,
                    branch_id: terminal.branch_id,
                    uid: uid
                }
            ]);

        if (eventError) {
            console.error('Supabase Realtime Broadcast Error:', eventError);
        }

        // 3. Update Last Sync
        const { error: syncError } = await supabase
            .from('terminals')
            .update({ last_sync: new Date().toISOString() })
            .eq('id', terminal_id);

        if (syncError) {
            console.error('Failed to update last_sync:', syncError);
            // Still return success for the scan, but log the sync error
        }

        return NextResponse.json({
            status: 'success',
            message: 'Scan ingestion successful',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        return handleApiError(error, 'POST /api/scan/ingest');
    }
}
