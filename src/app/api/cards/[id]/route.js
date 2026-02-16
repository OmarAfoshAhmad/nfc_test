import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { handleApiError, successResponse } from '@/lib/errorHandler';

export async function PUT(request, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    try {
        const body = await request.json();
        const { customer_id, is_active, expires_at, valid_from } = body;

        const { error } = await supabase
            .from('cards')
            .update({
                customer_id: customer_id || null,
                is_active,
                expires_at: expires_at || null,
                valid_from: valid_from || null
            })
            .eq('id', id);

        if (error) throw error;

        await logAudit({
            action: 'UPDATE',
            entity: 'cards',
            entityId: id,
            details: body,
            req: request
        });

        return successResponse({ id }, 200, 'Card updated');
    } catch (error) {
        return handleApiError(error, 'PUT /api/cards/[id]');
    }
}

import { logAudit } from '@/lib/audit';

export async function DELETE(request, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';

    try {
        if (permanent) {
            // PERMANENT DELETE
            const { error } = await supabase
                .from('cards')
                .delete()
                .eq('id', id);

            if (error) throw error;

            await logAudit({
                action: 'DELETE_PERMANENT',
                entity: 'cards',
                entityId: id,
                details: { permanent: true },
                req: request
            });
        } else {
            // Soft Delete
            const { error } = await supabase
                .from('cards')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;

            await logAudit({
                action: 'DELETE',
                entity: 'cards',
                entityId: id,
                details: { soft_delete: true },
                req: request
            });
        }

        return successResponse({ id }, 200, 'Card deleted');
    } catch (error) {
        return handleApiError(error, 'DELETE /api/cards/[id]');
    }
}
