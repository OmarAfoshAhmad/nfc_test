const { NFC } = require('nfc-pcsc');
const crypto = require('crypto');
const { promisify } = require('util');

const nfc = new NFC();

// [SECURITY] Fixed Secret Key (Must match the Bridge)
// تم توحيد المفتاح مع الجسر لضمان التوافق
const YAMEN_SECRET = "e18105f3642bcb546d0790eafef801219c9602915e42413a1e62fffa43434100";
const SECTOR_BLOCK = 4;

if (!YAMEN_SECRET || YAMEN_SECRET.length < 32) {
    console.error('❌ CRITICAL: YAMEN_SECRET missing!');
    process.exit(1);
}

console.log('================================================');
console.log('   🔐 YAMEN CARD INJECTOR v2.0 (FIXED)');
console.log('   نظام حقن البطاقات - الإصدار المصحح');
console.log('================================================');
console.log('   Purpose: Inject "yamen" signature into cards');
console.log('   الهدف: كتابة التوقيع الرقمي على البطاقة');
console.log('   Do NOT remove card until "SUCCESS" is shown.');
console.log('================================================\n');

console.log('⏳ Waiting for card to inject... (بانتظار البطاقة)');

// Helper to generate signature
function generateSignature(uid) {
    const hmac = crypto.createHmac('sha256', YAMEN_SECRET);
    hmac.update(uid);
    const hash = hmac.digest('hex');
    // Magic: 0x59 0x41 0x4D 0x45 (YAME) + 12 bytes Hash
    return Buffer.concat([
        Buffer.from('YAME'),
        Buffer.from(hash, 'hex').slice(0, 12)
    ]);
}

nfc.on('reader', reader => {
    console.log(`\n📡 Found reader: ${reader.name}`);

    reader.on('card', async card => {
        const uid = card.uid.toUpperCase();
        console.log(`\n🎴 Card detected: ${uid}`);
        console.log('   Processing injection... (جاري الحقن)');

        try {
            const signature = generateSignature(uid);
            // console.log(`   Signature: ${signature.toString('hex').toUpperCase()}`);

            let success = false;

            // --- ATTEMPT 1: AUTHENTICATED WRITE (Mifare Classic) ---
            try {
                // Key Type A (0x60), Key Default (FFFFFFFFFFFF)
                // المصادقة ضرورية قبل الكتابة في البطاقات الكلاسيكية
                await reader.authenticate(SECTOR_BLOCK, 0x60, 'FFFFFFFFFFFF');
                await reader.write(SECTOR_BLOCK, signature, 16);
                success = true;
                console.log(`   ✅ Written using Authenticated Block Write (Standard)`);
                console.log(`   ✅ تم الحقن بنجاح (وضع المصادقة)`);
            } catch (err) {
                console.log(`   ⚠️ Auth/Write failed: ${err.message}`);
                console.log(`   ⚠️ فشلت الكتابة العادية، جاري تجربة النمط الثاني...`);

                // --- ATTEMPT 2: DIRECT PAGE WRITE (Ultralight / NTAG) ---
                try {
                    for (let i = 0; i < 4; i++) {
                        const pageData = signature.slice(i * 4, (i + 1) * 4);
                        await reader.write(SECTOR_BLOCK + i, pageData, 4);
                    }
                    success = true;
                    console.log(`   ✅ Written using Page Write (Ultralight)`);
                    console.log(`   ✅ تم الحقن بنجاح (وضع Ultralight)`);
                } catch (err2) {
                    console.error(`   ❌ Write failed: ${err2.message}`);
                }
            }

            if (success) {
                console.log('\n   🎉 SUCCESS! Card is now SECURED.');
                console.log('   🎉 نجاح! البطاقة الآن محمية وموقعة.');
                console.log('   You can verify it with the Bridge.');

                // Verify Read (Sanity Check)
                try {
                    // Re-authenticate just in case
                    try { await reader.authenticate(SECTOR_BLOCK, 0x60, 'FFFFFFFFFFFF'); } catch (e) { }
                    const data = await reader.read(SECTOR_BLOCK, 16);
                    if (data.slice(0, 4).toString() === 'YAME') {
                        console.log('   (Verification Read: OK)');
                    }
                } catch (e) { }

            } else {
                console.log('\n   ❌ INJECTION FAILED. Is the card locked?');
                console.log('   ❌ فشل الحقن. هل البطاقة مقفلة؟');
            }

        } catch (err) {
            console.error(`\n   ❌ ERROR: ${err.message}`);
        }
    });

    reader.on('card.off', () => {
        console.log('\n⏳ Waiting for next card... (بانتظار البطاقة التالية)');
    });

    reader.on('error', err => {
        console.error(`Reader error: ${err.message}`);
    });

    reader.on('end', () => {
        console.log('Reader removed');
    });
});

nfc.on('error', err => {
    console.error('NFC error', err);
});
