/**
 * Rate Limiting Utility (Supabase Version)
 * 
 * Provides rate limiting functionality for API routes to prevent abuse.
 * Uses Supabase-backed storage for distributed rate limiting.
 */

import { supabase } from '@/lib/supabase';
import { apiLogger } from './logger.js';

/**
 * Rate limit configuration presets
 */
export const RATE_LIMITS = {
    // Strict limits for authentication endpoints
    AUTH: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxAttempts: 5,
        message: 'Too many attempts. Please try again later.'
    },

    // Moderate limits for API endpoints
    API: {
        windowMs: 60 * 1000, // 1 minute
        maxAttempts: 30,
        message: 'Too many requests. Please slow down.'
    },

    // Lenient limits for read operations
    READ: {
        windowMs: 60 * 1000, // 1 minute
        maxAttempts: 100,
        message: 'Rate limit exceeded. Please try again later.'
    }
};

/**
 * Check if request should be rate limited
 * 
 * @param {string} identifier - Unique identifier (IP address, user ID, etc.)
 * @param {string} endpoint - API endpoint being accessed
 * @param {Object} config - Rate limit configuration
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: Date}>}
 */
export async function checkRateLimit(identifier, endpoint, config = RATE_LIMITS.API) {
    const key = `${endpoint}:${identifier}`;
    const now = new Date();
    const windowStart = new Date(now.getTime() - config.windowMs);

    try {
        // Clean up old entries (older than window)
        // Note: In Supabase, we do this as needed to keep the table lean.
        await supabase
            .from('rate_limits')
            .delete()
            .lt('window_start', windowStart.toISOString());

        // Get current rate limit status
        const { data: record, error: fetchError } = await supabase
            .from('rate_limits')
            .select('*')
            .eq('key_name', key)
            .gte('window_start', windowStart.toISOString())
            .maybeSingle();

        if (fetchError) throw fetchError;

        let attemptCount = 0;
        let resetAt = new Date(now.getTime() + config.windowMs);

        if (record) {
            attemptCount = record.attempt_count;
            resetAt = new Date(new Date(record.window_start).getTime() + config.windowMs);

            // Increment attempt count
            const { error: updateError } = await supabase
                .from('rate_limits')
                .update({
                    attempt_count: record.attempt_count + 1,
                    last_attempt: now.toISOString()
                })
                .eq('id', record.id);

            if (updateError) throw updateError;
            attemptCount++;
        } else {
            // Create new rate limit record
            const { error: insertError } = await supabase
                .from('rate_limits')
                .insert([
                    { key_name: key, attempt_count: 1, window_start: now.toISOString(), last_attempt: now.toISOString() }
                ]);

            if (insertError) throw insertError;
            attemptCount = 1;
        }

        const allowed = attemptCount <= config.maxAttempts;
        const remaining = Math.max(0, config.maxAttempts - attemptCount);

        return {
            allowed,
            remaining,
            resetAt,
            message: allowed ? null : config.message
        };

    } catch (error) {
        apiLogger.error('Rate limit check error', error);
        // 🔒 On error, DENY the request (fail closed) - security first
        // This prevents abuse during database outages
        return {
            allowed: false,
            remaining: 0,
            resetAt: new Date(now.getTime() + config.windowMs),
            message: 'Service temporarily unavailable. Please try again later.'
        };
    }
}

/**
 * Middleware factory for rate limiting
 * 
 * @param {Object} config - Rate limit configuration
 * @returns {Function} Middleware function
 */
export function rateLimitMiddleware(config = RATE_LIMITS.API) {
    return async (request, endpoint) => {
        // Get identifier (IP address or user ID)
        const ip = request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'unknown';

        const result = await checkRateLimit(ip, endpoint, config);

        return result;
    };
}

/**
 * Reset rate limit for a specific identifier and endpoint
 * Useful for testing or manual intervention
 * 
 * @param {string} identifier - Unique identifier
 * @param {string} endpoint - API endpoint
 */
export async function resetRateLimit(identifier, endpoint) {
    const key = `${endpoint}:${identifier}`;

    try {
        const { error } = await supabase
            .from('rate_limits')
            .delete()
            .eq('key_name', key);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error resetting rate limit:', error);
        return false;
    }
}
