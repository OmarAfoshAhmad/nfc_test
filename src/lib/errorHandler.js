/**
 * Error Handler Utility
 * 
 * Provides centralized error handling and formatting for API responses.
 * Ensures consistent error messages and proper logging.
 */

import { NextResponse } from 'next/server';
import { ERROR_CODES, HTTP_STATUS } from './constants.js';

/**
 * Standard error response format
 */
class ApiError extends Error {
    constructor(message, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, errorCode = null, details = null) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.details = details;
    }
}

/**
 * Create a standardized error response
 * 
 * @param {Error|ApiError} error - The error object
 * @param {string} context - Context where the error occurred (for logging)
 * @returns {NextResponse} Formatted error response
 */
export function handleApiError(error, context = 'API') {
    // Log the error with context
    console.error(`[${context}] Error:`, {
        message: error.message,
        code: error.errorCode || 'UNKNOWN',
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });

    // Determine status code
    let statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    let errorCode = null;
    let message = 'An unexpected error occurred';
    let details = null;

    if (error instanceof ApiError) {
        statusCode = error.statusCode;
        errorCode = error.errorCode;
        message = error.message;
        details = error.details;
    } else if (error.code) {
        // Handle specific database errors
        switch (error.code) {
            case 'ER_DUP_ENTRY':
                statusCode = HTTP_STATUS.CONFLICT;
                errorCode = ERROR_CODES.DB_DUPLICATE_ENTRY;
                message = 'A record with this information already exists';
                break;

            case 'ECONNREFUSED':
            case 'HANDSHAKE_SSL_ERROR':
                statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
                errorCode = ERROR_CODES.DB_CONNECTION_ERROR;
                message = 'Database connection error';
                break;

            default:
                errorCode = ERROR_CODES.DB_QUERY_ERROR;
                message = 'Database operation failed';
        }
    }

    // Build response object
    const response = {
        success: false,
        message,
        ...(errorCode && { errorCode }),
        ...(details && { details }),
        ...(process.env.NODE_ENV !== 'production' && {
            debug: {
                originalMessage: error.message,
                stack: error.stack
            }
        })
    };

    return NextResponse.json(response, { status: statusCode });
}

/**
 * Validation error helper
 */
export function validationError(message, details = null) {
    return new ApiError(
        message,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_FAILED,
        details
    );
}

/**
 * Authentication error helper
 */
export function authError(message = 'Authentication required', errorCode = ERROR_CODES.AUTH_TOKEN_INVALID) {
    return new ApiError(
        message,
        HTTP_STATUS.UNAUTHORIZED,
        errorCode
    );
}

/**
 * Not found error helper
 */
export function notFoundError(resource = 'Resource') {
    return new ApiError(
        `${resource} not found`,
        HTTP_STATUS.NOT_FOUND
    );
}

/**
 * Rate limit error helper
 */
export function rateLimitError(resetAt) {
    return new ApiError(
        'Too many requests. Please try again later.',
        HTTP_STATUS.TOO_MANY_REQUESTS,
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        { resetAt }
    );
}

/**
 * Success response helper
 */
export function successResponse(data, statusCode = HTTP_STATUS.OK, message = null) {
    const response = {
        success: true,
        ...(message && { message }),
        ...(data !== undefined && { data })
    };

    return NextResponse.json(response, { status: statusCode });
}

/**
 * Created response helper (for POST requests)
 */
export function createdResponse(data, message = 'Resource created successfully') {
    return successResponse(data, HTTP_STATUS.CREATED, message);
}

/**
 * Async error wrapper for API routes
 * Automatically catches and handles errors
 */
export function asyncHandler(handler, context = 'API') {
    return async (...args) => {
        try {
            return await handler(...args);
        } catch (error) {
            return handleApiError(error, context);
        }
    };
}

// Export ApiError class for custom error throwing
export { ApiError };
