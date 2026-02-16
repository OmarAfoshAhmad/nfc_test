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
        const { name, location, is_active } = body;

        const { error } = await supabase
            .from('branches')
            .update({ name, location, is_active })
            .eq('id', id);

        if (error) throw error;

        return successResponse({ id }, 200, 'Branch updated');
    } catch (error) {
        return handleApiError(error, 'PUT /api/branches/[id]');
    }
}
