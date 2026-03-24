
/**
 * WebHID NFC reader wrapper used by NFCContext.
 * This keeps a minimal and robust API: connect/disconnect + scan callbacks.
 */
export class NfcReader {
    constructor() {
        this.device = null;
        this.type = null;
        this.onScan = null;
        this.onCardRemoved = null;
        this.onStatusChange = null;
        this.pollingInterval = null;
        this._isProcessing = false;
        this._lastUid = null;
        this._missedReads = 0;
    }

    async isSupported() {
        return typeof navigator !== 'undefined' && 'hid' in navigator;
    }

    async connect() {
        try {
            if (!(await this.isSupported())) {
                this.onStatusChange?.('error', 'WebHID API not supported in this browser.');
                return false;
            }

            const devices = await navigator.hid.requestDevice({ filters: [] });
            if (!devices || devices.length === 0) {
                this.onStatusChange?.('error', 'No device selected.');
                return false;
            }

            this.device = devices[0];
            this.type = 'hid';
            await this.setupHid();
            return true;
        } catch (error) {
            console.error('NFC connection failed:', error);
            this.onStatusChange?.('error', `HID Connection Failed: ${error.message}`);
            return false;
        }
    }

    async setupHid() {
        await this.device.open();
        this.onStatusChange?.('connected', `HID:${this.device.productName || 'Unknown Device'}`);
        this.startFeaturePolling();
    }

    async readUidOnce() {
        const getUidFeature = new Uint8Array([
            0x6f, 0x09, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0xff, 0xca, 0x00, 0x00, 0x04
        ]);

        await this.device.sendFeatureReport(0, getUidFeature);
        await new Promise(resolve => setTimeout(resolve, 50));

        const response = await this.device.receiveFeatureReport(0);
        const data = new Uint8Array(response.buffer || response);

        if (data.byteLength < 14) {
            return null;
        }

        const uidBytes = data.slice(10, data.byteLength - 2);
        if (!uidBytes || uidBytes.length === 0) {
            return null;
        }

        const uid = Array.from(uidBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();

        if (!uid || uid.length < 4 || uid.length > 128 || uid === '9000' || uid === '6300') {
            return null;
        }

        return uid;
    }

    startFeaturePolling() {
        this.pollingInterval = setInterval(async () => {
            if (!this.device || this._isProcessing) return;
            this._isProcessing = true;

            try {
                const uid = await this.readUidOnce();

                if (uid) {
                    this._missedReads = 0;
                    if (uid !== this._lastUid) {
                        this._lastUid = uid;
                        this.onScan?.(uid);
                    }
                } else {
                    this._missedReads += 1;
                    if (this._lastUid && this._missedReads >= 2) {
                        this._lastUid = null;
                        this.onCardRemoved?.();
                    }
                }
            } catch (error) {
                this._missedReads += 1;
                if (this._lastUid && this._missedReads >= 2) {
                    this._lastUid = null;
                    this.onCardRemoved?.();
                }
            } finally {
                this._isProcessing = false;
            }
        }, 500);
    }

    async disconnect() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }

        this._lastUid = null;
        this._missedReads = 0;

        if (this.device) {
            try {
                if (this.device.opened) {
                    await this.device.close();
                }
            } catch (error) {
                console.warn('Reader disconnect warning:', error?.message || error);
            }
            this.device = null;
        }

        this.onStatusChange?.('disconnected', 'Reader disconnected');
    }
}
