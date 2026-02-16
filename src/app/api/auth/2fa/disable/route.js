import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { authLogger } from '@/lib/logger';

export async function POST(request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.id;

        // Disable 2FA for the user
        const { error } = await supabase
            .from('users')
            .update({
                two_factor_enabled: false,
                two_factor_secret: null // Optional: clear secret or keep it? 
                // Usually better to clear it to allow fresh setup.
            })
            .eq('id', userId);

        if (error) throw error;

        authLogger.info('2FA disabled successfully', { userId });

        return NextResponse.json({
            success: true,
            message: 'Two-factor authentication has been disabled.'
        });

    } catch (error) {
        console.error('2FA Disable Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
