// Triggered recompile to resolve stale build cache
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { enforceMaintenance } from '@/lib/maintenance';

export async function GET(request) {
    const session = await getSession();
    const isSuperAdmin = session?.role === 'superadmin';
    const isAdmin = session?.role === 'admin';

    if (!session || (!isAdmin && !isSuperAdmin)) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const showDeleted = searchParams.get('deleted') === 'true';

        let query = supabase
            .from('users')
            .select('id, username, role, branch_id, created_at, deleted_at')
            .order('created_at', { ascending: false });

        if (showDeleted) {
            query = query.not('deleted_at', 'is', null);
        } else {
            query = query.is('deleted_at', null);
        }

        // Filter out superadmins if not superadmin
        if (!isSuperAdmin) {
            query = query.neq('role', 'superadmin');

            // If admin, they might only be allowed to see users in their branch (optional logic)
            // if (session.branch_id) {
            //     query = query.eq('branch_id', session.branch_id);
            // }
        }

        const { data, error } = await query;

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    const session = await getSession();
    const isSuperAdmin = session?.role === 'superadmin';
    const isAdmin = session?.role === 'admin';

    if (!session || (!isAdmin && !isSuperAdmin)) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Enforce Maintenance Mode
    const maintenance = await enforceMaintenance(session);
    if (maintenance) return maintenance;

    try {
        const { username, password, role, branch_id } = await request.json();

        // Prevent creating superadmin unless superadmin
        if (role === 'superadmin' && !isSuperAdmin) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        if (!username || !password || !role) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const { data, error } = await supabase
            .from('users')
            .insert([{
                username,
                password_hash,
                role,
                branch_id: branch_id || null
            }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json({ message: 'Username already exists' }, { status: 400 });
            }
            throw error;
        }

        await logAudit({
            action: 'CREATE',
            entity: 'users',
            entityId: data.id,
            details: { username, role, branch_id },
            req: request
        });

        return NextResponse.json({ data });
    } catch (error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    const session = await getSession();
    const isSuperAdmin = session?.role === 'superadmin';
    const isAdmin = session?.role === 'admin';

    if (!session || (!isAdmin && !isSuperAdmin)) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Enforce Maintenance Mode
    const maintenance = await enforceMaintenance(session);
    if (maintenance) return maintenance;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ message: 'ID is required' }, { status: 400 });
    }

    // Prevent self-deletion
    if (id === session.id.toString()) {
        return NextResponse.json({ message: 'Cannot delete yourself' }, { status: 400 });
    }

    // Protection for superadmin
    if (!isSuperAdmin) {
        const { data: targetUser } = await supabase.from('users').select('role').eq('id', id).single();
        if (targetUser?.role === 'superadmin') {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }
    }

    try {
        const { error } = await supabase
            .from('users')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;

        await logAudit({
            action: 'DELETE',
            entity: 'users',
            entityId: id,
            details: { deleted: true },
            req: request
        });

        return NextResponse.json({ message: 'User deleted' });
    } catch (error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}

export async function PATCH(request) {
    const session = await getSession();
    const isSuperAdmin = session?.role === 'superadmin';
    const isAdmin = session?.role === 'admin';

    if (!session || (!isAdmin && !isSuperAdmin)) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Enforce Maintenance Mode
    const maintenance = await enforceMaintenance(session);
    if (maintenance) return maintenance;

    try {
        const { id, restore } = await request.json();
        if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

        // Protection for superadmin
        if (!isSuperAdmin) {
            const { data: targetUser } = await supabase.from('users').select('role').eq('id', id).single();
            if (targetUser?.role === 'superadmin') {
                return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
            }
        }

        if (restore) {
            const { error } = await supabase
                .from('users')
                .update({ deleted_at: null })
                .eq('id', id);

            if (error) throw error;

            await logAudit({
                action: 'RESTORE',
                entity: 'users',
                entityId: id,
                details: { restored_at: new Date().toISOString() },
                req: request
            });

            return NextResponse.json({ message: 'User restored successfully' });
        }

        return NextResponse.json({ message: 'No action taken' });
    } catch (error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}
