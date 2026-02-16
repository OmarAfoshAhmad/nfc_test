'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { format } from 'date-fns';
import { Loader2, ShieldAlert, Search, Filter, Trash2, Key, X, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function AuditPage() {
    const { t, language, dir } = useLanguage();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');

    // Clear Logs States
    const [showClearModal, setShowClearModal] = useState(false);
    const [confirmPwd, setConfirmPwd] = useState('');
    const [clearing, setClearing] = useState(false);

    useEffect(() => {
        fetchLogs();
    }, [filter]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/audit?filter=${filter}&limit=100`);
            const json = await res.json();

            if (!res.ok) throw new Error(json.message || 'Failed to fetch logs');

            setLogs(json.data || []);
        } catch (error) {
            console.error('Error fetching logs:', error);
            toast.error(t('audit_error_load'));
        } finally {
            setLoading(false);
        }
    };

    const handleClearLogs = async (e) => {
        e.preventDefault();
        setClearing(true);
        try {
            const res = await fetch('/api/audit', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: confirmPwd })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(t('audit_clear_success'));
                setShowClearModal(false);
                setConfirmPwd('');
                fetchLogs();
            } else {
                toast.error(data.message || t('audit_clear_error'));
            }
        } catch (error) {
            toast.error(t('audit_clear_error'));
        } finally {
            setClearing(false);
        }
    };

    const getActionColor = (action) => {
        switch (action) {
            case 'CREATE': return 'text-green-600 bg-green-50 border-green-200';
            case 'UPDATE': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'DELETE': return 'text-red-600 bg-red-50 border-red-200';
            case 'RESTORE': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'LOGIN': return 'text-purple-600 bg-purple-50 border-purple-200';
            default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    const translateAction = (action) => {
        const key = `action_${action.toLowerCase()}`;
        return t(key);
    };

    const translateEntity = (entity) => {
        const key = `audit_${entity.toLowerCase()}`;
        return t(key);
    };

    const categories = [
        { id: 'ALL', label: 'audit_all' },
        { id: 'auth', label: 'audit_auth' },
        { id: 'customers', label: 'audit_customers' },
        { id: 'cards', label: 'audit_cards' },
        { id: 'campaigns', label: 'audit_campaigns' }
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6" dir={dir}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                        <ShieldAlert className="text-blue-600" size={32} />
                        {t('nav_logs')}
                    </h1>
                    <p className="text-gray-500 mt-2 font-medium">
                        {t('audit_track_desc')}
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setFilter(cat.id)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === cat.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                                }`}
                        >
                            {t(cat.label)}
                        </button>
                    ))}
                    <div className="w-px h-8 bg-gray-100 dark:bg-gray-700 mx-2 hidden md:block"></div>
                    <button
                        onClick={() => setShowClearModal(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/10 dark:text-red-400 transition-all border border-red-100 dark:border-red-900/30"
                    >
                        <Trash2 size={18} />
                        {t('audit_clear')}
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                <th className="px-6 py-4 text-start text-xs font-black text-gray-400 uppercase tracking-wider">
                                    {t('audit_timestamp')}
                                </th>
                                <th className="px-6 py-4 text-start text-xs font-black text-gray-400 uppercase tracking-wider">
                                    {t('audit_admin')}
                                </th>
                                <th className="px-6 py-4 text-start text-xs font-black text-gray-400 uppercase tracking-wider">
                                    {t('audit_action')}
                                </th>
                                <th className="px-6 py-4 text-start text-xs font-black text-gray-400 uppercase tracking-wider">
                                    {t('audit_entity')}
                                </th>
                                <th className="px-6 py-4 text-start text-xs font-black text-gray-400 uppercase tracking-wider">
                                    {t('audit_details')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center">
                                        <Loader2 className="animate-spin mx-auto text-blue-500" size={32} />
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400 font-medium">
                                        {t('audit_no_logs')}
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                                        <td className="px-6 py-4 text-sm font-bold text-gray-500 whitespace-nowrap" dir="ltr">
                                            {format(new Date(log.created_at), 'yyyy/MM/dd HH:mm:ss')}
                                        </td>
                                        <td className="px-6 py-4 text-start">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-900 dark:text-white">
                                                    {log.admin_email || t('system')}
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-mono">
                                                    {log.ip_address}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-start">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black border uppercase tracking-wider ${getActionColor(log.action_type)}`}>
                                                {translateAction(log.action_type)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-start text-sm font-bold text-gray-600 dark:text-gray-300">
                                            {translateEntity(log.entity_name)} <span className="text-gray-400 text-xs font-mono">#{log.entity_id?.slice(0, 8)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-start text-sm text-gray-500 font-mono max-w-xs truncate" title={JSON.stringify(log.details, null, 2)}>
                                            {JSON.stringify(log.details)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Clear Logs Modal */}
            {showClearModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 w-full max-w-md animate-in fade-in zoom-in duration-200 border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-6">
                            <div className="bg-red-100 dark:bg-red-900/20 p-3 rounded-2xl text-red-600">
                                <Trash2 size={24} />
                            </div>
                            <button onClick={() => setShowClearModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2">
                                <X size={20} />
                            </button>
                        </div>

                        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
                            {t('audit_clear_confirm')}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-8 leading-relaxed">
                            {t('audit_clear_desc')}
                        </p>

                        <form onSubmit={handleClearLogs} className="space-y-6">
                            <div className="relative">
                                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
                                    <Key size={18} />
                                </div>
                                <input
                                    type="password"
                                    required
                                    autoFocus
                                    className="w-full pl-4 pr-12 py-4 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-blue-500 rounded-2xl dark:text-white outline-none transition-all shadow-inner font-bold"
                                    placeholder={t('password')}
                                    value={confirmPwd}
                                    onChange={(e) => setConfirmPwd(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-4 pt-2">
                                <button
                                    type="submit"
                                    disabled={clearing}
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-red-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {clearing ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                                    {t('audit_clear')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowClearModal(false);
                                        setConfirmPwd('');
                                    }}
                                    className="flex-1 bg-gray-100 dark:bg-gray-700 py-4 rounded-2xl font-black text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                                >
                                    {t('cancel')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
