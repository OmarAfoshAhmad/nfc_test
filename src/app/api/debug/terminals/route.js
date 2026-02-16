import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function GET(request) {
    const session = await getSession();
    const userRole = session?.role?.toLowerCase();
    const isDev = ['superadmin', 'admin', 'manager'].includes(userRole) || session?.username === 'dev_admin';

    if (!isDev) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('terminals')
            .select('id, name, terminal_secret')
            .eq('is_active', true)
            .limit(5);

        if (error) throw error;

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Debug API Error:', error);
        return NextResponse.json({ message: 'Error fetching debug data' }, { status: 500 });
    }
}
