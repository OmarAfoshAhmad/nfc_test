import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

/**
 * Logs an action to the audit_logs table.
 * @param {Object} params
 * @param {string} params.action - CREATE, UPDATE, DELETE, RESTORE, etc.
 * @param {string} params.entity - Table name (campaigns, cards, etc.)
 * @param {string} params.entityId - ID of the affected record
 * @param {Object} params.details - JSON object with details (diff, snapshots)
 */
export async function logAudit({ action, entity, entityId, details, req }) {
    try {
        const session = await getSession();
        let ip = 'unknown';

        // Try to get IP from request headers if provided
        if (req) {
            ip = req.headers.get('x-forwarded-for') || 'unknown';
        }

        const { error } = await supabaseAdmin.from('audit_logs').insert([{
            admin_id: session?.id || null,
            admin_email: session?.username || 'system',
            action_type: action,
            entity_name: entity,
            entity_id: entityId?.toString(),
            details: details || {},
            ip_address: ip
        }]);

        if (error) {
            console.error('FAILED TO LOG AUDIT:', error);
        }
    } catch (err) {
        console.error('AUDIT LOG EXCEPTION:', err);
    }
}
