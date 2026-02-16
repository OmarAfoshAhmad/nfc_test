import { generateTwoFactorSecret, verifyTwoFactorToken } from '../auth-2fa';
import { authenticator } from 'otplib';

// Mock otplib to avoid timing issues in tests
jest.mock('otplib', () => ({
    authenticator: {
        generateSecret: jest.fn(() => 'MOCK_SECRET'),
        keyuri: jest.fn(() => 'otpauth://totp/Test?secret=MOCK_SECRET'),
        check: jest.fn(),
        options: {}
    }
}));

// Mock qrcode
jest.mock('qrcode', () => ({
    toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mockqr')
}));

describe('2FA Utilities', () => {
    describe('generateTwoFactorSecret', () => {
        it('should return secret and QR code', async () => {
            const result = await generateTwoFactorSecret('test@example.com');

            expect(result.secret).toBe('MOCK_SECRET');
            expect(result.qrCode).toBe('data:image/png;base64,mockqr');
            expect(result.otpauth).toContain('otpauth://');
        });
    });

    describe('verifyTwoFactorToken', () => {
        it('should return true for valid token', () => {
            const { authenticator } = require('otplib');
            authenticator.check.mockReturnValue(true);

            expect(verifyTwoFactorToken('123456', 'SECRET')).toBe(true);
        });

        it('should return false for invalid token', () => {
            const { authenticator } = require('otplib');
            authenticator.check.mockReturnValue(false);

            expect(verifyTwoFactorToken('000000', 'SECRET')).toBe(false);
        });

        it('should handle errors gracefully', () => {
            const { authenticator } = require('otplib');
            authenticator.check.mockImplementation(() => { throw new Error('Invalid base32'); });

            expect(verifyTwoFactorToken('invalid', 'SECRET')).toBe(false);
        });
    });
});
