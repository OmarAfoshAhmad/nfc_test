/**
 * Simple In-Memory Cache
 * 
 * Provides caching functionality for frequently accessed data like settings.
 * Uses TTL (Time To Live) to automatically expire cached entries.
 */

import { CACHE } from './constants.js';

class SimpleCache {
    constructor() {
        this.cache = new Map();
        this.timers = new Map();
    }

    /**
     * Set a value in the cache with optional TTL
     * 
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {number} ttl - Time to live in seconds (default from constants)
     */
    set(key, value, ttl = CACHE.SETTINGS_TTL) {
        // Clear existing timer if any
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }

        // Set the value
        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            ttl: ttl * 1000 // Convert to milliseconds
        });

        // Set expiration timer
        const timer = setTimeout(() => {
            this.delete(key);
        }, ttl * 1000);

        this.timers.set(key, timer);
    }

    /**
     * Get a value from the cache
     * 
     * @param {string} key - Cache key
     * @returns {any|null} Cached value or null if not found/expired
     */
    get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        // Check if expired
        const age = Date.now() - entry.timestamp;
        if (age > entry.ttl) {
            this.delete(key);
            return null;
        }

        return entry.value;
    }

    /**
     * Check if a key exists in the cache
     * 
     * @param {string} key - Cache key
     * @returns {boolean}
     */
    has(key) {
        return this.get(key) !== null;
    }

    /**
     * Delete a key from the cache
     * 
     * @param {string} key - Cache key
     */
    delete(key) {
        // Clear timer
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }

        // Delete from cache
        this.cache.delete(key);
    }

    /**
     * Clear all cached entries
     */
    clear() {
        // Clear all timers
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }

        this.timers.clear();
        this.cache.clear();
    }

    /**
     * Get cache statistics
     * 
     * @returns {Object} Cache stats
     */
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }

    /**
     * Get or set pattern - fetch from cache or execute function and cache result
     * 
     * @param {string} key - Cache key
     * @param {Function} fetchFn - Async function to fetch data if not cached
     * @param {number} ttl - Time to live in seconds
     * @returns {Promise<any>} Cached or fetched value
     */
    async getOrSet(key, fetchFn, ttl = CACHE.SETTINGS_TTL) {
        // Try to get from cache first
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }

        // Fetch and cache
        const value = await fetchFn();
        this.set(key, value, ttl);
        return value;
    }
}

// Create singleton instance
const cache = new SimpleCache();

export default cache;

/**
 * Cache key generators for common use cases
 */
export const CacheKeys = {
    SETTINGS: 'system:settings',
    SETTINGS_BY_KEY: (key) => `settings:${key}`,
    CUSTOMER: (id) => `customer:${id}`,
    DISCOUNT: (id) => `discount:${id}`,
    ACTIVE_DISCOUNTS: 'discounts:active',
};
