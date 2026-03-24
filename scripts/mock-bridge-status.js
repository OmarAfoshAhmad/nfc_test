const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const terminalId = Number(process.env.TERMINAL_ID || 15);

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setStatus(deviceConnected, isShutdown, deviceName = 'Mock Reader') {
    console.log(`Setting status for Terminal ${terminalId}: deviceConnected=${deviceConnected}, isShutdown=${isShutdown}, deviceName=${deviceName}`);
    const { error } = await supabase
        .from('terminals')
        .update({
            last_sync: new Date().toISOString(),
            metadata: {
                device_connected: deviceConnected,
                device_name: deviceName,
                is_shutdown: isShutdown,
                script_version: 'MOCK-TEST'
            }
        })
        .eq('id', terminalId);

    if (error) console.error('Error:', error);
    else console.log('Successfully updated status.');
}

async function runMock() {
    // 1. Online & Connected
    await setStatus(true, false, 'ACS ACR122U MOCK');
    console.log('--- Step 1: ONLINE & CONNECTED (Check your screen now) ---');
    await new Promise(r => setTimeout(r, 8000));

    // 2. Reader Disconnected
    await setStatus(false, false, null);
    console.log('--- Step 2: READER DISCONNECTED (Yellow dot should appear) ---');
    await new Promise(r => setTimeout(r, 8000));

    // 3. Script Shutdown
    await setStatus(false, true, null);
    console.log('--- Step 3: SCRIPT SHUTDOWN (Offline/Gray should appear) ---');
}

runMock();
