import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const uid = body.uid ? body.uid.toUpperCase() : null;

        if (!uid) return NextResponse.json({ message: 'UID is required' }, { status: 400 });

        // ✅ SECURITY CHECK 1: Verify card exists and is signed
        const { data: card, error: cardError } = await supabaseAdmin
            .from('cards')
            .select('uid, metadata, customer_id')
            .eq('uid', uid)
            .eq('is_active', true)
            .is('deleted_at', null)
            .maybeSingle();

        if (cardError) throw cardError;

        if (!card) {
            return NextResponse.json({
                status: 'error',
                message: 'Card not found'
            }, { status: 404 });
        }

        // ✅ SECURITY CHECK 2: Verify card is signed before revoking
        const metadata = typeof card.metadata === 'string'
            ? JSON.parse(card.metadata)
            : (card.metadata || {});

        if (!metadata.secured) {
            return NextResponse.json({
                status: 'error',
                message: 'Card is not signed - cannot revoke',
                code: 'CARD_NOT_SIGNED'
            }, { status: 400 });
        }

        // ✅ Revoke signature by updating metadata
        const { data: updatedCard, error: updateError } = await supabaseAdmin
            .from('cards')
            .update({
                signature: null, // Wipe the signature from DB
                metadata: {
                    ...metadata,
                    secured: false,
                    signature_valid: false,
                    revoked_at: new Date().toISOString(),
                    revoked_by: session.id
                }
            })
            .eq('uid', uid)
            .select()
            .single();

        if (updateError) throw updateError;

        // 📝 Log audit
        await logAudit({
            admin_id: session.id,
            action: 'update',
            entity: 'cards',
            entity_id: card.uid,
            details: `Revoked signature for card ${card.uid}`
        });

        return NextResponse.json({
            status: 'success',
            message: 'Signature revoked successfully',
            card: updatedCard
        });

    } catch (error) {
        console.error('Revoke Signature Error:', error);
        return NextResponse.json({
            status: 'error',
            message: error.message || 'Failed to revoke signature'
        }, { status: 500 });
    }
}
