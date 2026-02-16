import { supabase } from '@/lib/supabase';
import cache, { CacheKeys } from '@/lib/cache';
import { LOYALTY } from '@/lib/constants';

/**
 * Fetch system settings from the database with caching
 * @returns {Promise<Object>} Object containing key-value pairs of settings
 */
export async function getSystemSettings() {
    // Try to get from cache first
    return await cache.getOrSet(
        CacheKeys.SETTINGS,
        async () => {
            try {
                const { data: rows, error } = await supabase.from('settings').select('*');
                if (error) throw error;

                const settings = {};
                rows.forEach(row => {
                    settings[row.key_name] = row.value;
                });

                // Defaults if missing
                return {
                    currency_symbol: settings.currency_symbol || LOYALTY.DEFAULT_CURRENCY,
                    store_name: settings.store_name || 'NFC Discount',
                    logo_url: settings.logo_url || null,
                    ...settings
                };
            } catch (error) {
                console.error('Error fetching settings:', error);
                return {
                    currency_symbol: LOYALTY.DEFAULT_CURRENCY
                };
            }
        }
    );
}

/**
 * calculatePoints - Removed
 */
export async function calculatePoints() {
    return 0;
}

/**
 * logPoints - Removed
 */
export async function logPoints() {
    return;
}
