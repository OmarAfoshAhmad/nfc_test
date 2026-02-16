import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const showDeleted = searchParams.get('deleted') === 'true';

    let query = supabase.from('campaigns').select('*').order('created_at', { ascending: false });

    if (showDeleted) {
        query = query.not('deleted_at', 'is', null);
    } else {
        query = query.is('deleted_at', null); // Default: Show active Only
    }

    if (type) {
        query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function PATCH(request) {
    // 1. Auth Check (Admin Only)
    const { getSession } = await import('@/lib/auth');
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized: Admins only' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { id, restore } = body;

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        if (restore) {
            const { error } = await supabase
                .from('campaigns')
                .update({ deleted_at: null })
                .eq('id', id);
            if (error) throw error;

            await logAudit({
                action: 'RESTORE',
                entity: 'campaigns',
                entityId: id,
                details: { restored_at: new Date().toISOString() },
                req: request
            });

            return NextResponse.json({ success: true, message: 'Restored successfully' });
        }

        return NextResponse.json({ message: 'No action taken' });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request) {
    // 1. Auth Check (Admin Only) - Critical since DB is open to API
    const { getSession } = await import('@/lib/auth');
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized: Admins only' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { name, description, type, trigger_condition, reward_config, price, usage_limit, validity_days, customer_type, bundle_type } = body;

        // Basic Validation
        if (!name || !type || !reward_config) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('campaigns')
            .insert([{
                name,
                description,
                type,
                trigger_condition: trigger_condition || {},
                reward_config,
                price: price || 0,
                usage_limit: usage_limit || 1,
                validity_days: validity_days || 30, // Default 30 days
                customer_type: customer_type || null,
                bundle_type: bundle_type || null,
                is_active: true
            }])
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        await logAudit({
            action: 'CREATE',
            entity: 'campaigns',
            entityId: data.id,
            details: { name, type, price, usage_limit },
            req: request
        });

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request) {
    // 1. Auth Check (Admin Only)
    const { getSession } = await import('@/lib/auth');
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized: Admins only' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { id, name, description, type, trigger_condition, reward_config, price, usage_limit, validity_days, customer_type, bundle_type } = body;

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        // Update
        const { data, error } = await supabase
            .from('campaigns')
            .update({
                name,
                description,
                type,
                trigger_condition,
                reward_config,
                price: price || 0,
                usage_limit: usage_limit || 1,
                validity_days: validity_days || 30,
                customer_type: customer_type || null,
                bundle_type: bundle_type || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await logAudit({
            action: 'UPDATE',
            entity: 'campaigns',
            entityId: id,
            details: { name, type, changes: 'Update Details' },
            req: request
        });

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request) {
    // 1. Auth Check
    const { getSession } = await import('@/lib/auth');
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized: Admins only' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const permanent = searchParams.get('permanent') === 'true';

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        if (permanent) {
            // PERMANENT DELETE
            const { error } = await supabase
                .from('campaigns')
                .delete()
                .eq('id', id);

            if (error) return NextResponse.json({ error: error.message }, { status: 500 });

            await logAudit({
                action: 'DELETE_PERMANENT',
                entity: 'campaigns',
                entityId: id,
                details: { permanent: true },
                req: request
            });
        } else {
            // Soft Delete (Update deleted_at)
            const { error } = await supabase
                .from('campaigns')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id);

            if (error) return NextResponse.json({ error: error.message }, { status: 500 });

            await logAudit({
                action: 'DELETE',
                entity: 'campaigns',
                entityId: id,
                details: { soft_delete: true },
                req: request
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
