import { supabaseAdmin, supabase } from './supabase';

/**
 * Checks if the system is currently in maintenance mode.
 * Returns true if maintenance is active and the user is NOT a developer.
 * @param {Object} session - The current user session
 */
export async function isMaintenanceActive(session = null) {
    try {
        // Bypass for superadmin or dev_admin username
        if (session?.role?.toLowerCase() === 'superadmin' || session?.username === 'dev_admin') {
            return false;
        }

        // Fetch maintenance_mode from settings
        // Use supabaseAdmin to ensure we can read settings even if RLS is tight
        const { data, error } = await (supabaseAdmin || supabase)
            .from('settings')
            .select('value')
            .eq('key_name', 'maintenance_mode')
            .single();

        if (error) {
            // If settings table is missing or error occurs, assume safe (false)
            // unless we want to fail-closed (true)
            return false;
        }

        return data?.value === 'true';
    } catch (err) {
        console.error('Maintenance check error:', err);
        return false;
    }
}

/**
 * Middleware-like helper for API routes
 * Returns a NextResponse if maintenance is active, otherwise null
 */
export async function enforceMaintenance(session = null) {
    const active = await isMaintenanceActive(session);
    if (active) {
        return Response.json({
            message: 'System is currently under maintenance. Please try again later.',
            errorCode: 'MAINTENANCE_MODE_ACTIVE'
        }, { status: 503 });
    }
    return null;
}
