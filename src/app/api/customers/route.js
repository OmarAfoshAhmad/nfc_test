import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { customerSchema } from '@/lib/schemas';
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/rateLimit';
import { handleApiError, validationError, successResponse, createdResponse } from '@/lib/errorHandler';
import { apiLogger } from '@/lib/logger';
import { logAudit } from '@/lib/audit';
import { enforceMaintenance } from '@/lib/maintenance';

export async function GET(request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        // Apply rate limiting
        const rateLimit = await rateLimitMiddleware(RATE_LIMITS.READ)(request, '/api/customers');
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { message: rateLimit.message },
                {
                    status: 429,
                    headers: {
                        'X-RateLimit-Limit': RATE_LIMITS.READ.maxAttempts.toString(),
                        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
                        'X-RateLimit-Reset': rateLimit.resetAt.toISOString()
                    }
                }
            );
        }

        const url = new URL(request.url);
        const search = url.searchParams.get('search') || '';
        const showDeleted = url.searchParams.get('deleted') === 'true';

        let query = supabase
            .from('customers')
            .select(`
                *,
                cards (
                    uid,
                    is_active
                )
            `);

        if (showDeleted) {
            query = query.not('deleted_at', 'is', null);
        } else {
            query = query.is('deleted_at', null);
        }

        if (search) {
            query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        // Map cards to single UID string for simpler frontend usage
        // Note: Relation is One-to-Many but usually we handle one active card per customer for display
        const rows = data.map(c => ({
            ...c,
            // If cards array exists and has length, pick the first (or active) one
            card_uid: c.cards?.length > 0 ? c.cards[0].uid : null,
            has_card: c.cards?.length > 0
        }));

        apiLogger.info('Customers retrieved', { count: rows.length, search });

        return successResponse(rows, 200, null);

    } catch (error) {
        return handleApiError(error, 'GET /api/customers');
    }
}

export async function POST(request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        // Enforce Maintenance Mode
        const maintenance = await enforceMaintenance(session);
        if (maintenance) return maintenance;

        // Apply rate limiting
        const rateLimit = await rateLimitMiddleware(RATE_LIMITS.API)(request, '/api/customers');
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { message: rateLimit.message },
                {
                    status: 429,
                    headers: {
                        'X-RateLimit-Limit': RATE_LIMITS.API.maxAttempts.toString(),
                        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
                        'X-RateLimit-Reset': rateLimit.resetAt.toISOString()
                    }
                }
            );
        }

        const body = await request.json();

        // Validate input
        const validation = customerSchema.safeParse(body);
        if (!validation.success) {
            throw validationError('Invalid input', validation.error.flatten().fieldErrors);
        }

        const { full_name, phone, email, uid, type } = validation.data;

        // 1. Create Customer
        const { data: customer, error: custError } = await supabase
            .from('customers')
            .insert([{ full_name, phone, email, type }])
            .select()
            .single();

        if (custError) throw custError;
        const customerId = customer.id;

        // 2. Handle Card Linkage if UID provided
        if (uid) {
            // Check if card exists
            const { data: existingCard } = await supabase
                .from('cards')
                .select('id, customer_id')
                .eq('uid', uid)
                .maybeSingle();

            if (existingCard) {
                if (existingCard.customer_id) {
                    // Card is already assigned to someone else
                    return NextResponse.json({ message: 'Card already assigned to another customer' }, { status: 400 });
                } else {
                    // Link existing card to this new customer
                    const { error: linkError } = await supabase
                        .from('cards')
                        .update({ customer_id: customerId, is_active: true })
                        .eq('id', existingCard.id);

                    if (linkError) throw linkError;
                }
            } else {
                // Create new card
                const { error: cardError } = await supabase
                    .from('cards')
                    .insert([{ uid, customer_id: customerId, is_active: true }]);

                if (cardError) throw cardError;
            }
        }

        await logAudit({
            action: 'CREATE',
            entity: 'customers',
            entityId: customerId,
            details: { full_name, phone, email, has_card: !!uid },
            req: request
        });

        return createdResponse(
            { id: customerId, full_name, phone, email, uid },
            'Customer created successfully'
        );

    } catch (error) {
        return handleApiError(error, 'POST /api/customers');
    }
}

export async function PATCH(request) {
    try {
        if (!session || session.role !== 'admin') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // Enforce Maintenance Mode
        const maintenance = await enforceMaintenance(session);
        if (maintenance) return maintenance;

        const body = await request.json();
        const { id, restore } = body;

        if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

        if (restore) {
            const { error } = await supabase
                .from('customers')
                .update({ deleted_at: null })
                .eq('id', id);

            if (error) throw error;

            await logAudit({
                action: 'RESTORE',
                entity: 'customers',
                entityId: id,
                details: { restored_at: new Date().toISOString() },
                req: request
            });

            return successResponse({ id }, 200, 'Customer restored successfully');
        }

        return NextResponse.json({ message: 'No action taken' });
    } catch (error) {
        return handleApiError(error, 'PATCH /api/customers');
    }
}
