/**
 * Application Constants
 * 
 * Centralized configuration values used throughout the application.
 * This makes it easier to maintain and update configuration.
 */

// ============================================================================
// Authentication & Security
// ============================================================================

export const AUTH = {
    // JWT token expiration time
    JWT_EXPIRY: '8h',

    // Cookie settings
    COOKIE_NAME: 'token',
    COOKIE_MAX_AGE: 60 * 60 * 8, // 8 hours in seconds

    // Login attempt limits
    MAX_LOGIN_ATTEMPTS: 5,
    LOGIN_LOCK_DURATION_MINUTES: 15,

    // Password requirements
    MIN_PASSWORD_LENGTH: 8,
    MIN_USERNAME_LENGTH: 3,
};

// ============================================================================
// Rate Limiting
// ============================================================================

export const RATE_LIMIT_WINDOWS = {
    // Authentication endpoints (strict)
    AUTH: {
        WINDOW_MS: 15 * 60 * 1000, // 15 minutes
        MAX_ATTEMPTS: 5,
    },

    // API endpoints (moderate)
    API: {
        WINDOW_MS: 60 * 1000, // 1 minute
        MAX_ATTEMPTS: 30,
    },

    // Read operations (lenient)
    READ: {
        WINDOW_MS: 60 * 1000, // 1 minute
        MAX_ATTEMPTS: 100,
    },
};

// ============================================================================
// Database
// ============================================================================

export const DATABASE = {
    // Connection pool settings
    CONNECTION_LIMIT: 10,
    QUEUE_LIMIT: 0,
    WAIT_FOR_CONNECTIONS: true,

    // Query limits
    DEFAULT_QUERY_LIMIT: 50,
    MAX_QUERY_LIMIT: 1000,
};

// ============================================================================
// Loyalty & Points
// ============================================================================

export const LOYALTY = {
    // Default points ratio (amount to earn 1 point)
    DEFAULT_POINTS_RATIO: 10,

    // Currency
    DEFAULT_CURRENCY: '€',

    // Points ledger reasons
    REASONS: {
        PURCHASE: 'Purchase Reward',
        REDEMPTION: 'Redeemed Reward',
        MANUAL_ADJUSTMENT: 'Manual Adjustment',
        BONUS: 'Bonus Points',
        EXPIRED: 'Points Expired',
    },
};

// ============================================================================
// NFC & WebSocket
// ============================================================================

export const NFC = {
    // WebSocket server port
    WS_PORT: process.env.WS_PORT || 8999,

    // Heartbeat interval (milliseconds)
    HEARTBEAT_INTERVAL: 30000, // 30 seconds

    // Connection timeout
    CONNECTION_TIMEOUT: 5000, // 5 seconds
};

// ============================================================================
// Caching
// ============================================================================

export const CACHE = {
    // Settings cache TTL (Time To Live) in seconds
    SETTINGS_TTL: 300, // 5 minutes

    // System info cache TTL
    SYSTEM_INFO_TTL: 600, // 10 minutes
};

// ============================================================================
// Pagination
// ============================================================================

export const PAGINATION = {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
};

// ============================================================================
// Discount Types
// ============================================================================

export const DISCOUNT_TYPES = {
    PERCENTAGE: 'percentage',
    FIXED_AMOUNT: 'fixed_amount',
    GIFT: 'gift',
};

// ============================================================================
// Transaction Status
// ============================================================================

export const TRANSACTION_STATUS = {
    SUCCESS: 'success',
    FAILED: 'failed',
    PENDING: 'pending',
};

// ============================================================================
// User Roles
// ============================================================================

export const USER_ROLES = {
    ADMIN: 'admin',
    STAFF: 'staff',
};

// ============================================================================
// HTTP Status Codes
// ============================================================================

export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
};

// ============================================================================
// Error Codes
// ============================================================================

export const ERROR_CODES = {
    // Authentication errors
    AUTH_INVALID_CREDENTIALS: 'AUTH_001',
    AUTH_TOKEN_EXPIRED: 'AUTH_002',
    AUTH_TOKEN_INVALID: 'AUTH_003',
    AUTH_ACCOUNT_LOCKED: 'AUTH_004',

    // Validation errors
    VALIDATION_FAILED: 'VAL_001',
    VALIDATION_MISSING_FIELD: 'VAL_002',

    // Database errors
    DB_CONNECTION_ERROR: 'DB_001',
    DB_QUERY_ERROR: 'DB_002',
    DB_DUPLICATE_ENTRY: 'DB_003',

    // Business logic errors
    INSUFFICIENT_POINTS: 'BIZ_001',
    CARD_NOT_FOUND: 'BIZ_002',
    CUSTOMER_NOT_FOUND: 'BIZ_003',
    DISCOUNT_NOT_FOUND: 'BIZ_004',
    DISCOUNT_EXPIRED: 'BIZ_005',

    // Rate limiting
    RATE_LIMIT_EXCEEDED: 'RATE_001',
};

// ============================================================================
// Environment
// ============================================================================

export const ENV = {
    isDevelopment: process.env.NODE_ENV !== 'production',
    isProduction: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',
};
