#!/usr/bin/env node

/**
 * Device Information Script
 * Display device and terminal information
 * 
 * Usage:
 * node scripts/device-info.js
 */

const fs = require('fs');
const path = require('path');

function loadConfig() {
    const configPath = path.join(process.cwd(), 'config', 'devices.config.json');
    if (!fs.existsSync(configPath)) {
        console.error('❌ Config file not found:', configPath);
        process.exit(1);
    }

    try {
        const content = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(content);
    } catch (err) {
        console.error('❌ Failed to load config:', err.message);
        process.exit(1);
    }
}

function printHeader() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║       📱 Devices & Terminals Information                   ║');
    console.log('║       معلومات الأجهزة والمحطات                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\n');
}

function printCompanyInfo(config) {
    console.log('🏢 Company Information:');
    console.log('─'.repeat(60));
    console.log(`   Name            : ${config.company.name}`);
    console.log(`   Code            : ${config.company.code}`);
    console.log(`   Version         : ${config.version}`);
    console.log(`   Schema          : ${config.schema}`);
    console.log('\n');
}

function printTerminals(config) {
    console.log('🏪 Terminals:');
    console.log('─'.repeat(60));

    if (!config.terminals || config.terminals.length === 0) {
        console.log('   No terminals registered');
        return;
    }

    config.terminals.forEach((terminal, index) => {
        const status = terminal.enabled ? '✅ Enabled' : '❌ Disabled';
        console.log(`\n   ${index + 1}. ${terminal.name}`);
        console.log(`      ├─ ID              : ${terminal.id}`);
        console.log(`      ├─ Location        : ${terminal.location}`);
        console.log(`      ├─ Branch          : ${terminal.branch_id}`);
        console.log(`      ├─ Status          : ${status}`);
        console.log(`      ├─ Connection URL  : ${terminal.connectionUrl}`);
        console.log(`      └─ Last Seen       : ${terminal.lastSeen || 'Never connected'}`);
    });
    console.log('\n');
}

function printDevices(config) {
    console.log('📱 Devices:');
    console.log('─'.repeat(60));

    if (!config.devices || config.devices.length === 0) {
        console.log('   No devices registered');
        return;
    }

    config.devices.forEach((device, index) => {
        const status = device.connected ? '🟢 Connected' : '🔴 Disconnected';
        console.log(`\n   ${index + 1}. ${device.label}`);
        console.log(`      ├─ Device ID       : ${device.deviceId}`);
        console.log(`      ├─ Type            : ${device.type}`);
        console.log(`      ├─ Status          : ${status}`);
        console.log(`      ├─ Serial Number   : ${device.serialNumber}`);
        console.log(`      ├─ Assigned Term.  : ${device.assignedTerminal}`);
        console.log(`      ├─ Firmware Ver.   : ${device.firmwareVersion}`);
        console.log(`      ├─ Encryption      : ${device.encryptionType}`);
        
        if (device.capabilities && device.capabilities.length > 0) {
            console.log(`      ├─ Capabilities    : ${device.capabilities.join(', ')}`);
        }
        
        if (device.operatingSystem && device.operatingSystem.length > 0) {
            console.log(`      └─ Supported OS    : ${device.operatingSystem.join(', ')}`);
        }
    });
    console.log('\n');
}

function printSecurity(config) {
    console.log('🔐 Security Information:');
    console.log('─'.repeat(60));
    console.log(`   Signature Algorithm     : ${config.security.signatureAlgorithm}`);
    console.log(`   Encryption Algorithm    : ${config.security.encryptionAlgorithm}`);
    console.log(`   Card Validation         : ${config.security.cardValidationRequired ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Company Token Required  : ${config.security.companyTokenRequired ? '✅ Yes' : '❌ No'}`);
    console.log('\n');
}

function printMonitoring(config) {
    console.log('📊 Monitoring Settings:');
    console.log('─'.repeat(60));
    console.log(`   Remote Monitoring       : ${config.monitoring.enableRemoteMonitoring ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Health Check Interval   : ${config.monitoring.healthCheckInterval}ms (${(config.monitoring.healthCheckInterval / 1000).toFixed(1)}s)`);
    console.log(`   Inactivity Timeout      : ${config.monitoring.inactivityTimeoutMs}ms (${(config.monitoring.inactivityTimeoutMs / 1000).toFixed(1)}s)`);
    console.log(`   Alert on Disconnect     : ${config.monitoring.alertOnDisconnect ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Alert on Error          : ${config.monitoring.alertOnError ? '✅ Enabled' : '❌ Disabled'}`);
    console.log('\n');
}

function printPerformance(config) {
    console.log('⚡ Performance Settings:');
    console.log('─'.repeat(60));
    console.log(`   Polling Interval        : ${config.performance.pollingIntervalMs}ms`);
    console.log(`   Max Concurrent Scans    : ${config.performance.maxConcurrentScans}`);
    console.log(`   Scan Timeout            : ${config.performance.scanTimeoutMs}ms`);
    console.log(`   Cache Duration          : ${config.performance.cacheDurationMs}ms (${(config.performance.cacheDurationMs / 1000).toFixed(1)}s)`);
    console.log('\n');
}

function printLogging(config) {
    console.log('📝 Logging Settings:');
    console.log('─'.repeat(60));
    console.log(`   Logging Enabled         : ${config.logging.enabled ? '✅ Yes' : '❌ No'}`);
    console.log(`   Log Level               : ${config.logging.level}`);
    console.log(`   Log Path                : ${config.logging.logPath}`);
    console.log(`   Max File Size           : ${config.logging.maxFileSizeMB}MB`);
    console.log(`   Retention Period        : ${config.logging.retentionDays} days`);
    console.log(`   Log Scan Events         : ${config.logging.logScanEvents ? '✅ Yes' : '❌ No'}`);
    console.log(`   Log Connection Events   : ${config.logging.logConnectionEvents ? '✅ Yes' : '❌ No'}`);
    console.log('\n');
}

function printStatistics(config) {
    const terminalCount = config.terminals ? config.terminals.length : 0;
    const deviceCount = config.devices ? config.devices.length : 0;
    const connectedDevices = config.devices ? config.devices.filter(d => d.connected).length : 0;
    const enabledTerminals = config.terminals ? config.terminals.filter(t => t.enabled).length : 0;

    console.log('📈 Statistics:');
    console.log('─'.repeat(60));
    console.log(`   Total Terminals         : ${terminalCount}`);
    console.log(`   Enabled Terminals       : ${enabledTerminals}`);
    console.log(`   Total Devices           : ${deviceCount}`);
    console.log(`   Connected Devices       : ${connectedDevices}`);
    console.log(`   Connection Rate         : ${deviceCount > 0 ? ((connectedDevices / deviceCount) * 100).toFixed(1) : 0}%`);
    console.log('\n');
}

function printFooter() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║         ✅ Device & Terminal Information Display Complete  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
}

// البرنامج الرئيسي
try {
    const config = loadConfig();
    printHeader();
    printCompanyInfo(config);
    printTerminals(config);
    printDevices(config);
    printSecurity(config);
    printMonitoring(config);
    printPerformance(config);
    printLogging(config);
    printStatistics(config);
    printFooter();
} catch (error) {
    console.error('❌ Error occurred:', error.message);
    process.exit(1);
}
