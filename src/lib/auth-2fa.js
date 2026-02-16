import { authenticator } from 'otplib';
import QRCode from 'qrcode';

// Configure authenticator
authenticator.options = {
    window: 1, // Allow 1 step before/after for clock drift
    step: 30   // Default step
};

/**
 * Generate a new 2FA secret and QR code for a user
 * @param {string} email User email (for label)
 * @returns {Promise<{secret: string, qrCode: string, otpauth: string}>}
 */
export async function generateTwoFactorSecret(email) {
    const secret = authenticator.generateSecret();
    const serviceName = 'NFC Discount System'; // App name

    const otpauth = authenticator.keyuri(email, serviceName, secret);

    // Generate QR Code Data URL
    const qrCode = await QRCode.toDataURL(otpauth);

    return {
        secret,
        qrCode,
        otpauth
    };
}

/**
 * Verify a token against a secret
 * @param {string} token usage code from app
 * @param {string} secret stored secret
 * @returns {boolean} valid or not
 */
export function verifyTwoFactorToken(token, secret) {
    try {
        return authenticator.check(token, secret);
    } catch (err) {
        console.error('Token verification error:', err);
        return false;
    }
}
