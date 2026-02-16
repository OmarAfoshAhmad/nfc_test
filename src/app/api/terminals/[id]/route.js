import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { handleApiError, successResponse } from '@/lib/errorHandler';

export async function PUT(request, { params }) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;

    try {
        const body = await request.json();
        const { branch_id, name, is_active } = body;

        const { error } = await supabase
            .from('terminals')
            .update({ branch_id, name, is_active })
            .eq('id', id);

        if (error) throw error;

        return successResponse({ id }, 200, 'Terminal updated');
    } catch (error) {
        return handleApiError(error, 'PUT /api/terminals/[id]');
    }
}
