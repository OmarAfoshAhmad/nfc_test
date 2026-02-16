
/**
 * Professional NFC Driver for ACR122U (WebHID)
 * v4.0 - Feature Report Strategy
 */
export class NfcReader {
    constructor() {
        this.device = null;
        this.type = null;
        this.onScan = null;
        this.onCardRemoved = null; // New callback
        this.onStatusChange = null;
        this.pollingInterval = null;
        this._isProcessing = false;
    }

    async isSupported() {
        return ('hid' in navigator);
    }

    async connect() {
        console.log("NFC Reader Driver v4.0: Feature Report Mode");

        try {
            if ('hid' in navigator) {
                try {
                    console.log('Requesting WebHID device...');
                    const devices = await navigator.hid.requestDevice({ filters: [] });

                    if (devices.length > 0) {
                        this.device = devices[0];
                        this.type = 'hid';
                        await this.setupHid();
                        return true;
                    } else {
                        throw new Error("No device selected.");
                    }
                } catch (e) {
                    console.log('WebHID Error:', e);
                    if (this.onStatusChange) this.onStatusChange('error', `HID Connection Failed: ${e.message}`);
                    return false;
                }
            }

            if (!('hid' in navigator)) {
                if (this.onStatusChange) this.onStatusChange('error', 'WebHID API not supported in this browser.');
            }

            return false;
        } catch (error) {
            console.error('NFC Connection failed:', error);
            if (this.onStatusChange) this.onStatusChange('error', error.message);
            return false;
        }
    }

    async setupHid() {
        await this.device.open();
        if (this.onStatusChange) this.onStatusChange('connected', `HID: ${this.device.productName}`);
        this.startFeaturePolling();
    }

    startFeaturePolling() {
        let lastUid = null;

        this.pollingInterval = setInterval(async () => {
            if (!this.device || this._isProcessing) return;
            this._isProcessing = true;

            try {
                // ACR122U Feature Report: Get UID Command
                // Report ID 0x01, followed by APDU wrapper
                const getUidFeature = new Uint8Array([
                    0x6f, 0x09, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                    0xff, 0xca, 0x00, 0x00, 0x04
                ]);

                // Send Feature Report (Report ID 0)
                await this.device.sendFeatureReport(0, getUidFeature);

                // Small delay to allow reader to process
                await new Promise(resolve => setTimeout(resolve, 50));

                // Receive Feature Report
                const response = await this.device.receiveFeatureReport(0);
                const data = new Uint8Array(response.buffer);

                // Parse response
                if (data.byteLength > 14) {
                    // ACR122U returns: [header...] [UID bytes] [status bytes]
                    // UID typically starts at offset 10-14
                    const uidBytes = data.slice(10, data.byteLength - 2);
                    const uid = Array.from(uidBytes)
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join('')
                        .toUpperCase();

                    console.log("Feature Report UID:", uid);

                    // Validate UID (should be 8-20 chars, not error code like 9000 or 6300)
                    if (uid && uid.length >= 8 && uid.length <= 20 && uid !== '9000' && uid !== '6300') {
                        if (uid !== lastUid) {
                            lastUid = uid;
                            if (this.onScan) this.onScan(uid);
                            // Debounce for 3 seconds
                            setTimeout(() => { if (lastUid === uid) lastUid = null; }, 3000);
                        }
                    }
                } else {
                    // Card lost
                    if (lastUid) {
                        console.log("Card Removed");
                        if (this.onCardRemoved) this.onCardRemoved();
                    }
                    lastUid = null;
                }
            } catch (e) {
            } finally {
                this._isProcessing = false;
            }
        }, 500); // Poll every 500ms
    }

    async disconnect() {
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        if (this.device) {
            try { await this.device.close(); } catch (e) { }
            this.device = null;
            if (this.onStatusChange) this.onStatusChange('disconnected');
        }
    }
}
