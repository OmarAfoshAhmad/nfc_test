/**
 * Device Monitor Component - Enhanced
 * مكون لمراقبة حالة الأجهزة والمحطات في الوقت الفعلي مع مؤشرات خضراء
 */

'use client';

import React, { useContext, useEffect, useState } from 'react';
import { NFCContext } from '@/lib/NFCContext';
import { Activity, Wifi, WifiOff, AlertCircle, CheckCircle, Clock, Circle } from 'lucide-react';

export default function DeviceMonitor() {
    const nfcContext = useContext(NFCContext);
    const [selectedTerminal, setSelectedTerminal] = useState(null);
    const [terminals, setTerminals] = useState([]);
    const [stats, setStats] = useState({
        totalScans: 0,
        totalErrors: 0,
        activeDevices: 0
    });

    // Load terminals
    useEffect(() => {
        const loadTerminals = async () => {
            try {
                const response = await fetch('/api/terminals');
                const data = await response.json();
                if (data.success) {
                    setTerminals(data.data);
                    if (data.data.length > 0) {
                        const stored = localStorage.getItem('selected_terminal');
                        const selected = stored || data.data[0].id;
                        setSelectedTerminal(selected);
                        localStorage.setItem('selected_terminal', selected);
                    }
                }
            } catch (err) {
                console.error('Failed to load terminals:', err);
            }
        };

        loadTerminals();
    }, []);

    // Update statistics
    useEffect(() => {
        const updateStats = async () => {
            try {
                const response = await fetch('/api/analytics/device-stats');
                const data = await response.json();
                if (data.success) {
                    setStats(data.data);
                }
            } catch (err) {
                console.error('Failed to load statistics:', err);
            }
        };

        updateStats();
        const interval = setInterval(updateStats, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleTerminalChange = (terminalId) => {
        setSelectedTerminal(terminalId);
        localStorage.setItem('selected_terminal', terminalId);
        window.location.reload();
    };

    return (
        <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-lg">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Activity className="w-8 h-8 text-cyan-400" />
                        <h1 className="text-3xl font-bold">Device Monitor</h1>
                    </div>
                    <div className={`px-4 py-2 rounded-full font-semibold flex items-center gap-2 ${
                        nfcContext?.isConnected 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                    }`}>
                        {nfcContext?.isConnected ? (
                            <>
                                <Circle className="w-3 h-3 fill-current animate-pulse" />
                                Connected
                            </>
                        ) : (
                            <>
                                <Circle className="w-3 h-3" />
                                Disconnected
                            </>
                        )}
                    </div>
                </div>

                {/* Terminal Selection */}
                {terminals.length > 0 && (
                    <div className="bg-slate-700/50 p-4 rounded-lg">
                        <label className="block text-sm font-semibold mb-3">Select Terminal:</label>
                        <select
                            value={selectedTerminal || ''}
                            onChange={(e) => handleTerminalChange(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-600 rounded px-4 py-2 text-white hover:border-cyan-500 focus:outline-none focus:border-cyan-400 transition"
                        >
                            {terminals.map(terminal => (
                                <option key={terminal.id} value={terminal.id}>
                                    {terminal.name} ({terminal.location})
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <StatCard
                    icon={<Activity className="w-6 h-6" />}
                    label="Total Scans"
                    value={stats.totalScans}
                    color="cyan"
                />
                <StatCard
                    icon={<AlertCircle className="w-6 h-6" />}
                    label="Errors"
                    value={stats.totalErrors}
                    color="red"
                />
                <StatCard
                    icon={<Wifi className="w-6 h-6" />}
                    label="Active Devices"
                    value={stats.activeDevices}
                    color="green"
                />
            </div>

            {/* Connected Devices List with Green Indicators */}
            <div className="bg-slate-700/50 backdrop-blur-sm p-6 rounded-lg mb-8">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Wifi className="w-5 h-5 text-cyan-400" />
                    Online Devices on Network
                </h2>
                
                {terminals && terminals.length > 0 ? (
                    <div className="space-y-3">
                        {terminals.map((terminal) => {
                            const isOnline = terminal.is_active && !terminal.deleted_at;
                            return (
                                <div
                                    key={terminal.id}
                                    className="flex items-center justify-between p-4 bg-slate-600/30 rounded border border-slate-600 hover:border-cyan-500 transition group"
                                >
                                    <div className="flex items-center gap-4 flex-1">
                                        {/* Green/Red indicator */}
                                        <div className={`relative w-3 h-3 rounded-full ${
                                            isOnline 
                                                ? 'bg-green-400 shadow-lg shadow-green-400/50 animate-pulse' 
                                                : 'bg-gray-400'
                                        }`}>
                                            {isOnline && (
                                                <div className="absolute inset-0 rounded-full border-2 border-green-400 animate-ping" />
                                            )}
                                        </div>
                                        
                                        <div className="flex-1">
                                            <p className="font-semibold text-lg">{terminal.name}</p>
                                            <p className="text-sm text-gray-400">
                                                {terminal.location} • ID: {terminal.id}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {/* Status Badge */}
                                    <div className="flex items-center gap-3">
                                        <span className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${
                                            isOnline
                                                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                                                : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                                        }`}>
                                            {isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-gray-400 text-center py-8">No devices configured</p>
                )}
            </div>

            {/* Current Terminal Information */}
            {selectedTerminal && (
                <div className="bg-slate-700/50 backdrop-blur-sm p-6 rounded-lg mb-6">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-cyan-400" />
                        Current Terminal Details
                    </h2>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between border-b border-slate-600 pb-2">
                            <span className="text-slate-400">Terminal ID:</span>
                            <span className="font-mono font-semibold text-cyan-300">{selectedTerminal}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-600 pb-2">
                            <span className="text-slate-400">Reader Name:</span>
                            <span className="text-white">{nfcContext?.readerName || 'Connecting...'}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-600 pb-2">
                            <span className="text-slate-400">Connection Status:</span>
                            <span className={`font-semibold flex items-center gap-2 ${nfcContext?.isConnected ? 'text-green-400' : 'text-red-400'}`}>
                                <Circle className={`w-2 h-2 fill-current ${nfcContext?.isConnected ? 'animate-pulse' : ''}`} />
                                {nfcContext?.isConnected ? 'Connected' : 'Disconnected'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Last Update:</span>
                            <span className="flex items-center gap-2 text-white">
                                <Clock className="w-4 h-4" />
                                {new Date().toLocaleTimeString('en-US')}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Information Note */}
            <div className="bg-blue-500/10 border border-blue-400/30 p-4 rounded-lg text-sm">
                <p className="text-blue-300">
                    💡 <strong>Note:</strong> Green indicators (🟢) show devices online and ready. 
                    Device status updates automatically every 5 seconds.
                </p>
            </div>
        </div>
    );
}

/**
 * Statistics Card Component
 */
function StatCard({ icon, label, value, color }) {
    const colorClasses = {
        cyan: 'from-cyan-900/20 to-cyan-800/10 border-cyan-500/30 text-cyan-300',
        red: 'from-red-900/20 to-red-800/10 border-red-500/30 text-red-300',
        green: 'from-green-900/20 to-green-800/10 border-green-500/30 text-green-300'
    };

    return (
        <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-lg p-4 hover:shadow-lg transition`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-400 mb-1">{label}</p>
                    <p className="text-4xl font-bold">{value}</p>
                </div>
                <div className="text-3xl opacity-30">
                    {icon}
                </div>
            </div>
        </div>
    );
}
