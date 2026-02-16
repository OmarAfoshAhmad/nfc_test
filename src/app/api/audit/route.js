import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

// GET - Fetch audit logs
export async function GET(request) {
    const session = await getSession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin' && session.role !== 'staff')) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const filter = searchParams.get('filter') || 'ALL';
        const limit = parseInt(searchParams.get('limit') || '100');

        let query = supabaseAdmin
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (filter !== 'ALL') {
            query = query.eq('entity_name', filter);
        }

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}


export async function DELETE(request) {
    const session = await getSession();

    // Authorization Check
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { password } = await request.json();

        if (!password) {
            return NextResponse.json({ message: 'Password is required' }, { status: 400 });
        }

        // Fetch current user from DB to get the password hash
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('password_hash')
            .eq('id', session.id)
            .single();

        if (userError || !user) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }

        // Verify Password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return NextResponse.json({ message: 'Invalid password' }, { status: 401 });
        }

        // Perform Deletion
        const { error: deleteError } = await supabaseAdmin
            .from('audit_logs')
            .delete()
            .neq('id', 0); // Delete all rows

        if (deleteError) throw deleteError;

        // Log the deletion action (optional but good practice to know WHO cleared it)
        await logAudit({
            action: 'DELETE_ALL_LOGS',
            entity: 'audit_logs',
            entityId: 'SYSTEM',
            details: { cleared_by: session.username },
            req: request
        });

        return NextResponse.json({ success: true, message: 'Logs cleared successfully' });

    } catch (error) {
        console.error('ERROR CLEARING AUDIT LOGS:', error);
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}
