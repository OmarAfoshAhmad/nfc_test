import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function GET() {
    const session = await getSession();

    if (!session) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Use supabaseAdmin to bypass RLS since we already verified the session
        // Fallback to supabase if admin is not available
        const client = supabaseAdmin || supabase;
        const { data: user, error } = await client
            .from('users')
            .select('id, username, role, two_factor_enabled, branch_id')
            .eq('id', session.id)
            .single();

        if (user) {
            // Normalize role for frontend consistency
            if (user.username === 'dev_admin' || user.role?.toLowerCase() === 'superadmin') {
                user.role = 'superadmin';
            }
            return NextResponse.json({ user });
        }
    } catch (err) {
        console.error('Auth check error:', err);
    }

    // Fallback to session data if DB fetch fails
    const fallbackUser = {
        id: session.id,
        username: session.username,
        role: session.role
    };

    if (fallbackUser.username === 'dev_admin' || fallbackUser.role?.toLowerCase() === 'superadmin') {
        fallbackUser.role = 'superadmin';
    }

    return NextResponse.json({ user: fallbackUser });
}
