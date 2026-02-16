import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function PUT(request, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    try {
        const body = await request.json();
        const { full_name, phone, email, uid, type } = body;

        const { error } = await supabase
            .from('customers')
            .update({ full_name, phone, email, type })
            .eq('id', id);

        if (error) throw error;

        // Handle Card Linkage if UID provided
        if (uid) {
            const { data: existingCard } = await supabase
                .from('cards')
                .select('id, customer_id')
                .eq('uid', uid)
                .maybeSingle();

            if (existingCard) {
                if (existingCard.customer_id && existingCard.customer_id !== id) {
                    return NextResponse.json({ message: 'Card already assigned to another customer' }, { status: 400 });
                }

                // Link if not already linked
                if (existingCard.customer_id !== id) {
                    const { error: linkError } = await supabase
                        .from('cards')
                        .update({ customer_id: id, is_active: true })
                        .eq('id', existingCard.id);
                    if (linkError) throw linkError;
                }
            } else {
                // Create new card
                const { error: cardError } = await supabase
                    .from('cards')
                    .insert([{ uid, customer_id: id, is_active: true }]);
                if (cardError) throw cardError;
            }
        }

        await logAudit({
            action: 'UPDATE',
            entity: 'customers',
            entityId: id,
            details: body,
            req: request
        });

        return NextResponse.json({ message: 'Customer updated' });
    } catch (error) {
        console.error('PUT /api/customers/[id] error:', error);
        return NextResponse.json({ message: 'Database error' }, { status: 500 });
    }
}

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
                .from('customers')
                .delete()
                .eq('id', id);

            if (error) throw error;

            await logAudit({
                action: 'DELETE_PERMANENT',
                entity: 'customers',
                entityId: id,
                details: { permanent: true },
                req: request
            });
        } else {
            // Soft Delete (Update deleted_at)
            const { error } = await supabase
                .from('customers')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;

            await logAudit({
                action: 'DELETE',
                entity: 'customers',
                entityId: id,
                details: { deleted: true },
                req: request
            });
        }

        return NextResponse.json({ message: 'Customer deleted' });
    } catch (error) {
        console.error('DELETE /api/customers/[id] error:', error);
        return NextResponse.json({ message: 'Database error' }, { status: 500 });
    }
}
