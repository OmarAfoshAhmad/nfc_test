import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * External Scan API - For standalone NFC readers
 * No session required - uses Terminal ID validation
 */
export async function POST(request) {
    try {
        const { uid, terminal_id } = await request.json();

        if (!uid) {
            return NextResponse.json({ message: 'UID is required' }, { status: 400 });
        }

        if (!terminal_id) {
            return NextResponse.json({ message: 'Terminal ID is required' }, { status: 400 });
        }

        // Validate Terminal exists and is active
        const { data: terminal, error: terminalError } = await supabaseAdmin
            .from('terminals')
            .select('*')
            .eq('id', terminal_id)
            .eq('is_active', true)
            .maybeSingle();

        if (terminalError || !terminal) {
            return NextResponse.json({
                message: 'Invalid or inactive terminal',
                status: 'error'
            }, { status: 403 });
        }

        // Find the card
        const { data: card, error: cardError } = await supabaseAdmin
            .from('cards')
            .select('*')
            .eq('uid', uid)
            .eq('is_active', true)
            .is('deleted_at', null)
            .maybeSingle();

        if (cardError) {
            console.error('Card lookup error:', cardError);
            return NextResponse.json({
                message: 'Database error',
                status: 'error'
            }, { status: 500 });
        }

        if (!card) {
            // Create scan event for unknown card
            await supabaseAdmin
                .from('scan_events')
                .insert({
                    uid,
                    terminal_id,
                    status: 'unknown_card',
                    scanned_at: new Date().toISOString()
                });

            return NextResponse.json({
                status: 'unknown_card',
                message: `Card not registered (${uid})`,
                uid
            });
        }

        // Check if card is signed (check metadata.secured which has the real signature status)
        const metadata = typeof card.metadata === 'string'
            ? JSON.parse(card.metadata)
            : (card.metadata || {});
        
        if (!metadata.secured) {
            // Create scan event for unsupported card
            await supabaseAdmin
                .from('scan_events')
                .insert({
                    uid,
                    terminal_id,
                    status: 'unsupported_card',
                    scanned_at: new Date().toISOString()
                });

            return NextResponse.json({
                status: 'unsupported_card',
                message: 'This card is not supported',
                uid
            });
        }

        // Get customer
        const { data: customer, error: custError } = await supabaseAdmin
            .from('customers')
            .select('*')
            .eq('id', card.customer_id)
            .is('deleted_at', null)
            .maybeSingle();

        if (custError || !customer) {
            return NextResponse.json({
                status: 'error',
                message: 'Customer not found'
            }, { status: 404 });
        }

        // Create scan event
        await supabaseAdmin
            .from('scan_events')
            .insert({
                uid,
                customer_id: customer.id,
                terminal_id,
                status: 'success',
                scanned_at: new Date().toISOString()
            });

        // Return customer data
        return NextResponse.json({
            status: 'success',
            customer: {
                id: customer.id,
                full_name: customer.full_name,
                phone: customer.phone,
                balance: customer.balance
            },
            card: {
                uid: card.uid
            },
            terminal: {
                id: terminal.id,
                name: terminal.name
            }
        });

    } catch (error) {
        console.error('External Scan API Error:', error);
        return NextResponse.json({
            message: 'Internal server error',
            status: 'error'
        }, { status: 500 });
    }
}
