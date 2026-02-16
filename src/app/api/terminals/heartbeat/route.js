import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Terminal Heartbeat API
 * Called periodically by terminals to signal they are alive
 * Updates last_sync timestamp
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { terminal_id, terminal_secret } = body;

        if (!terminal_id || !terminal_secret) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        // 1. Verify Terminal Identity
        const { data: terminal, error: termError } = await supabase
            .from('terminals')
            .select('id')
            .eq('id', terminal_id)
            .eq('terminal_secret', terminal_secret)
            .eq('is_active', true)
            .maybeSingle();

        if (termError) throw termError;

        if (!terminal) {
            return NextResponse.json({ message: 'Unauthorized terminal' }, { status: 401 });
        }

        // 2. Update Last Sync timestamp to keep terminal marked as "online"
        const { error: updateError } = await supabase
            .from('terminals')
            .update({ last_sync: new Date().toISOString() })
            .eq('id', terminal_id);

        if (updateError) throw updateError;

        return NextResponse.json({
            status: 'success',
            message: 'Heartbeat received',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Heartbeat Error:', error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}
