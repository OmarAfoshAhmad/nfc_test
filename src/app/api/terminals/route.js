import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { successResponse, handleApiError } from '@/lib/errorHandler';
import { logAudit } from '@/lib/audit';
import { enforceMaintenance } from '@/lib/maintenance';
import crypto from 'crypto';

export async function GET(request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get('branch_id');
        const showDeleted = searchParams.get('deleted') === 'true';

        let query = supabase
            .from('terminals')
            .select('*');

        if (showDeleted) {
            query = query.not('deleted_at', 'is', null);
        } else {
            query = query.eq('is_active', true).is('deleted_at', null);
        }

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query.order('name', { ascending: true });
        if (error) throw error;

        // Enhance with last activity
        const terminalsWithActivity = await Promise.all(data.map(async (terminal) => {
            const { data: lastScan } = await supabase
                .from('scan_events')
                .select('created_at')
                .eq('terminal_id', terminal.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            return {
                ...terminal,
                last_activity: lastScan ? lastScan.created_at : null
            };
        }));

        return successResponse(terminalsWithActivity);
    } catch (error) {
        return handleApiError(error, 'GET /api/terminals');
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
        const { branch_id, name, connection_url } = body;

        // Generate a secure secret for push-based ingestion
        const terminal_secret = crypto.randomBytes(32).toString('hex');

        const { data, error } = await supabase
            .from('terminals')
            .insert([
                { branch_id, name, connection_url, terminal_secret }
            ])
            .select()
            .single();

        await logAudit({
            action: 'CREATE',
            entity: 'terminals',
            entityId: data.id,
            details: { name, branch_id, connection_url },
            req: request
        });

        return successResponse(data, 201, 'Terminal registered successfully');
    } catch (error) {
        return handleApiError(error, 'POST /api/terminals');
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
            .from('terminals')
            .update({
                is_active: false,
                deleted_at: new Date().toISOString()
            })
            .eq('id', id);

        await logAudit({
            action: 'DELETE',
            entity: 'terminals',
            entityId: id,
            details: { is_active: false },
            req: request
        });

        return successResponse({ id }, 200, 'Terminal deactivated successfully');
    } catch (error) {
        return handleApiError(error, 'DELETE /api/terminals');
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
                .from('terminals')
                .update({
                    deleted_at: null,
                    is_active: true
                })
                .eq('id', id);

            if (error) throw error;

            await logAudit({
                action: 'RESTORE',
                entity: 'terminals',
                entityId: id,
                details: { restored_at: new Date().toISOString() },
                req: request
            });

            return successResponse({ id }, 200, 'Terminal restored successfully');
        }

        return NextResponse.json({ message: 'No action taken' });
    } catch (error) {
        return handleApiError(error, 'PATCH /api/terminals');
    }
}

