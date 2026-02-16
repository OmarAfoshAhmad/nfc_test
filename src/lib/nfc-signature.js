/**
 * NFC Signature Utility
 * 
 * Unified module for generating and verifying NFC card signatures.
 * Uses HMAC-SHA256 with a secret key to create tamper-proof signatures.
 */

import crypto from 'crypto';

/**
 * الحصول على مفتاح التوقيع مع التحقق
 * يتم التحقق وقت التشغيل وليس وقت البناء
 */
function getSecret() {
    const NFC_SECRET = process.env.NFC_SIGNATURE_SECRET;

    if (!NFC_SECRET) {
        throw new Error('NFC_SIGNATURE_SECRET environment variable is required');
    }

    if (NFC_SECRET.length < 32) {
        console.warn('⚠️ Warning: NFC_SIGNATURE_SECRET should be at least 32 characters for security');
    }

    return NFC_SECRET;
}

/**
 * توليد توقيع للبطاقة
 * 
 * @param {string} uid - معرف البطاقة الفريد
 * @returns {string} التوقيع بصيغة HEX (32 حرف = 16 بايت)
 * 
 * Format: "YAME" (4 bytes) + HMAC-SHA256(UID, secret).slice(0, 12 bytes)
 * Result: 32 hex characters (16 bytes total)
 */
export function generateSignature(uid) {
    if (!uid) {
        throw new Error('UID is required for signature generation');
    }

    const NFC_SECRET = getSecret();
    const normalizedUid = uid.toUpperCase();
    const hmac = crypto.createHmac('sha256', NFC_SECRET);
    hmac.update(normalizedUid);
    const hash = hmac.digest('hex');

    // Magic Header "YAME" in hex: 59 41 4D 45
    // Plus first 24 hex chars (12 bytes) of hash
    return "59414D45" + hash.substring(0, 24).toUpperCase();
}

/**
 * توليد توقيع كـ Buffer للكتابة على البطاقة
 * 
 * @param {string} uid - معرف البطاقة الفريد
 * @returns {Buffer} التوقيع كـ Buffer (16 بايت)
 */
export function generateSignatureBuffer(uid) {
    if (!uid) {
        throw new Error('UID is required for signature generation');
    }

    const NFC_SECRET = getSecret();
    const normalizedUid = uid.toUpperCase();
    const hmac = crypto.createHmac('sha256', NFC_SECRET);
    hmac.update(normalizedUid);
    const hash = hmac.digest('hex');

    return Buffer.concat([
        Buffer.from('YAME'),
        Buffer.from(hash, 'hex').slice(0, 12)
    ]);
}

/**
 * التحقق من صحة التوقيع
 * 
 * @param {string} uid - معرف البطاقة
 * @param {string} signature - التوقيع بصيغة HEX
 * @returns {boolean} هل التوقيع صحيح
 */
export function verifySignature(uid, signature) {
    if (!uid || !signature) return false;

    const expected = generateSignature(uid);
    return signature.toUpperCase() === expected.toUpperCase();
}

/**
 * التحقق من صحة التوقيع كـ Buffer
 * 
 * @param {string} uid - معرف البطاقة
 * @param {Buffer} data - البيانات المقروءة من البطاقة
 * @returns {boolean} هل التوقيع صحيح
 */
export function verifySignatureBuffer(uid, data) {
    if (!uid || !data || data.length < 16) return false;

    // Check Magic Header "YAME"
    if (data.slice(0, 4).toString() !== 'YAME') return false;

    // Verify Hash
    const expected = generateSignatureBuffer(uid);
    return Buffer.compare(data.slice(0, 16), expected) === 0;
}

export default {
    generateSignature,
    generateSignatureBuffer,
    verifySignature,
    verifySignatureBuffer
};
