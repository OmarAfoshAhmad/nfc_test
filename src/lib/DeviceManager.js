/**
 * Device Manager - إدارة شاملة للأجهزة والمحطات
 * Version 1.0 - مدير محترف للأجهزة مع إمكانيات المراقبة الكاملة
 * 
 * المميزات:
 * - إدارة متعددة الأجهزة
 * - تتبع حالة كل جهاز في الوقت الفعلي
 * - التحقق من الاتصال والصحة
 * - تسجيل العمليات والأخطاء
 */

import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

class DeviceManager extends EventEmitter {
    constructor(configPath = 'config/devices.config.json') {
        super();
        this.configPath = configPath;
        this.config = null;
        this.devices = new Map();
        this.terminals = new Map();
        this.healthChecks = new Map();
        this.logger = this._initializeLogger();
    }

    /**
     * تهيئة نظام التسجيل
     */
    _initializeLogger() {
        return {
            info: (msg, data = {}) => {
                const timestamp = new Date().toISOString();
                console.log(`[${timestamp}] [INFO] ${msg}`, data);
                this._writeToLogFile(`INFO: ${msg} ${JSON.stringify(data)}`);
            },
            error: (msg, error = {}) => {
                const timestamp = new Date().toISOString();
                console.error(`[${timestamp}] [ERROR] ${msg}`, error);
                this._writeToLogFile(`ERROR: ${msg} ${JSON.stringify(error)}`);
            },
            warn: (msg, data = {}) => {
                const timestamp = new Date().toISOString();
                console.warn(`[${timestamp}] [WARN] ${msg}`, data);
                this._writeToLogFile(`WARN: ${msg} ${JSON.stringify(data)}`);
            }
        };
    }

    /**
     * كتابة السجلات إلى ملف
     */
    _writeToLogFile(message) {
        try {
            const logDir = path.join(process.cwd(), 'logs/devices');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            const date = new Date();
            const logFile = path.join(logDir, `device-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.log`);
            const timestamp = date.toISOString();
            fs.appendFileSync(logFile, `${timestamp} ${message}\n`);
        } catch (err) {
            console.error('Failed to write log:', err);
        }
    }

    /**
     * تحميل التكوين من الملف الخارجي
     */
    async loadConfig() {
        try {
            if (!fs.existsSync(this.configPath)) {
                this.logger.error(`ملف التكوين غير موجود: ${this.configPath}`);
                throw new Error(`Config file not found: ${this.configPath}`);
            }

            const configContent = fs.readFileSync(this.configPath, 'utf-8');
            this.config = JSON.parse(configContent);

            this.logger.info('✅ تم تحميل التكوين بنجاح', { version: this.config.version });

            // تحميل الأجهزة والمحطات
            this._loadDevices();
            this._loadTerminals();

            return this.config;
        } catch (err) {
            this.logger.error('❌ فشل تحميل التكوين', err);
            throw err;
        }
    }

    /**
     * تحميل الأجهزة من التكوين
     */
    _loadDevices() {
        if (!this.config.devices) return;

        this.config.devices.forEach(device => {
            this.devices.set(device.deviceId, {
                ...device,
                healthStatus: 'unknown',
                lastHeartbeat: null,
                scansCount: 0,
                errorsCount: 0
            });
        });

        this.logger.info(`📱 تم تحميل ${this.devices.size} أجهزة`, {
            devices: Array.from(this.devices.keys())
        });
    }

    /**
     * تحميل المحطات من التكوين
     */
    _loadTerminals() {
        if (!this.config.terminals) return;

        this.config.terminals.forEach(terminal => {
            this.terminals.set(terminal.id, {
                ...terminal,
                lastActivity: null,
                scansToday: 0
            });
        });

        this.logger.info(`🏪 تم تحميل ${this.terminals.size} محطة`, {
            terminals: Array.from(this.terminals.keys())
        });
    }

    /**
     * الحصول على معلومات جهاز معين
     */
    getDevice(deviceId) {
        return this.devices.get(deviceId);
    }

    /**
     * الحصول على معلومات محطة معينة
     */
    getTerminal(terminalId) {
        return this.terminals.get(terminalId);
    }

    /**
     * الحصول على جميع الأجهزة
     */
    getAllDevices() {
        return Array.from(this.devices.values());
    }

    /**
     * الحصول على جميع المحطات
     */
    getAllTerminals() {
        return Array.from(this.terminals.values());
    }

    /**
     * الحصول على الأجهزة النشطة فقط
     */
    getActiveDevices() {
        return Array.from(this.devices.values()).filter(d => d.connected);
    }

    /**
     * تحديث حالة الجهاز
     */
    updateDeviceStatus(deviceId, status) {
        const device = this.devices.get(deviceId);
        if (!device) {
            this.logger.warn(`⚠️ محاولة تحديث جهاز غير موجود: ${deviceId}`);
            return false;
        }

        const oldStatus = device.healthStatus;
        device.healthStatus = status;
        device.lastHeartbeat = new Date().toISOString();

        this.emit('deviceStatusChanged', {
            deviceId,
            oldStatus,
            newStatus: status,
            timestamp: device.lastHeartbeat
        });

        this.logger.info(`🔄 تحديث حالة الجهاز: ${deviceId}`, { 
            status, 
            device: device.label 
        });

        return true;
    }

    /**
     * تسجيل عملية مسح
     */
    recordScan(deviceId, terminalId, uid, isSecured = false) {
        const device = this.devices.get(deviceId);
        if (!device) {
            this.logger.warn(`⚠️ محاولة تسجيل مسح من جهاز غير موجود: ${deviceId}`);
            return false;
        }

        device.scansCount++;
        
        const terminal = this.terminals.get(terminalId);
        if (terminal) {
            terminal.scansCount = (terminal.scansCount || 0) + 1;
            terminal.lastActivity = new Date().toISOString();
        }

        this.emit('scanRecorded', {
            deviceId,
            terminalId,
            uid,
            isSecured,
            timestamp: new Date().toISOString(),
            deviceLabel: device.label,
            terminalName: terminal?.name
        });

        this.logger.info(`🎴 مسح مسجل`, {
            device: device.label,
            terminal: terminal?.name,
            uid: uid.substring(0, 8) + '...',
            secured: isSecured
        });

        return true;
    }

    /**
     * تسجيل خطأ
     */
    recordError(deviceId, errorMessage, errorType = 'UNKNOWN') {
        const device = this.devices.get(deviceId);
        if (!device) return false;

        device.errorsCount++;
        device.lastError = {
            message: errorMessage,
            type: errorType,
            timestamp: new Date().toISOString()
        };

        this.emit('deviceError', {
            deviceId,
            error: errorMessage,
            type: errorType,
            deviceLabel: device.label
        });

        this.logger.error(`❌ خطأ في الجهاز: ${device.label}`, {
            type: errorType,
            message: errorMessage
        });

        return true;
    }

    /**
     * بدء فحوصات الصحة الدورية
     */
    startHealthChecks(interval = 30000) {
        if (this.healthChecks.has('main')) {
            return; // Already running
        }

        const checkHealth = async () => {
            for (const [deviceId, device] of this.devices) {
                try {
                    // محاكاة فحص الصحة (يمكن استبداله بفحص حقيقي للجهاز)
                    const healthStatus = device.connected ? 'healthy' : 'disconnected';
                    this.updateDeviceStatus(deviceId, healthStatus);
                } catch (err) {
                    this.recordError(deviceId, err.message, 'HEALTH_CHECK_FAILED');
                }
            }
        };

        // تنفيذ الفحص الأول فوراً
        checkHealth();

        // جدولة الفحوصات الدورية
        const healthCheckInterval = setInterval(checkHealth, interval);
        this.healthChecks.set('main', healthCheckInterval);

        this.logger.info(`🏥 تم بدء فحوصات الصحة الدورية`, { interval });
    }

    /**
     * إيقاف فحوصات الصحة
     */
    stopHealthChecks() {
        for (const [key, interval] of this.healthChecks) {
            clearInterval(interval);
            this.healthChecks.delete(key);
        }
        this.logger.info('🛑 تم إيقاف فحوصات الصحة');
    }

    /**
     * الحصول على إحصائيات شاملة
     */
    getStatistics() {
        const stats = {
            totalDevices: this.devices.size,
            connectedDevices: this.getActiveDevices().length,
            totalTerminals: this.terminals.size,
            totalScans: 0,
            totalErrors: 0,
            devices: {},
            terminals: {}
        };

        // إحصائيات الأجهزة
        for (const [deviceId, device] of this.devices) {
            stats.totalScans += device.scansCount || 0;
            stats.totalErrors += device.errorsCount || 0;
            stats.devices[deviceId] = {
                label: device.label,
                connected: device.connected,
                scans: device.scansCount || 0,
                errors: device.errorsCount || 0,
                lastHeartbeat: device.lastHeartbeat,
                healthStatus: device.healthStatus
            };
        }

        // إحصائيات المحطات
        for (const [terminalId, terminal] of this.terminals) {
            stats.terminals[terminalId] = {
                name: terminal.name,
                scans: terminal.scansCount || 0,
                lastActivity: terminal.lastActivity,
                status: terminal.status
            };
        }

        return stats;
    }

    /**
     * حفظ التكوين المحدث
     */
    async saveConfig() {
        try {
            const configDir = path.dirname(this.configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }

            // تحديث بيانات الأجهزة والمحطات
            this.config.devices = Array.from(this.devices.values());
            this.config.terminals = Array.from(this.terminals.values());

            fs.writeFileSync(
                this.configPath,
                JSON.stringify(this.config, null, 2),
                'utf-8'
            );

            this.logger.info('💾 تم حفظ التكوين بنجاح');
            return true;
        } catch (err) {
            this.logger.error('❌ فشل حفظ التكوين', err);
            throw err;
        }
    }

    /**
     * الحصول على تقرير شامل
     */
    getDetailedReport() {
        const stats = this.getStatistics();
        const timestamp = new Date().toISOString();

        return {
            timestamp,
            company: this.config.company,
            summary: {
                totalDevices: stats.totalDevices,
                activeDevices: stats.connectedDevices,
                totalTerminals: stats.totalTerminals,
                totalScans: stats.totalScans,
                totalErrors: stats.totalErrors,
                errorRate: stats.totalScans > 0 ? (stats.totalErrors / stats.totalScans * 100).toFixed(2) + '%' : '0%'
            },
            deviceDetails: stats.devices,
            terminalDetails: stats.terminals,
            generatedAt: timestamp
        };
    }
}

export default DeviceManager;
