import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { verifyTwoFactorToken } from '@/lib/auth-2fa';
import { authLogger } from '@/lib/logger';
import { z } from 'zod';

const enableSchema = z.object({
    token: z.string().length(6)
});

export async function POST(request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const validation = enableSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid code format' }, { status: 400 });
        }

        const { token } = validation.data;
        const userId = session.id;

        // 1. Get Stored Secret
        const { data: user, error } = await supabase
            .from('users')
            .select('two_factor_secret')
            .eq('id', userId)
            .single();

        if (error || !user?.two_factor_secret) {
            return NextResponse.json({ message: 'Setup not initiated' }, { status: 400 });
        }

        // 2. Verify Code
        const isValid = verifyTwoFactorToken(token, user.two_factor_secret);

        if (!isValid) {
            return NextResponse.json({ message: 'Invalid verification code' }, { status: 400 });
        }

        // 3. Enable 2FA
        await supabase
            .from('users')
            .update({ two_factor_enabled: true })
            .eq('id', userId);

        authLogger.info('2FA enabled successfully', { userId });

        return NextResponse.json({ success: true, message: '2FA Enabled Successfully' });

    } catch (error) {
        console.error('2FA Enable Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
