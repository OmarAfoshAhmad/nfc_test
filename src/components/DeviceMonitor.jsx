/**
 * Device Monitor Component
 * مكون لمراقبة حالة الأجهزة والمحطات في الوقت الفعلي
 */

'use client';

import React, { useContext, useEffect, useState } from 'react';
import { NFCContext } from '@/lib/NFCContext';
import { Activity, Wifi, WifiOff, AlertCircle, CheckCircle, Clock } from 'lucide-react';

export default function DeviceMonitor() {
    const nfcContext = useContext(NFCContext);
    const [selectedTerminal, setSelectedTerminal] = useState(null);
    const [terminals, setTerminals] = useState([]);
    const [devices, setDevices] = useState([]);
    const [stats, setStats] = useState({
        totalScans: 0,
        totalErrors: 0,
        activeDevices: 0
    });

    // تحميل المحطات عند التحميل
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
                console.error('فشل تحميل المحطات:', err);
            }
        };

        loadTerminals();
    }, []);

    // تحديث الإحصائيات
    useEffect(() => {
        const updateStats = async () => {
            try {
                const response = await fetch('/api/analytics/device-stats');
                const data = await response.json();
                if (data.success) {
                    setStats(data.data);
                }
            } catch (err) {
                console.error('فخل تحميل الإحصائيات:', err);
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
            {/* الرأس */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Activity className="w-8 h-8 text-cyan-400" />
                        <h1 className="text-3xl font-bold">مراقب الأجهزة</h1>
                    </div>
                    <div className={`px-4 py-2 rounded-full font-semibold flex items-center gap-2 ${
                        nfcContext?.isConnected 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                    }`}>
                        {nfcContext?.isConnected ? (
                            <>
                                <Wifi className="w-4 h-4" />
                                متصل
                            </>
                        ) : (
                            <>
                                <WifiOff className="w-4 h-4" />
                                غير متصل
                            </>
                        )}
                    </div>
                </div>

                {/* اختيار المحطة */}
                {terminals.length > 0 && (
                    <div className="bg-slate-700/50 p-4 rounded-lg">
                        <label className="block text-sm font-semibold mb-3">اختر المحطة:</label>
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

            {/* الإحصائيات */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <StatCard
                    icon={<Activity className="w-6 h-6" />}
                    label="إجمالي المسحات"
                    value={stats.totalScans}
                    color="cyan"
                />
                <StatCard
                    icon={<AlertCircle className="w-6 h-6" />}
                    label="الأخطاء"
                    value={stats.totalErrors}
                    color="red"
                />
                <StatCard
                    icon={<Wifi className="w-6 h-6" />}
                    label="الأجهزة النشطة"
                    value={stats.activeDevices}
                    color="green"
                />
            </div>

            {/* معلومات المحطة الحالية */}
            {selectedTerminal && (
                <div className="bg-slate-700/50 backdrop-blur-sm p-6 rounded-lg">
                    <h2 className="text-xl font-bold mb-4">معلومات المحطة الحالية</h2>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between border-b border-slate-600 pb-2">
                            <span className="text-slate-400">معرف المحطة:</span>
                            <span className="font-mono font-semibold">{selectedTerminal}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-600 pb-2">
                            <span className="text-slate-400">اسم القارئ:</span>
                            <span>{nfcContext?.readerName || 'جاري الاتصال...'}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-600 pb-2">
                            <span className="text-slate-400">حالة الاتصال:</span>
                            <span className={nfcContext?.isConnected ? 'text-green-400' : 'text-red-400'}>
                                {nfcContext?.isConnected ? 'متصل' : 'قطع الاتصال'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">آخر تحديث:</span>
                            <span className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                {new Date().toLocaleTimeString('ar-SA')}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* ملاحظة مهمة */}
            <div className="mt-6 bg-blue-500/10 border border-blue-400/30 p-4 rounded-lg text-sm">
                <p className="text-blue-300">
                    💡 <strong>ملاحظة:</strong> يتم تحديث معلومات الأجهزة تلقائياً كل 5 ثوان. 
                    تأكد من أن جهاز القارئ موصول وفعال.
                </p>
            </div>
        </div>
    );
}

/**
 * مكون بطاقة الإحصائية
 */
function StatCard({ icon, label, value, color }) {
    const colorClasses = {
        cyan: 'from-cyan-900/20 to-cyan-800/10 border-cyan-500/30 text-cyan-300',
        red: 'from-red-900/20 to-red-800/10 border-red-500/30 text-red-300',
        green: 'from-green-900/20 to-green-800/10 border-green-500/30 text-green-300'
    };

    return (
        <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-lg p-4`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-400 mb-1">{label}</p>
                    <p className="text-3xl font-bold">{value}</p>
                </div>
                <div className="text-3xl opacity-30">
                    {icon}
                </div>
            </div>
        </div>
    );
}
