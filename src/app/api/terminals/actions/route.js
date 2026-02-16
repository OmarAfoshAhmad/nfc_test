import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { action_type, terminal_id, payload } = body;

        if (!terminal_id) {
            return NextResponse.json({ message: 'Terminal ID is required' }, { status: 400 });
        }

        if (action_type === 'WRITE_SIGNATURE') {
            const uid = payload?.uid;
            if (!uid) return NextResponse.json({ message: 'UID is required' }, { status: 400 });

            // Calculate Signature
            // 0. Fetch Global Passphrase from Settings (Replicating logic from enroll/route.js)
            let globalSignature = 'yamen'; // Default Fallback
            try {
                const { data: setting } = await supabaseAdmin
                    .from('settings')
                    .select('value')
                    .eq('key_name', globalSignature)
                    .maybeSingle();

                if (setting?.value) {
                    globalSignature = setting.value;
                }
            } catch (e) {
                console.warn('Could not load card_secret_phrase, using default');
            }

            const secretKey = globalSignature || 'yamen';

            // Generate HMAC
            const hmac = crypto.createHmac('sha256', secretKey);
            hmac.update(uid.toUpperCase());
            const hash = hmac.digest('hex'); // 64 chars

            // Combine Magic Header (YAME in hex: 59414D45) + first 24 hex chars of hash
            const signature = "59414D45" + hash.substring(0, 24).toUpperCase();

            // Insert Action
            const { data, error } = await supabaseAdmin
                .from('terminal_actions')
                .insert({
                    terminal_id: terminal_id,
                    action_type: 'WRITE_SIGNATURE',
                    payload: { uid: uid.toUpperCase(), signature },
                    status: 'PENDING'
                    // admin_id column doesn't exist in schema
                })
                .select()
                .single();

            if (error) throw error;

            return NextResponse.json({ success: true, data });
        }

        return NextResponse.json({ message: 'Invalid action type' }, { status: 400 });

    } catch (error) {
        console.error('Terminal Action Error:', error);
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}
