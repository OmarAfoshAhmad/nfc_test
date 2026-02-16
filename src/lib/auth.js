import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { AUTH, ENV } from './constants.js';
import { authLogger } from './logger.js';

// Validate JWT_SECRET exists - critical for security
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    const errorMsg = '🔴 CRITICAL: JWT_SECRET environment variable is not set. ' +
        'This is required for secure authentication. ' +
        'Please set JWT_SECRET in your .env file with a strong random value.';
    authLogger.error(errorMsg);
    throw new Error(errorMsg);
}

// Warn if JWT_SECRET appears to be weak (in development)
if (ENV.isDevelopment && JWT_SECRET.length < 32) {
    authLogger.warn(
        'JWT_SECRET is shorter than 32 characters. ' +
        'For production, use a strong random secret of at least 32 characters.'
    );
}

export function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: AUTH.JWT_EXPIRY });
}

export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

export async function getSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;
    return verifyToken(token);
}
