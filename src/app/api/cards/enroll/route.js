// Force rebuild: v5 - Security Update
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { successResponse, handleApiError } from '@/lib/errorHandler';
import { logAudit } from '@/lib/audit';
import { generateSignature } from '@/lib/nfc-signature';

export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    // Handle different session structures (JWT payload vs Supabase session)
    const userId = session.user?.id || session.id || session.sub;
    const userRole = session.role || session.user?.role;

    if (!userId) {
        return NextResponse.json({ message: 'Unauthorized: Invalid Session Structure' }, { status: 401 });
    }

    // التحقق من صلاحية المستخدم لتسجيل البطاقات
    if (!['admin', 'superadmin'].includes(userRole)) {
        return NextResponse.json({
            message: 'Forbidden: Only admins can enroll cards'
        }, { status: 403 });
    }

    // Ensure Admin Client is available
    if (!supabaseAdmin) {
        return NextResponse.json({ message: 'Server Misconfiguration: Missing Service Role Key' }, { status: 500 });
    }

    try {
        const body = await request.json();
        const { uid, customer_id } = body;

        if (!uid) {
            return NextResponse.json({ message: 'UID is required' }, { status: 400 });
        }

        // Validate customer_id is a valid UUID
        const isValidUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        let validCustomerId = customer_id;
        if (customer_id && !isValidUuid(customer_id)) {
            console.warn(`Invalid UUID for customer_id: ${customer_id}. Treating as null.`);
            validCustomerId = null;
        }

        // 1. Generate Signature using unified module (Yamen Protocol)
        const signature = generateSignature(uid);

        // 2. Check if card exists (Using Admin Client to bypass RLS)
        const { data: existingCard } = await supabaseAdmin
            .from('cards')
            .select('*')
            .eq('uid', uid)
            .maybeSingle();

        let cardResult;

        if (existingCard) {
            // Update existing card
            const updates = {
                signature,
                enrolled_at: new Date().toISOString(),
                enrolled_by: userId,
                is_active: true,
                deleted_at: null
            };

            // Only update customer_id if provided explicitly
            if (customer_id !== undefined) {
                updates.customer_id = validCustomerId;
            }

            const { data, error } = await supabaseAdmin
                .from('cards')
                .update(updates)
                .eq('uid', uid)
                .select()
                .single();

            if (error) throw error;
            cardResult = data;
        } else {
            // Create new card
            const { data, error } = await supabaseAdmin
                .from('cards')
                .insert({
                    uid,
                    customer_id: validCustomerId, // Use the validated ID (or null)
                    signature,
                    enrolled_at: new Date().toISOString(),
                    enrolled_by: userId,
                    is_active: true,
                    // Set default expiry 2 months (60 days) from now
                    expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
                })
                .select()
                .single();

            if (error) throw error;
            cardResult = data;
        }

        // 3. Log Audit
        await logAudit({
            action: 'ENROLL_CARD',
            entity: 'cards',
            entityId: cardResult.id,
            details: { uid, customer_id, signature_generated: true },
            req: request
        });

        return successResponse({
            uid,
            signature,
            success: true,
            message: 'Card enrolled successfully'
        });

    } catch (error) {
        console.error('Enrollment API Error:', error);
        return NextResponse.json({
            success: false,
            message: error.message || 'Server Error',
            details: error.details,
            hint: error.hint
        }, { status: 500 });
    }
}
