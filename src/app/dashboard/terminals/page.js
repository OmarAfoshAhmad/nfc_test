'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/lib/LanguageContext';
import {
    Monitor,
    Wifi,
    WifiOff,
    Cpu,
    AlertCircle,
    CheckCircle2,
    Clock,
    MapPin,
    ExternalLink
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

export default function TerminalsPage() {
    const { t, language, dir } = useLanguage();
    const [terminals, setTerminals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ online: 0, total: 0, hardwareIssues: 0 });

    const fetchTerminals = async () => {
        const { data, error } = await supabase
            .from('terminals')
            .select(`
                *,
                branches ( name )
            `)
            .order('id');

        if (!error && data) {
            setTerminals(data);
            calculateStats(data);
        }
        setLoading(false);
    };

    const calculateStats = (data) => {
        const now = new Date();
        const onlineCount = data.filter(t => {
            const lastSync = t.last_sync ? new Date(t.last_sync) : null;
            return t.is_active && lastSync && (now - lastSync) < 15000 && !t.metadata?.is_shutdown;
        }).length;

        const hwIssues = data.filter(t =>
            t.connection_url && t.connection_url.toLowerCase().includes('no hardware')
        ).length;

        setStats({ online: onlineCount, total: data.length, hardwareIssues: hwIssues });
    };

    useEffect(() => {
        fetchTerminals();

        // Subscribe to REALTIME changes in the terminals table
        const channel = supabase
            .channel('realtime:terminals:updates', {
                config: {
                    broadcast: { self: true },
                    presence: { key: 'terminals' }
                }
            })
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'terminals'
                },
                (payload) => {
                    console.log('🔄 [Realtime] Terminal Updated:', payload.new.id, payload.new.name);
                    // Update specific terminal instead of refetching all
                    setTerminals(prev => {
                        const updated = prev.map(t =>
                            t.id === payload.new.id ? { ...t, ...payload.new } : t
                        );
                        calculateStats(updated);
                        return updated;
                    });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'terminals'
                },
                (payload) => {
                    console.log('✅ [Realtime] Terminal Created:', payload.new.id);
                    fetchTerminals(); // Refetch when new terminal added
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'terminals'
                },
                (payload) => {
                    console.log('❌ [Realtime] Terminal Deleted:', payload.old.id);
                    setTerminals(prev => prev.filter(t => t.id !== payload.old.id));
                }
            );

        // Subscribe with proper error handling
        channel.subscribe((status) => {
            console.log(`[Realtime] Terminals channel status: ${status}`);
            if (status === 'SUBSCRIBED') {
                console.log('✅ Realtime Terminal Monitoring ACTIVE');
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                console.warn('⚠️ Realtime status:', status);
            }
        });

        // Fallback poll every 30 seconds for safety
        const interval = setInterval(fetchTerminals, 30000);

        return () => {
            console.log('[Realtime] Cleaning up terminals channel');
            channel.unsubscribe();
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    const isTerminalOnline = (terminal) => {
        if (!terminal.last_sync) return false;
        const lastSync = new Date(terminal.last_sync);
        // Real-time: 15 seconds timeout + check is_shutdown flag
        return (new Date() - lastSync) < 15000 && !terminal.metadata?.is_shutdown;
    };

    return (
        <div className="p-6 space-y-6" dir={dir}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <Monitor className="text-blue-500 dark:text-blue-400" />
                        {t('nav_terminals')}
                    </h1>
                    <p className="text-gray-500 dark:text-slate-400 font-medium">{t('enterprise_desc')}</p>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 p-6 rounded-2xl backdrop-blur-sm shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">{t('total_terminals')}</p>
                            <h3 className="text-3xl font-black text-gray-900 dark:text-white mt-1">{stats.total}</h3>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-500/10 p-3 rounded-xl">
                            <Monitor className="text-blue-600 dark:text-blue-500" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 p-6 rounded-2xl backdrop-blur-sm shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">{t('currently_online')}</p>
                            <h3 className="text-3xl font-black text-green-600 dark:text-green-500 mt-1">{stats.online}</h3>
                        </div>
                        <div className="bg-green-50 dark:bg-green-500/10 p-3 rounded-xl">
                            <Wifi className="text-green-600 dark:text-green-500 animate-pulse" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 p-6 rounded-2xl backdrop-blur-sm shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">{t('hardware_alerts')}</p>
                            <h3 className="text-3xl font-black text-orange-600 dark:text-orange-500 mt-1">{stats.hardwareIssues}</h3>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-500/10 p-3 rounded-xl">
                            <Cpu className="text-orange-600 dark:text-orange-500" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Terminal List */}
            <div className="bg-white dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 rounded-3xl overflow-hidden backdrop-blur-sm shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-start">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-slate-800/50 text-gray-400 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest">
                                <th className="px-6 py-5 text-start">{t('terminal_name')}</th>
                                <th className="px-6 py-5 text-start">{t('terminal_branch')}</th>
                                <th className="px-6 py-5 text-start">{t('terminal_script_status')}</th>
                                <th className="px-6 py-5 text-start">{t('terminal_nfc_reader')}</th>
                                <th className="px-6 py-5 text-start">{t('terminal_last_seen')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                            {terminals.map((terminal) => {
                                const online = isTerminalOnline(terminal);
                                const deviceConnected = terminal.metadata?.device_connected;
                                const deviceName = terminal.metadata?.device_name;

                                return (
                                    <tr key={terminal.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-gray-300 dark:bg-slate-600'}`}></div>
                                                <div>
                                                    <div className="text-gray-900 dark:text-white font-black">{terminal.name}</div>
                                                    <div className="text-[10px] text-gray-400 dark:text-slate-500 font-bold font-mono">ID: {terminal.id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2 text-gray-600 dark:text-slate-300 font-bold text-sm">
                                                <MapPin size={14} className="text-gray-400 dark:text-slate-500" />
                                                {terminal.branches?.name || '---'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-start">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${online ? 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-500' : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500'
                                                }`}>
                                                {online ? t('online') : t('offline')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-start">
                                            <div className="flex items-center gap-2">
                                                {online && deviceConnected && deviceName ? (
                                                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold">
                                                        <CheckCircle2 size={16} />
                                                        <span className="text-xs truncate max-w-[150px]" title={deviceName}>
                                                            {deviceName}
                                                        </span>
                                                    </div>
                                                ) : online && !deviceConnected ? (
                                                    <div className="flex items-center gap-2 text-amber-500 font-bold">
                                                        <AlertCircle size={16} />
                                                        <span className="text-xs">{t('reader_disconnected') || 'No Device'}</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-gray-400 dark:text-slate-500 font-bold opacity-60">
                                                        <WifiOff size={16} />
                                                        <span className="text-xs">{t('disconnected_status') || 'Disconnected'}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-start text-gray-400 dark:text-slate-400 text-xs">
                                            <div className="flex items-center gap-2 font-medium">
                                                <Clock size={14} />
                                                {terminal.last_sync ? formatDistanceToNow(new Date(terminal.last_sync), {
                                                    addSuffix: true,
                                                    locale: language === 'ar' ? ar : enUS
                                                }) : '---'}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
