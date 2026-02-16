import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { handleApiError, successResponse } from '@/lib/errorHandler';
import { enforceMaintenance } from '@/lib/maintenance';

export async function PUT(request, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    // Enforce Maintenance Mode
    const maintenance = await enforceMaintenance(session);
    if (maintenance) return maintenance;

    const { id } = await params;

    try {
        const body = await request.json();
        const { name, type, value, points_required, start_date, end_date, is_active } = body;

        const { error } = await supabase
            .from('discounts')
            .update({
                name,
                type,
                value,
                points_required: points_required || 0,
                start_date: start_date || null,
                end_date: end_date || null,
                is_active
            })
            .eq('id', id);

        if (error) throw error;

        return successResponse({ id }, 200, 'Discount updated');
    } catch (error) {
        return handleApiError(error, 'PUT /api/discounts/[id]');
    }
}

export async function DELETE(request, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    // Enforce Maintenance Mode
    const maintenance = await enforceMaintenance(session);
    if (maintenance) return maintenance;

    const { id } = await params;

    try {
        const { error } = await supabase
            .from('discounts')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return successResponse({ id }, 200, 'Discount deleted');
    } catch (error) {
        return handleApiError(error, 'DELETE /api/discounts/[id]');
    }
}
