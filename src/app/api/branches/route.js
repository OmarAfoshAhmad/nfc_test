import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { successResponse, handleApiError } from '@/lib/errorHandler';
import { logAudit } from '@/lib/audit';
import { enforceMaintenance } from '@/lib/maintenance';

export async function GET(request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const showDeleted = searchParams.get('deleted') === 'true';

        let query = supabase
            .from('branches')
            .select('*')
            .order('name', { ascending: true });

        if (showDeleted) {
            query = query.not('deleted_at', 'is', null);
        } else {
            query = query.eq('is_active', true).is('deleted_at', null);
        }

        const { data, error } = await query;

        if (error) throw error;

        return successResponse(data);
    } catch (error) {
        return handleApiError(error, 'GET /api/branches');
    }
}

export async function POST(request) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // Enforce Maintenance Mode
        const maintenance = await enforceMaintenance(session);
        if (maintenance) return maintenance;

        const body = await request.json();
        const { name, location } = body;

        if (!name) return NextResponse.json({ message: 'Name is required' }, { status: 400 });

        const { data, error } = await supabase
            .from('branches')
            .insert([{ name, location, is_active: true }])
            .select()
            .single();

        if (error) throw error;

        await logAudit({
            action: 'CREATE',
            entity: 'branches',
            entityId: data.id,
            details: { name, location },
            req: request
        });

        return successResponse(data, 201, 'Branch created successfully');
    } catch (error) {
        return handleApiError(error, 'POST /api/branches');
    }
}

export async function DELETE(request) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // Enforce Maintenance Mode
        const maintenance = await enforceMaintenance(session);
        if (maintenance) return maintenance;

        const url = new URL(request.url);
        const id = url.searchParams.get('id');

        if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

        // Soft delete (set is_active to false)
        const { error } = await supabase
            .from('branches')
            .update({
                is_active: false,
                deleted_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;

        await logAudit({
            action: 'DELETE',
            entity: 'branches',
            entityId: id,
            details: { is_active: false },
            req: request
        });

        return successResponse({ id }, 200, 'Branch deactivated successfully');
    } catch (error) {
        return handleApiError(error, 'DELETE /api/branches');
    }
}

export async function PATCH(request) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id, restore } = await request.json();
        if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

        if (restore) {
            const { error } = await supabase
                .from('branches')
                .update({
                    deleted_at: null,
                    is_active: true
                })
                .eq('id', id);

            if (error) throw error;

            await logAudit({
                action: 'RESTORE',
                entity: 'branches',
                entityId: id,
                details: { restored_at: new Date().toISOString() },
                req: request
            });

            return successResponse({ id }, 200, 'Branch restored successfully');
        }

        return NextResponse.json({ message: 'No action taken' });
    } catch (error) {
        return handleApiError(error, 'PATCH /api/branches');
    }
}
