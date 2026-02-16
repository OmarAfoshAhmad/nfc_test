const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zdirmkypfxuamjbdkwhb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkaXJta3lwZnh1YW1qYmRrd2hiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE1MzgxNCwiZXhwIjoyMDgxNzI5ODE0fQ.CORI1-tLzRPgdqVYxY_HX6eGDasc0l8s9muSS-eGIuk';
const terminalId = 15;

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
