import { NextResponse } from 'next/server';
// Migrated from jsonwebtoken to jose (via lib/auth)
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { loginSchema } from '@/lib/schemas';
import { AUTH, ERROR_CODES, ENV } from '@/lib/constants';
import { handleApiError } from '@/lib/errorHandler';
import { authLogger } from '@/lib/logger';
import { logAudit } from '@/lib/audit';

export async function POST(request) {
    try {
        const body = await request.json();

        // Validate input
        const validation = loginSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({
                message: 'Invalid input',
                errors: validation.error.flatten().fieldErrors
            }, { status: 400 });
        }

        const { username, password } = validation.data;

        // Get IP
        const ip = request.headers.get('x-forwarded-for') || 'unknown';

        // 1. Check Rate Limit via Supabase
        const { data: attempts } = await supabase
            .from('login_attempts')
            .select('*')
            .eq('ip_address', ip)
            .eq('username', username)
            .maybeSingle();

        if (attempts) {
            if (attempts.locked_until && new Date(attempts.locked_until) > new Date()) {
                const waitMinutes = Math.ceil((new Date(attempts.locked_until) - new Date()) / 60000);
                authLogger.warn('Account locked', { username, ip, waitMinutes });
                return NextResponse.json({
                    message: `Account locked. Try again in ${waitMinutes} minutes.`,
                    errorCode: ERROR_CODES.AUTH_ACCOUNT_LOCKED
                }, { status: 429 });
            }
        }

        // 2. Find User
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .maybeSingle();

        if (userError) throw userError;

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            // Increment fail count
            const currentCount = (attempts?.attempt_count || 0) + 1;
            let lockedUntil = null;

            if (currentCount >= AUTH.MAX_LOGIN_ATTEMPTS) {
                const lockDuration = AUTH.LOGIN_LOCK_DURATION_MINUTES || 15;
                lockedUntil = new Date(Date.now() + lockDuration * 60000).toISOString();
            }

            await supabase
                .from('login_attempts')
                .upsert({
                    ip_address: ip,
                    username: username,
                    attempt_count: currentCount,
                    last_attempt_at: new Date().toISOString(),
                    locked_until: lockedUntil
                }, { onConflict: 'ip_address,username' });

            authLogger.warn('Failed login attempt', { username, ip });
            return NextResponse.json({
                message: 'Invalid credentials',
                errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS
            }, { status: 401 });
        }

        // 3. Reset fail count on success
        await supabase
            .from('login_attempts')
            .delete()
            .eq('ip_address', ip)
            .eq('username', username);

        const token = signToken({ id: user.id, username: user.username, role: user.role });

        const cookieStore = await cookies();
        cookieStore.set(AUTH.COOKIE_NAME, token, {
            httpOnly: true,
            secure: ENV.isProduction,
            sameSite: 'strict',
            maxAge: AUTH.COOKIE_MAX_AGE,
            path: '/',
        });

        authLogger.info('Successful login', { userId: user.id, username: user.username, role: user.role });

        await logAudit({
            action: 'LOGIN',
            entity: 'auth',
            entityId: user.id,
            details: { role: user.role },
            req: request
        });

        return NextResponse.json({ user: { id: user.id, username: user.username, role: user.role } });

    } catch (error) {
        return handleApiError(error, 'POST /api/auth/login');
    }
}
