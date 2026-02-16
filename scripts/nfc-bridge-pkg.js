#!/usr/bin/env node

/**
 * ===================================================================
 * NFC CLOUD BRIDGE - STANDALONE VERSION (PACKAGED)
 * ===================================================================
 * 
 * Unified script to connect NFC reader to the cloud
 * Credentials are embedded. Configuration is external.
 * 
 * ===================================================================
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

// --- SEA COMPATIBILITY SHIM ---
// Node 25 SEA require() only supports built-in modules. 
// We must use createRequire to load external modules from disk.
const getCustomRequire = () => {
    try {
        // For SEA or standalone builds, always look for modules relative to the executable path
        const baseDir = path.dirname(process.execPath);
        return createRequire(path.join(baseDir, 'index.js'));
    } catch (e) {
        return require;
    }
};
const externalRequire = getCustomRequire();

// Use the externalRequire for modules marked as --external in esbuild
const { NFC } = externalRequire('nfc-pcsc');
const notifier = externalRequire('node-notifier');
const bindings = externalRequire('bindings');

// =====================================================
// 0. EMBEDDED CREDENTIALS (NO DOTENV)
// =====================================================

// [SECURITY] These keys are embedded for the standalone build
const SUPABASE_URL = "https://zdirmkypfxuamjbdkwhb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkaXJta3lwZnh1YW1qYmRrd2hiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE1MzgxNCwiZXhwIjoyMDgxNzI5ODE0fQ.CORI1-tLzRPgdqVYxY_HX6eGDasc0l8s9muSS-eGIuk"; // Using Service Role for full access
const YAMEN_SECRET = "e18105f3642bcb546d0790eafef801219c9602915e42413a1e62fffa43434100";

// =====================================================
// 1. TERMINAL CONFIGURATION (EXTERNAL FILE)
// =====================================================

// You can edit these values directly or via TERMINAL_CONFIGE.json
const DEFAULT_TERMINAL_CONFIG = {
    terminalId: 1,
    terminalName: 'Scanner-01'
};

const readline = require('readline');

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

async function loadTerminalConfig() {
    // For SEA/Pkg builds, we use the directory where the binary sits
    const execDir = path.dirname(process.execPath);

    // Support both names, prioritizing the one user requested
    const configPaths = [
        path.join(execDir, 'TERMINAL_CONFIGE.json'),
        path.join(execDir, 'terminal-config.json')
    ];

    for (const configPath of configPaths) {
        if (fs.existsSync(configPath)) {
            try {
                const configContent = fs.readFileSync(configPath, 'utf-8');
                const config = JSON.parse(configContent);
                console.log(`✅ Terminal config loaded from: ${configPath}`);
                return config;
            } catch (err) {
                console.warn(`⚠️ Failed to parse config at ${configPath}: ${err.message}`);
            }
        }
    }

    console.log('\n--- FIRST TIME SETUP ---');
    console.log('No configuration file found. Let\'s set up this terminal.');

    let terminalId = 1;
    let terminalName = 'New Scanner';

    try {
        const idInput = await askQuestion('Enter Terminal ID (default: 1): ');
        if (idInput.trim()) terminalId = parseInt(idInput.trim(), 10) || 1;

        const nameInput = await askQuestion('Enter Terminal Name (default: New Scanner): ');
        if (nameInput.trim()) terminalName = nameInput.trim();

        const config = { terminalId, terminalName };
        const newConfigPath = configPaths[0]; // Save to TERMINAL_CONFIGE.json

        fs.writeFileSync(newConfigPath, JSON.stringify(config, null, 2));
        console.log(`✅ Config saved to: ${newConfigPath}`);
        return config;
    } catch (err) {
        console.warn(`⚠️ Interaction failed, using defaults: ${err.message}`);
        return DEFAULT_TERMINAL_CONFIG;
    }
}

// =====================================================
// 3. LOAD CONFIGURATIONS
// =====================================================

// Global variables
let terminalId;
let terminalName;

async function bootstrap() {
    console.log('\n📂 Loading configuration files...\n');

    const terminalConfig = await loadTerminalConfig();

    terminalId = terminalConfig.terminalId || 1;
    terminalName = terminalConfig.terminalName || 'Default Terminal';

    // =====================================================
    // 4. SECURITY LOGIC (YAMEN PROTOCOL)
    // =====================================================

    const SECTOR_BLOCK = 4;

    if (!YAMEN_SECRET || YAMEN_SECRET.length < 32) {
        console.error('❌ CRITICAL: NFC_SIGNATURE_SECRET invalid in build!');
        process.exit(1);
    }

    function generateSignature(uid) {
        // Must match the logic in init-card.js
        const hmac = crypto.createHmac('sha256', YAMEN_SECRET);
        hmac.update(uid);
        const hash = hmac.digest('hex');
        return Buffer.concat([
            Buffer.from('YAME'),
            Buffer.from(hash, 'hex').slice(0, 12)
        ]);
    }

    function verifyYamenSignature(uid, readData) {
        if (!readData || readData.length < 16) return false;

        // Check Magic Header "YAME"
        if (readData.slice(0, 4).toString() !== 'YAME') return false;

        // Verify Hash
        const expected = generateSignature(uid);
        return Buffer.compare(readData.slice(0, 16), expected) === 0;
    }

    // =====================================================
    // 5. SUPABASE CONNECTION
    // =====================================================

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // =====================================================
    // 5.5 VERIFY TERMINAL EXISTS IN DATABASE
    // =====================================================

    async function ensureTerminalExists(terminalId, terminalName) {
        try {
            // Check if terminal exists
            const { data: existing, error: checkError } = await supabase
                .from('terminals')
                .select('id')
                .eq('id', terminalId)
                .maybeSingle();

            if (existing) {
                console.log(`✅ Terminal ${terminalId} exists in database`);
                return true;
            }

            // Terminal doesn't exist, need to create it
            // First, get a default branch (or create one)
            const { data: branches, error: branchError } = await supabase
                .from('branches')
                .select('id')
                .limit(1)
                .maybeSingle();

            let branchId = 1; // Default
            if (branches && branches.id) {
                branchId = branches.id;
            } else {
                // Create default branch if none exists
                const { data: newBranch, error: createBranchError } = await supabase
                    .from('branches')
                    .insert([{
                        name: 'Default Branch',
                        location: 'Main'
                    }])
                    .select('id')
                    .single();

                if (newBranch) {
                    branchId = newBranch.id;
                    console.log(`✅ Created default branch: ${branchId}`);
                }
            }

            // Now create the terminal
            console.log(`⚠️  Terminal ${terminalId} not found. Creating...`);
            const { data: newTerminal, error: createError } = await supabase
                .from('terminals')
                .insert([{
                    id: terminalId,
                    branch_id: branchId,
                    name: terminalName,
                    connection_url: 'local://nfc-bridge',
                    terminal_secret: crypto.randomUUID()
                }])
                .select()
                .single();

            if (createError) {
                console.error(`❌ Failed to create terminal: ${createError.message}`);
                return false;
            }

            console.log(`✅ Terminal created successfully: ID ${terminalId}`);
            return true;

        } catch (err) {
            console.error(`❌ Error ensuring terminal exists: ${err.message}`);
            if (err.cause) {
                console.error(`   Root cause: ${err.cause.message || err.cause}`);
            }
            return false;
        }
    }

    // =====================================================
    // 6. DEVICE TRACKING
    // =====================================================

    const deviceTracking = new Map();
    let readerCounter = 0;

    function registerDevice(readerName) {
        const deviceId = `device-${readerCounter++}`;
        const deviceInfo = {
            deviceId,
            label: readerName,
            connectedAt: new Date().toISOString(),
            scansCount: 0,
            errorsCount: 0,
            lastScan: null
        };

        deviceTracking.set(deviceId, deviceInfo);
        return deviceId;
    }

    function recordScan(deviceId, uid, isSecured) {
        const device = deviceTracking.get(deviceId);
        if (device) {
            device.scansCount++;
            device.lastScan = new Date().toISOString();
        }
    }

    function recordError(deviceId, errorMessage) {
        const device = deviceTracking.get(deviceId);
        if (device) {
            device.errorsCount++;
            device.lastError = {
                message: errorMessage,
                timestamp: new Date().toISOString()
            };
        }
    }

    // =====================================================
    // 7. SMART DEBOUNCE SYSTEM (FIXED VERSION)
    // =====================================================

    const DEBOUNCE_SAME_CARD_MS = 800;  // Prevent repeated reads of same card
    const DEBOUNCE_NEW_CARD_MS = 50;    // Instant response for new card

    // Track current card on reader
    const readerState = new Map(); // deviceId -> { uid, eventId, lastScanTime }

    function shouldProcessScan(deviceId, uid) {
        const now = Date.now();
        const state = readerState.get(deviceId);

        if (!state) {
            // First scan for this reader
            readerState.set(deviceId, { uid, eventId: null, lastScanTime: now });
            return true;
        }

        // If same card, avoid repetition completely
        if (state.uid === uid) {
            // STRICT DEBOUNCE: Don't process same card again until it's removed
            return false;
        }

        // Different card
        if ((now - state.lastScanTime) < DEBOUNCE_NEW_CARD_MS) {
            console.log(`⏭️  [DEBOUNCE] New card ${uid} - short wait`);
            return false;
        }
        console.log(`🔄 [SWITCH] Switching from ${state.uid} to ${uid}`);

        // Update state
        state.uid = uid;
        state.lastScanTime = now;
        return true;
    }

    function updateReaderState(deviceId, uid, eventId) {
        const state = readerState.get(deviceId) || { uid: null, eventId: null, lastScanTime: 0 };
        state.uid = uid;
        state.eventId = eventId;
        state.lastScanTime = Date.now();
        readerState.set(deviceId, state);
    }

    function getReaderEventId(deviceId) {
        const state = readerState.get(deviceId);
        return state ? state.eventId : null;
    }

    function clearReaderState(deviceId) {
        readerState.delete(deviceId);
    }

    // =====================================================
    // 8. NETWORK RETRY LOGIC
    // =====================================================

    async function syncWithRetry(payload, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const { error, data } = await supabase
                    .from('scan_events')
                    .insert([payload])
                    .select()
                    .single();

                if (!error) {
                    return { success: true, data };
                }

                console.warn(`⚠️  [RETRY ${attempt}/${maxRetries}] Sync failed: ${error.message}`);

                if (attempt < maxRetries) {
                    const delay = 1000 * attempt;
                    console.log(`   Retrying in ${delay}ms...`);
                    await new Promise(r => setTimeout(r, delay));
                }
            } catch (err) {
                console.error(`❌ [RETRY ${attempt}/${maxRetries}] Network error: ${err.message}`);
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 1000 * attempt));
                }
            }
        }
        return { success: false, error: 'Max retries exceeded' };
    }

    async function updateEventWithRetry(eventId, updates, maxRetries = 2) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const { error } = await supabase
                    .from('scan_events')
                    .update(updates)
                    .eq('id', eventId);

                if (!error) return true;

                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 500 * attempt));
                }
            } catch (err) {
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 500 * attempt));
                }
            }
        }
        return false;
    }

    // =====================================================
    // 8.5 HEARTBEAT
    // =====================================================

    const activeReaders = new Map();

    async function sendHeartbeat(isShutdown = false) {
        // Determine active connection
        const isDeviceConnected = activeReaders.size > 0;
        const deviceName = isDeviceConnected ? activeReaders.values().next().value.label : null;

        try {
            const metadata = {
                device_connected: isDeviceConnected && !isShutdown,
                device_name: isShutdown ? null : (deviceName || 'NFC Bridge'),
                is_shutdown: isShutdown,
                last_heartbeat: new Date().toISOString()
            };

            await supabase
                .from('terminals')
                .update({
                    last_sync: new Date().toISOString(),
                    metadata: metadata
                })
                .eq('id', terminalId);

        } catch (err) {
            console.error(`❌ Heartbeat failed: ${err.message}`);
        }
    }

    // Start heartbeat interval (every 10 seconds)
    setInterval(() => sendHeartbeat(false), 10000);

    // Send initial heartbeat
    sendHeartbeat(false);

    // =====================================================
    // 9. NFC BRIDGE INITIALIZATION
    // =====================================================

    const nfc = new NFC();

    console.log('================================================');
    console.log('   🚀 NFC CLOUD BRIDGE (STANDALONE v2.0)');
    console.log('================================================');
    console.log(`📡 Status: Active | Ready for cloud sync`);
    console.log(`🏪 Terminal: ${terminalName} (ID: ${terminalId})`);
    console.log('================================================\n');
    console.log('⏳ Waiting for NFC devices...\n');

    // Ensure terminal exists (Async check)
    ensureTerminalExists(terminalId, terminalName).then(exists => {
        if (!exists) console.log("⚠️  Terminal registration check failed, scans may fail if terminal doesn't exist.");
    });


    // =====================================================
    // 10. NFC EVENT HANDLERS
    // =====================================================

    nfc.on('reader', (reader) => {
        const deviceId = registerDevice(reader.name);
        activeReaders.set(deviceId, reader); // Register reader instance
        console.log(`\n[READER] Device found: ${reader.name} (${deviceId})`);
        console.log(`         Terminal: ${terminalName} (${terminalId})`);

        // Immediate Heartbeat Update
        sendHeartbeat(false);

        reader.on('card', async (card) => {
            // IMMEDIATE LOG - This should appear the moment card touches reader
            console.log(`\n⚡ [INSTANT] Card detected at: ${new Date().toISOString()}`);

            const uid = card.uid.toUpperCase();

            // --- Smart Debounce Check ---
            if (!shouldProcessScan(deviceId, uid)) {
                return;
            }

            console.log(`\n🎴 [SCAN] New card: ${uid}`);

            try {
                // Remove previous card if different
                const previousEventId = getReaderEventId(deviceId);
                if (previousEventId) {
                    console.log(`⚠️  [SWITCH] Removing previous card from interface...`);
                    await updateEventWithRetry(previousEventId, {
                        status: 'REMOVED',
                        processed: true
                    });
                }

                // Verify Yamen Protocol (Non-Blocking with Timeout)
                // -----------------------------------------------------
                let isValidYamen = false;
                let readDebugData = null; // Store read data for debugging

                try {
                    const performVerification = async () => {
                        // METHOD 1: Authenticated Read (Classic)
                        try {
                            await reader.authenticate(4, 0x60, 'FFFFFFFFFFFF');
                            const data = await reader.read(4, 16);
                            readDebugData = data;
                            return verifyYamenSignature(uid, data);
                        } catch (e) {
                            // METHOD 2: Direct Read (Ultralight/NTAG) fallback
                            try {
                                const data = await reader.read(4, 16);
                                readDebugData = data;
                                return verifyYamenSignature(uid, data);
                            } catch (e2) {
                                return false;
                            }
                        }
                    };

                    const timeoutProfile = new Promise(resolve => setTimeout(() => resolve(false), 800)); // 800ms max wait
                    isValidYamen = await Promise.race([performVerification(), timeoutProfile]);

                } catch (e) {
                    // Fallback
                    isValidYamen = false;
                }

                // Define cardType for logs
                const cardType = isValidYamen ? 'SECURE' : 'UNVERIFIED';

                if (!isValidYamen) {
                    console.log(`⚠️  [UNSUPPORTED] Card not signed or verification failed.`);
                    if (readDebugData) {
                        console.log(`   [DEBUG RAW READ] ${readDebugData.toString('hex').toUpperCase()}`);
                        console.log(`   [DEBUG EXPECTED] ${generateSignature(uid).toString('hex').toUpperCase()}`);
                    }
                } else {
                    console.log(`✅ [AUTH] Yamen Protocol Verified`);

                    // Self-Healing: Ensure DB knows this card is secured
                    supabase.from('cards')
                        .update({
                            metadata: { secured: true, signature_valid: true }
                        })
                        .eq('uid', uid)
                        .is('metadata->secured', null)
                        .then(({ error }) => {
                            if (error) console.error('Error syncing card status:', error.message);
                        });
                }

                // Sync with cloud (send card even if not activated)
                const result = await syncWithRetry({
                    terminal_id: terminalId,
                    uid: uid,
                    processed: false,
                    status: 'PRESENT',
                    metadata: {
                        secured: isValidYamen,
                        signature_valid: isValidYamen
                    }
                });

                if (!result.success) {
                    console.error(`❌ [SYNC ERROR] ${result.error}`);
                    recordError(deviceId, result.error);
                    notifier.notify({
                        title: '❌ Sync Failed',
                        message: result.error
                    });
                    updateReaderState(deviceId, uid, null);
                    clearReaderState(deviceId);
                } else {
                    updateReaderState(deviceId, uid, result.data.id);
                    recordScan(deviceId, uid, isValidYamen);
                    console.log(`✅ [CLOUD] Synced successfully`);
                    console.log(`   - Event ID: ${result.data.id}`);
                    console.log(`   - Card Type: ${cardType}`);

                    notifier.notify({
                        title: '✅ Scan Successful',
                        message: `UID: ${uid}\nType: ${cardType}`,
                        timeout: 2
                    });

                    console.log(`🔄 [READY] Waiting for card removal...\n`);
                }
            } catch (err) {
                console.error(`❌ [SYSTEM ERROR] ${err.message}`);
                recordError(deviceId, err.message);
                clearReaderState(deviceId);
            }
        });

        reader.on('card.off', async (card) => {
            // Get the removed UID - fallback to state if card object is incomplete
            const state = readerState.get(deviceId);
            const removedUid = card?.uid?.toUpperCase() || state?.uid;

            if (!removedUid) {
                console.log(`✨ [CARD OFF] Card removed (UID unknown)`);
                clearReaderState(deviceId);
                return;
            }

            console.log(`✨ [CARD OFF] Card removed: ${removedUid}`);

            // CRITICAL: Check if the removed card is actually the active one
            if (!state) {
                console.log(`   - Reader already empty, ignoring.`);
                return;
            }

            if (state.uid !== removedUid) {
                console.log(`⚠️ [RACE] Ignoring removal of ${removedUid} - Active card is ${state.uid}`);
                return;
            }

            const { eventId } = state;
            console.log(`   - Updating status in database (Event: ${eventId})...`);

            // Send update to DB
            if (eventId) {
                const success = await updateEventWithRetry(eventId, {
                    status: 'REMOVED',
                    processed: true
                });

                if (success) {
                    console.log(`✅ [REMOVED] Event ${eventId} closed`);
                } else {
                    console.error(`❌ [UPDATE ERROR] Failed to close event ${eventId}`);
                }
            }

            // Clear state ONLY if it still matches
            const postAwaitState = readerState.get(deviceId);
            if (postAwaitState && postAwaitState.uid === removedUid) {
                clearReaderState(deviceId);
                console.log(`🔄 System ready for new card\n`);
            }
        });

        reader.on('error', err => {
            console.error(`❌ [READER ERROR] ${reader.name}:`, err);
            recordError(deviceId, err.message);
        });

        reader.on('end', () => {
            console.log(`🔌 [READER DISCONNECTED] ${reader.name}`);
            activeReaders.delete(deviceId);
            deviceTracking.delete(deviceId);
            clearReaderState(deviceId);
            sendHeartbeat(false);
        });
    });

    nfc.on('error', (err) => {
        console.error(`❌ [NFC ERROR] ${err.message}`);
    });

    // =====================================================
    // 12. REMOTE ACTION LISTENER (INJECTION/WRITE)
    // =====================================================

    async function listenForActions() {
        console.log(`📡 Listening for remote actions on Terminal ${terminalId}...`);

        supabase
            .channel(`terminal-actions-${terminalId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'terminal_actions',
                    filter: `terminal_id=eq.${terminalId}`
                },
                async (payload) => {
                    const action = payload.new;
                    console.log(`⚡ [ACTION] Received command: ${action.action_type}`, action);

                    if (action.status !== 'PENDING') return;

                    if (action.action_type === 'WRITE_SIGNATURE') {
                        await handleWriteAction(action);
                    }
                }
            )
            .subscribe();
    }

    async function handleWriteAction(action) {
        const { payload, id } = action;
        const targetUid = payload.uid.toUpperCase();
        const signatureHex = payload.signature; // HEX string of 16 bytes (32 chars)

        console.log(`✍️  [WRITE] Attempting to write signature to ${targetUid}...`);

        // Find the reader that has this card
        let activeReader = null;
        let activeDeviceId = null;

        for (const [deviceId, state] of readerState.entries()) {
            if (state.uid === targetUid) {
                activeDeviceId = deviceId;
                activeReader = activeReaders.get(deviceId);
                break;
            }
        }

        if (!activeReader) {
            console.error(`❌ [WRITE] Card ${targetUid} not found on any reader.`);
            await supabase.from('terminal_actions').update({ status: 'FAILED', message: 'Card not present' }).eq('id', id);
            return;
        }

        try {
            console.log(`⏳ Authenticating Sector 1 (Block 4)...`);

            // Attempt Authentication for Mifare Classic
            try {
                await activeReader.authenticate(4, 0x60, 'FFFFFFFFFFFF');
                console.log(`✅ Authentication successful`);
            } catch (authErr) {
                console.log(`⚠️ Auth skipped (Ultralight/NTAG): ${authErr.message}`);
            }

            console.log(`⏳ Writing signature to block 4...`);
            const data = Buffer.from(signatureHex, 'hex'); // 16 bytes

            await activeReader.write(4, data, 16);

            console.log(`✅ [WRITE SUCCESS] Signature written successfully.`);

            // Update Action Status
            await supabase.from('terminal_actions').update({ status: 'COMPLETED', completed_at: new Date().toISOString() }).eq('id', id);

            // Update Cards Table
            try {
                await supabase.from('cards')
                    .update({
                        signature: signatureHex,
                        metadata: { secured: true, signature_valid: true }
                    })
                    .eq('uid', targetUid);
                console.log(`✅ [DB SYNC] Card record updated as SECURED.`);
            } catch (dbErr) {
                console.error(`⚠️ [DB SYNC] Failed: ${dbErr.message}`);
            }

            notifier.notify({
                title: '✅ Injection Successful',
                message: `Card ${targetUid} secured.`
            });

            // Update scan event metadata
            const eventId = getReaderEventId(activeDeviceId);
            if (eventId) {
                await updateEventWithRetry(eventId, {
                    metadata: { secured: true, signature_valid: true }
                });
            }

        } catch (writeErr) {
            console.error(`❌ [WRITE ERROR] ${writeErr.message}`);

            let friendlyError = writeErr.message;
            if (writeErr.message.includes('0x6300')) {
                friendlyError = "Failed: Auth Required or Block Locked (0x6300)";
            }

            await supabase.from('terminal_actions').update({ status: 'FAILED', message: friendlyError }).eq('id', id);

            notifier.notify({
                title: '❌ Injection Failed',
                message: friendlyError
            });
        }
    }

    // Start listening for remote actions
    listenForActions();

    // Watch for clean exit
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down...');
        sendHeartbeat(true).then(() => process.exit(0));
    });
}

bootstrap().catch(err => {
    console.error('❌ CRITICAL ERROR:', err);
    process.exit(1);
});
