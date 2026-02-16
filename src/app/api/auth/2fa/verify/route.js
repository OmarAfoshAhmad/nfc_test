import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabase } from '@/lib/supabase';
import { verifyTwoFactorToken } from '@/lib/auth-2fa';
import { signToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { AUTH, ENV } from '@/lib/constants';
import { z } from 'zod';
import { authLogger } from '@/lib/logger';

const verifySchema = z.object({
    tempToken: z.string(),
    token: z.string().length(6) // OTP Code
});

// Helper to verify temp token
function verifyTempToken(token) {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
        return null;
    }
}

export async function POST(request) {
    try {
        const body = await request.json();

        // Validate input
        const validation = verifySchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
        }

        const { tempToken, token: otpCode } = validation.data;

        // 1. Verify Temp Token
        const decoded = verifyTempToken(tempToken);
        if (!decoded || decoded.scope !== '2fa_login') {
            return NextResponse.json({ message: 'Invalid or expired session' }, { status: 401 });
        }

        const userId = decoded.id;

        // 2. Get User Secret
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return NextResponse.json({ message: 'User not found' }, { status: 401 });
        }

        // 3. Verify OTP
        const isValid = verifyTwoFactorToken(otpCode, user.two_factor_secret);
        if (!isValid) {
            authLogger.warn('Invalid 2FA code attempt', { userId, username: user.username });
            return NextResponse.json({ message: 'Invalid code' }, { status: 401 });
        }

        // 4. Issue Real Token (Login Success)
        const realToken = signToken({ id: user.id, username: user.username, role: user.role });

        const cookieStore = await cookies();
        cookieStore.set(AUTH.COOKIE_NAME, realToken, {
            httpOnly: true,
            secure: ENV.isProduction,
            sameSite: 'strict',
            maxAge: AUTH.COOKIE_MAX_AGE,
            path: '/',
        });

        authLogger.info('Successful 2FA login', { userId, username: user.username });

        return NextResponse.json({
            success: true,
            user: { id: user.id, username: user.username, role: user.role }
        });

    } catch (error) {
        console.error('2FA Verify Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
