import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { generateTwoFactorSecret } from '@/lib/auth-2fa';
import { authLogger } from '@/lib/logger';

export async function POST(request) {
    try {
        // 1. Authenticate
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.id;

        // 2. Get User Email/Username (for QR label)
        const { data: user, error } = await supabase
            .from('users')
            .select('username') // or email if you have it
            .eq('id', userId)
            .single();

        if (error || !user) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }

        // 3. Generate Secret & QR
        const { secret, qrCode } = await generateTwoFactorSecret(user.username);

        // 4. Save Secret Temporarily (Enabled = false)
        const { error: updateError } = await supabase
            .from('users')
            .update({
                two_factor_secret: secret,
                two_factor_enabled: false // Not enabled yet!
            })
            .eq('id', userId);

        if (updateError) throw updateError;

        authLogger.info('2FA setup initiated', { userId });

        return NextResponse.json({
            secret, // Optional: if user wants to enter it manually
            qrCode
        });

    } catch (error) {
        console.error('2FA Setup Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
