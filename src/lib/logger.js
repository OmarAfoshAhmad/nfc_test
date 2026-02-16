/**
 * Logging Utility
 * 
 * Provides structured logging with different levels and contexts.
 * In production, logs can be sent to external services.
 */

import { ENV } from './constants.js';

// Log levels
const LOG_LEVELS = {
    ERROR: 'ERROR',
    WARN: 'WARN',
    INFO: 'INFO',
    DEBUG: 'DEBUG',
};

// Colors for console output (development only)
const COLORS = {
    ERROR: '\x1b[31m', // Red
    WARN: '\x1b[33m',  // Yellow
    INFO: '\x1b[36m',  // Cyan
    DEBUG: '\x1b[90m', // Gray
    RESET: '\x1b[0m',
};

class Logger {
    constructor(context = 'APP') {
        this.context = context;
    }

    /**
     * Format log message
     */
    _format(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            context: this.context,
            message,
            ...(data && { data }),
            ...(ENV.isDevelopment && { env: 'development' })
        };

        return logEntry;
    }

    /**
     * Output log to console
     */
    _output(level, logEntry) {
        if (ENV.isDevelopment) {
            // Colorful console output in development
            const color = COLORS[level] || COLORS.RESET;
            console.log(
                `${color}[${logEntry.timestamp}] [${level}] [${this.context}]${COLORS.RESET}`,
                logEntry.message,
                logEntry.data || ''
            );
        } else {
            // JSON output in production (for log aggregation services)
            console.log(JSON.stringify(logEntry));
        }
    }

    /**
     * Log error message
     */
    error(message, error = null) {
        const data = error ? {
            message: error.message,
            stack: error.stack,
            code: error.code,
            ...(error.details && { details: error.details })
        } : null;

        const logEntry = this._format(LOG_LEVELS.ERROR, message, data);
        this._output(LOG_LEVELS.ERROR, logEntry);
    }

    /**
     * Log warning message
     */
    warn(message, data = null) {
        const logEntry = this._format(LOG_LEVELS.WARN, message, data);
        this._output(LOG_LEVELS.WARN, logEntry);
    }

    /**
     * Log info message
     */
    info(message, data = null) {
        const logEntry = this._format(LOG_LEVELS.INFO, message, data);
        this._output(LOG_LEVELS.INFO, logEntry);
    }

    /**
     * Log debug message (only in development)
     */
    debug(message, data = null) {
        if (ENV.isDevelopment) {
            const logEntry = this._format(LOG_LEVELS.DEBUG, message, data);
            this._output(LOG_LEVELS.DEBUG, logEntry);
        }
    }

    /**
     * Create a child logger with a new context
     */
    child(childContext) {
        return new Logger(`${this.context}:${childContext}`);
    }
}

// Create default logger instance
const logger = new Logger('APP');

// Export logger factory
export function createLogger(context) {
    return new Logger(context);
}

// Export default logger
export default logger;

// Export specific loggers for common contexts
export const authLogger = new Logger('AUTH');
export const dbLogger = new Logger('DATABASE');
export const apiLogger = new Logger('API');
export const nfcLogger = new Logger('NFC');
