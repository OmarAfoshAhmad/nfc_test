// Triggered recompile to resolve stale build cache
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { successResponse, handleApiError } from '@/lib/errorHandler';
import { logAudit } from '@/lib/audit';
import { enforceMaintenance } from '@/lib/maintenance';

export async function GET(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const showDeleted = searchParams.get('deleted') === 'true';

        let query = supabase
            .from('discounts')
            .select('*')
            .order('created_at', { ascending: false });

        if (showDeleted) {
            query = query.not('deleted_at', 'is', null);
        } else {
            query = query.is('deleted_at', null);
        }

        const { data, error } = await query;

        if (error) throw error;
        return successResponse(data);
    } catch (error) {
        return handleApiError(error, 'GET /api/discounts');
    }
}

export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    // Enforce Maintenance Mode
    const maintenance = await enforceMaintenance(session);
    if (maintenance) return maintenance;

    try {
        const body = await request.json();
        const { name, type, value, start_date, end_date } = body;

        if (!name || !value) return NextResponse.json({ message: 'Name and Value are required' }, { status: 400 });

        const { error } = await supabase
            .from('discounts')
            .insert([
                {
                    name,
                    type,
                    value,
                    points_required: 0, // No longer used
                    start_date: start_date || null,
                    end_date: end_date || null,
                    is_active: true
                }
            ]);

        if (error) throw error;

        return successResponse(null, 201, 'Discount created successfully');
    } catch (error) {
        return handleApiError(error, 'POST /api/discounts');
    }
}

export async function DELETE(request) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Enforce Maintenance Mode
    const maintenance = await enforceMaintenance(session);
    if (maintenance) return maintenance;

    try {
        const url = new URL(request.url);
        const id = url.searchParams.get('id');

        if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

        const { error } = await supabase
            .from('discounts')
            .update({
                is_active: false,
                deleted_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;

        await logAudit({
            action: 'DELETE',
            entity: 'discounts',
            entityId: id,
            details: { is_active: false },
            req: request
        });

        return successResponse({ id }, 200, 'Discount deactivated successfully');
    } catch (error) {
        return handleApiError(error, 'DELETE /api/discounts');
    }
}

export async function PATCH(request) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Enforce Maintenance Mode
    const maintenance = await enforceMaintenance(session);
    if (maintenance) return maintenance;

    try {
        const { id, restore } = await request.json();
        if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

        if (restore) {
            const { error } = await supabase
                .from('discounts')
                .update({
                    deleted_at: null,
                    is_active: true
                })
                .eq('id', id);

            if (error) throw error;

            await logAudit({
                action: 'RESTORE',
                entity: 'discounts',
                entityId: id,
                details: { restored_at: new Date().toISOString() },
                req: request
            });

            return successResponse({ id }, 200, 'Discount restored successfully');
        }

        return NextResponse.json({ message: 'No action taken' });
    } catch (error) {
        return handleApiError(error, 'PATCH /api/discounts');
    }
}


