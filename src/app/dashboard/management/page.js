'use client';
import { useState, useEffect, useRef } from 'react';
import { Plus, Building2, Zap, Trash2, Edit, Key, Monitor, Users, MapPin, RefreshCw, Eye, EyeOff, ShieldCheck, Lock, Activity, Shield, CreditCard, ShieldAlert, Loader2, XCircle, Info, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';
import { useNFC } from '@/lib/NFCContext';
import DataTable from '@/components/DataTable';
import { supabase } from '@/lib/supabase';

export default function ManagementPage() {
    const { language, t, dir } = useLanguage();
    const [activeTab, setActiveTab] = useState('branches');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <div className="max-w-6xl mx-auto" suppressHydrationWarning>
            <div className={`flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4`}>
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                        {t('enterprise_management')}
                        <span className="text-sm font-normal text-gray-400 mt-1 uppercase tracking-widest">{t('enterprise')}</span>
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">{t('enterprise_desc')}</p>
                </div>
            </div>

            {/* Tabs - Modern & Bilingual */}
            <div className={`flex border-b border-gray-200 dark:border-gray-700 mb-8 bg-white dark:bg-gray-800 rounded-t-2xl overflow-hidden shadow-sm`}>
                <button
                    onClick={() => setActiveTab('branches')}
                    className={`flex items-center gap-2 px-8 py-5 transition-all ${activeTab === 'branches'
                        ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                >
                    <Building2 size={20} />
                    <span className="font-bold">{t('tabs_branches')}</span>
                </button>
                <button
                    onClick={() => setActiveTab('terminals')}
                    className={`flex items-center gap-2 px-8 py-5 transition-all ${activeTab === 'terminals'
                        ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                >
                    <Monitor size={20} />
                    <span className="font-bold">{t('tabs_terminals')}</span>
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex items-center gap-2 px-8 py-5 transition-all ${activeTab === 'users'
                        ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                >
                    <Users size={20} />
                    <span className="font-bold">{t('tabs_users')}</span>
                </button>
                <button
                    onClick={() => setActiveTab('nfc_security')}
                    className={`flex items-center gap-2 px-8 py-5 transition-all ${activeTab === 'nfc_security'
                        ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                >
                    <Key size={20} />
                    <span className="font-bold">{t('tabs_nfc_security') || 'أمن البطاقات'}</span>
                </button>
            </div>

            {/* Content Area */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeTab === 'branches' && <BranchManagement />}
                {activeTab === 'terminals' && <TerminalManagement />}
                {activeTab === 'users' && <UserManagement />}
                {activeTab === 'nfc_security' && <NFCSecurityManagement />}
            </div>
        </div>
    );
}

function BranchManagement() {
    const { t, dir } = useLanguage();
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showDeleted, setShowDeleted] = useState(false);
    const [formData, setFormData] = useState({ id: null, name: '', location: '', is_active: true });

    const fetchBranches = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/branches?deleted=${showDeleted}`);
            const data = await res.json();
            setBranches(data.data || []);
        } catch (e) {
            toast.error(t('error_loading'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBranches();
    }, [showDeleted]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const isEdit = !!formData.id;
        try {
            const res = await fetch(isEdit ? `/api/branches/${formData.id}` : '/api/branches', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            if (res.ok) {
                toast.success(t('save_success') || 'Success');
                setShowModal(false);
                setFormData({ id: null, name: '', location: '', is_active: true });
                fetchBranches();
            }
        } catch (err) {
            toast.error(t('network_error'));
        }
    };

    const handleDelete = async (id) => {
        if (!confirm(t('confirm_delete') || 'Are you sure?')) return;
        try {
            const res = await fetch(`/api/branches?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(t('delete_success'));
                fetchBranches();
            }
        } catch (e) {
            toast.error(t('delete_error'));
        }
    };

    const handleRestore = async (id) => {
        try {
            const res = await fetch(`/api/branches`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, restore: true }),
            });
            if (res.ok) {
                toast.success(t('restore_success') || 'Restored');
                fetchBranches();
            }
        } catch (e) {
            toast.error(t('restore_error'));
        }
    };

    const filteredBranches = branches.filter(b =>
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        (b.location && b.location.toLowerCase().includes(search.toLowerCase()))
    );

    const columns = [
        {
            header: t('branch_name'),
            accessor: 'name',
            className: 'font-bold text-gray-900 dark:text-white'
        },
        {
            header: t('branch_location'),
            accessor: 'location',
            cell: (row) => (
                <div className={`flex items-center gap-2 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                    <MapPin size={14} className="text-gray-400" />
                    <span>{row.location || '---'}</span>
                </div>
            )
        },
        {
            header: t('status'),
            accessor: 'is_active',
            cell: (row) => (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${row.deleted_at ? 'bg-orange-100 text-orange-700' : row.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {row.deleted_at ? t('deleted') || 'Deleted' : row.is_active ? t('active') : t('deactivated')}
                </span>
            )
        },
        {
            header: t('actions'),
            className: 'w-24',
            cell: (row) => (
                <div className={`flex gap-1 ${dir === 'rtl' ? 'justify-end' : 'justify-start'}`}>
                    {row.deleted_at ? (
                        <button
                            onClick={() => handleRestore(row.id)}
                            className="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                            title={t('restore')}
                        >
                            <RefreshCw size={16} />
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => {
                                    setFormData({
                                        id: row.id,
                                        name: row.name,
                                        location: row.location || '',
                                        is_active: row.is_active
                                    });
                                    setShowModal(true);
                                }}
                                className="p-2 text-gray-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            >
                                <Edit size={16} />
                            </button>
                            <button
                                onClick={() => handleDelete(row.id)}
                                className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                                <Trash2 size={16} />
                            </button>
                        </>
                    )}
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <DataTable
                columns={columns}
                data={filteredBranches}
                loading={loading}
                searchTerm={search}
                onSearchChange={setSearch}
                actions={
                    <div className="flex gap-2 w-full md:w-auto">
                        <button
                            onClick={() => setShowDeleted(!showDeleted)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all font-bold text-sm ${showDeleted
                                ? 'bg-orange-50 border-orange-200 text-orange-600'
                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            {showDeleted ? <EyeOff size={18} /> : <Eye size={18} />}
                            {showDeleted ? (t('hide_deleted') || 'Hide Deleted') : (t('show_deleted') || 'Show Deleted')}
                        </button>
                        <button
                            onClick={() => setShowModal(true)}
                            className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 font-bold flex items-center justify-center gap-2"
                        >
                            <Plus size={20} />
                            {t('add_branch')}
                        </button>
                    </div>
                }
            />

            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <h2 className={`text-2xl font-bold mb-6 dark:text-white text-start`}>
                            {formData.id ? t('edit') : t('add_branch')}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                                    {t('branch_name')}
                                </label>
                                <input
                                    type="text"
                                    required
                                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all text-start`}
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                                    {t('branch_location')}
                                </label>
                                <input
                                    type="text"
                                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all text-start`}
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg">{t('save')}</button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setFormData({ id: null, name: '', location: '', is_active: true });
                                    }}
                                    className="flex-1 bg-gray-100 dark:bg-gray-700 py-3.5 rounded-xl font-bold text-gray-600 dark:text-gray-300"
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

function TerminalManagement() {
    const { t, dir } = useLanguage();
    const [terminals, setTerminals] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showDeleted, setShowDeleted] = useState(false);
    const [formData, setFormData] = useState({ id: null, branch_id: '', name: '', connection_url: 'cloud-sync', is_active: true });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [tRes, bRes] = await Promise.all([
                fetch(`/api/terminals?deleted=${showDeleted}`),
                fetch('/api/branches')
            ]);
            const tData = await tRes.json();
            const bData = await bRes.json();
            setTerminals(tData.data || []);
            setBranches(bData.data || []);
        } catch (e) {
            toast.error(t('error_loading'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Realtime Subscription
        const channel = supabase
            .channel('terminals-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'terminals' },
                (payload) => {
                    if (payload.eventType === 'UPDATE') {
                        setTerminals(prev => prev.map(t => t.id === payload.new.id ? payload.new : t));
                    } else if (payload.eventType === 'INSERT') {
                        setTerminals(prev => [...prev, payload.new]);
                    }
                }
            )
            .subscribe();

        // Local Timer for "Offline" detection (Visual only)
        // Forces re-render every second to update relative time checks
        const interval = setInterval(() => {
            setTerminals(prev => [...prev]); // Trigger re-render
        }, 1000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, [showDeleted]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const isEdit = !!formData.id;
        try {
            const res = await fetch(isEdit ? `/api/terminals/${formData.id}` : '/api/terminals', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            if (res.ok) {
                toast.success(t('save_success'));
                setShowModal(false);
                setFormData({ id: null, branch_id: '', name: '', connection_url: 'cloud-sync', is_active: true });
                fetchData();
            }
        } catch (err) {
            toast.error(t('network_error'));
        }
    };

    const handleDelete = async (id) => {
        if (!confirm(t('confirm_delete'))) return;
        try {
            const res = await fetch(`/api/terminals?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(t('delete_success'));
                fetchData();
            }
        } catch (e) {
            toast.error(t('delete_error'));
        }
    };

    const handleRestore = async (id) => {
        try {
            const res = await fetch(`/api/terminals`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, restore: true }),
            });
            if (res.ok) {
                toast.success(t('restore_success') || 'Restored');
                fetchData();
            }
        } catch (e) {
            toast.error(t('restore_error'));
        }
    };

    const filteredTerminals = terminals.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase())
    );

    const columns = [
        {
            header: t('terminal_name'),
            accessor: 'name',
            className: 'font-bold text-gray-900 dark:text-white'
        },
        {
            header: t('terminal_branch'),
            accessor: 'branch_id',
            cell: (row) => branches.find(b => b.id === row.branch_id)?.name || '---'
        },
        {
            header: t('nfc_reader') || 'قارئ NFC',
            accessor: 'metadata',
            cell: (row) => {
                const deviceConnected = row.metadata?.device_connected;
                const deviceName = row.metadata?.device_name;
                const lastSync = row.last_sync ? new Date(row.last_sync) : null;
                const isOnline = lastSync && (new Date() - lastSync) < 15000 && !row.metadata?.is_shutdown;

                if (isOnline && deviceConnected && deviceName) {
                    return (
                        <div className={`flex items-center gap-2 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded border border-green-100 w-fit ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                            <Zap size={12} className="fill-current" />
                            <span>{deviceName}</span>
                        </div>
                    );
                }

                return (
                    <div className={`flex items-center gap-2 text-xs font-medium text-gray-400 opacity-60 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                        <Zap size={12} />
                        <span>{t('disconnected') || 'غير متصل'}</span>
                    </div>
                );
            }
        },
        {
            header: t('status'),
            accessor: 'last_sync',
            cell: (row) => {
                if (row.deleted_at) {
                    return <span className="text-[10px] font-bold uppercase text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">{t('deleted') || 'Deleted'}</span>;
                }
                const lastSync = row.last_sync ? new Date(row.last_sync) : null;
                // Strict Realtime: 15 seconds timeout
                const isOnline = lastSync && (new Date() - lastSync) < 15000 && !row.metadata?.is_shutdown;
                const deviceConnected = row.metadata?.device_connected;

                if (!isOnline) {
                    return (
                        <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400`}>
                            <div className={`h-1.5 w-1.5 rounded-full bg-gray-400`}></div>
                            {t('offline')}
                        </div>
                    );
                }

                if (isOnline && !deviceConnected) {
                    return (
                        <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-500`}>
                            <div className={`h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse`}></div>
                            {t('reader_disconnected') || 'No Device'}
                        </div>
                    );
                }

                return (
                    <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-green-500`}>
                        <div className={`h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse`}></div>
                        {t('online')}
                    </div>
                );
            }
        },
        {
            header: t('actions'),
            className: 'w-24',
            cell: (row) => (
                <div className={`flex gap-1 ${dir === 'rtl' ? 'justify-end' : 'justify-start'}`}>
                    {row.deleted_at ? (
                        <button
                            onClick={() => handleRestore(row.id)}
                            className="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                            title={t('restore')}
                        >
                            <RefreshCw size={16} />
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => {
                                    setFormData({
                                        id: row.id,
                                        branch_id: row.branch_id || '',
                                        name: row.name,
                                        connection_url: row.connection_url,
                                        is_active: row.is_active
                                    });
                                    setShowModal(true);
                                }}
                                className="p-2 text-gray-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            >
                                <Edit size={16} />
                            </button>
                            <button
                                onClick={() => handleDelete(row.id)}
                                className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                                <Trash2 size={16} />
                            </button>
                        </>
                    )}
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <DataTable
                columns={columns}
                data={filteredTerminals}
                loading={loading}
                searchTerm={search}
                onSearchChange={setSearch}
                actions={
                    <div className="flex gap-2 w-full md:w-auto">
                        <button
                            onClick={() => setShowDeleted(!showDeleted)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all font-bold text-sm ${showDeleted
                                ? 'bg-orange-50 border-orange-200 text-orange-600'
                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            {showDeleted ? <EyeOff size={18} /> : <Eye size={18} />}
                            {showDeleted ? (t('hide_deleted') || 'Hide Deleted') : (t('show_deleted') || 'Show Deleted')}
                        </button>
                        <button
                            onClick={() => setShowModal(true)}
                            className="flex-1 md:flex-none bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 font-bold flex items-center justify-center gap-2"
                        >
                            <Plus size={20} />
                            {t('add_terminal')}
                        </button>
                    </div>
                }
            />

            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <div className={`flex items-center gap-2 mb-2 text-purple-600 ${dir === 'rtl' ? 'justify-end' : ''}`}>
                            <Zap size={14} />
                            <span className="text-xs font-bold uppercase tracking-widest">Hardware Node</span>
                        </div>
                        <h2 className={`text-2xl font-bold mb-6 dark:text-white text-start`}>
                            {formData.id ? t('edit') : t('add_terminal')}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                                    {t('terminal_branch')}
                                </label>
                                <select
                                    required
                                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-purple-500 transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                                    value={formData.branch_id}
                                    onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                                >
                                    <option value="">-- {t('terminal_branch')} --</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                                    {t('terminal_name')}
                                </label>
                                <input
                                    type="text"
                                    required
                                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-purple-500 transition-all text-start`}
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="submit" className="flex-1 bg-purple-600 text-white font-bold py-3.5 rounded-xl shadow-lg">{t('save')}</button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setFormData({ id: null, branch_id: '', name: '', connection_url: 'cloud-sync', is_active: true });
                                    }}
                                    className="flex-1 bg-gray-100 dark:bg-gray-700 py-3.5 rounded-xl font-bold text-gray-600 dark:text-gray-300"
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

function UserManagement() {
    const { t, dir } = useLanguage();
    const [users, setUsers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showDeleted, setShowDeleted] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [formData, setFormData] = useState({ id: null, username: '', password: '', role: 'staff', branch_id: '' });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [uRes, bRes, meRes] = await Promise.all([
                fetch(`/api/users?deleted=${showDeleted}`),
                fetch('/api/branches'),
                fetch('/api/auth/me')
            ]);
            const uData = await uRes.json();
            const bData = await bRes.json();
            const meData = await meRes.json();
            setUsers(uData.data || []);
            setBranches(bData.data || []);
            setCurrentUser(meData.user || null);
        } catch (e) {
            toast.error(t('error_loading'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [showDeleted]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const isEdit = !!formData.id;
        try {
            const res = await fetch(isEdit ? `/api/users/${formData.id}` : '/api/users', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(t('save_success'));
                setShowModal(false);
                setFormData({ id: null, username: '', password: '', role: 'staff', branch_id: '' });
                fetchData();
            }
            else {
                toast.error(data.message || 'Error');
            }
        } catch (err) {
            toast.error(t('network_error'));
        }
    };

    const handleDelete = async (id) => {
        if (!confirm(t('confirm_delete'))) return;
        try {
            const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(t('delete_success'));
                fetchData();
            } else {
                const data = await res.json();
                toast.error(data.message);
            }
        } catch (e) {
            toast.error(t('delete_error'));
        }
    };

    const handleRestore = async (id) => {
        try {
            const res = await fetch(`/api/users`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, restore: true }),
            });
            if (res.ok) {
                toast.success(t('restore_success') || 'Restored');
                fetchData();
            }
        } catch (e) {
            toast.error(t('restore_error'));
        }
    };

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(search.toLowerCase())
    );

    const columns = [
        {
            header: t('username'),
            accessor: 'username',
            className: 'font-bold text-gray-900 dark:text-white'
        },
        {
            header: t('role'),
            accessor: 'role',
            cell: (row) => (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${row.role === 'superadmin' ? 'bg-black text-white' : row.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                    {t(row.role)}
                </span>
            )
        },
        {
            header: t('terminal_branch'),
            accessor: 'branch_id',
            cell: (row) => branches.find(b => b.id === row.branch_id)?.name || '---'
        },
        {
            header: t('status'),
            accessor: 'deleted_at',
            cell: (row) => row.deleted_at ? (
                <span className="text-[10px] font-bold uppercase text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">{t('deleted') || 'Deleted'}</span>
            ) : (
                <span className="text-[10px] font-bold uppercase text-green-600 bg-green-100 px-2 py-0.5 rounded-full">{t('active')}</span>
            )
        },
        {
            header: t('actions'),
            className: 'w-24',
            cell: (row) => (
                <div className={`flex gap-1`}>
                    {row.deleted_at ? (
                        <button
                            onClick={() => handleRestore(row.id)}
                            className="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                            title={t('restore')}
                        >
                            <RefreshCw size={16} />
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => {
                                    setFormData({
                                        id: row.id,
                                        username: row.username,
                                        password: '',
                                        role: row.role,
                                        branch_id: row.branch_id || ''
                                    });
                                    setShowModal(true);
                                }}
                                className="p-2 text-gray-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            >
                                <Edit size={16} />
                            </button>
                            <button
                                onClick={() => handleDelete(row.id)}
                                className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                                <Trash2 size={16} />
                            </button>
                        </>
                    )}
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <DataTable
                columns={columns}
                data={filteredUsers}
                loading={loading}
                searchTerm={search}
                onSearchChange={setSearch}
                actions={
                    <div className="flex gap-2 w-full md:w-auto">
                        <button
                            onClick={() => setShowDeleted(!showDeleted)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all font-bold text-sm ${showDeleted
                                ? 'bg-orange-50 border-orange-200 text-orange-600'
                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            {showDeleted ? <EyeOff size={18} /> : <Eye size={18} />}
                            {showDeleted ? (t('hide_deleted') || 'Hide Deleted') : (t('show_deleted') || 'Show Deleted')}
                        </button>
                        <button
                            onClick={() => setShowModal(true)}
                            className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 font-bold flex items-center justify-center gap-2"
                        >
                            <Plus size={20} />
                            {t('add_user')}
                        </button>
                    </div>
                }
            />

            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <h2 className={`text-2xl font-bold mb-6 dark:text-white text-start`}>
                            {formData.id ? t('edit') : t('add_user')}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start`}>
                                    {t('username')}
                                </label>
                                <input
                                    type="text"
                                    required
                                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all text-start`}
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start`}>
                                    {t('password')}
                                </label>
                                <input
                                    type="password"
                                    required={!formData.id}
                                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all text-start`}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                                {formData.id && <p className={`text-[10px] text-gray-400 mt-1 text-start`}>{t('password_hint')}</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start text-xs uppercase tracking-widest`}>
                                        {t('role')}
                                    </label>
                                    <select
                                        className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all text-start`}
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    >
                                        <option value="admin">{t('admin')}</option>
                                        <option value="staff">{t('staff')}</option>
                                        {currentUser?.role === 'superadmin' && <option value="superadmin">{t('superadmin')}</option>}
                                    </select>
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start text-xs uppercase tracking-widest`}>
                                        {t('terminal_branch')}
                                    </label>
                                    <select
                                        className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all text-start`}
                                        value={formData.branch_id}
                                        onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                                    >
                                        <option value="">{t('all_branches')}</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg disabled:opacity-50">{t('save')}</button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setFormData({ id: null, username: '', password: '', role: 'staff', branch_id: '' });
                                    }}
                                    className="flex-1 bg-gray-100 dark:bg-gray-700 py-3.5 rounded-xl font-bold text-gray-600 dark:text-gray-300"
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

function NFCSecurityManagement() {
    const { t } = useLanguage();
    const {
        isConnected,
        isCloudConnected,
        isHwConnected,
        onScan: subscribeToScan,
        injectCard,
        readerName,
        terminalId: activeTerminalId,
        setTerminalId
    } = useNFC();

    const [card, setCard] = useState(null);
    const [isInjecting, setIsInjecting] = useState(false);
    const [terminals, setTerminals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingTerminals, setLoadingTerminals] = useState(false);

    // Fetch terminals for selection
    useEffect(() => {
        const fetchTerminals = async () => {
            setLoadingTerminals(true);
            try {
                const { data } = await supabase
                    .from('terminals')
                    .select('id, name, last_sync, metadata')
                    .order('name');
                setTerminals(data || []);
            } catch (err) {
                console.error('Error fetching terminals:', err);
            } finally {
                setLoadingTerminals(false);
            }
        };
        fetchTerminals();
    }, []);

    useEffect(() => {
        // We always want to listen if possible, but we filter or highlight if it's the active terminal
        const unsubscribe = subscribeToScan(async (data) => {
            if (!data.uid) {
                setCard(null);
                return;
            }

            try {
                const { data: cardData } = await supabase
                    .from('cards')
                    .select('*, customers(full_name)')
                    .eq('uid', data.uid.toUpperCase())
                    .maybeSingle();

                const mergedCard = {
                    uid: data.uid,
                    terminal_id: data.terminal_id, // Important for routing
                    source: data.source,
                    dbRecord: cardData,
                    metadata: typeof cardData?.metadata === 'string'
                        ? JSON.parse(cardData.metadata)
                        : (cardData?.metadata || {}),
                    customer: cardData?.customers
                };

                setCard(mergedCard);
            } catch (e) {
                console.error('Scan process error:', e);
            }
        });

        return () => unsubscribe();
    }, [subscribeToScan, card]);

    const handleInject = async () => {
        if (!card?.uid || isInjecting) return;

        setIsInjecting(true);
        try {
            // Priority 2: Actively selected terminal in context
            const targetTerminalId = card.terminal_id || activeTerminalId;

            // Optional: Check if target terminal is online
            const targetTerm = terminals.find(t => t.id.toString() === targetTerminalId?.toString());
            if (targetTerm && getTerminalStatus(targetTerm) === 'offline') {
                toast.warning(t('terminal_offline_warning') || 'الجهاز المختار غير متصل حالياً. قد لا يتم كتابة التوقيع على البطاقة مادياً، ولكن سيتم تحديث حالة الأمان في النظام.');
            }

            const updatedData = await injectCard(card.uid, targetTerminalId);

            // Update local state immediately so UI reflects "Secured" status
            if (updatedData) {
                const newMetadata = typeof updatedData.metadata === 'string' ? JSON.parse(updatedData.metadata) : (updatedData.metadata || {});

                setCard(prev => ({
                    ...prev,
                    dbRecord: updatedData,
                    metadata: newMetadata
                }));

                // If the card is now secured, finish the loading state
                if (newMetadata.secured) {
                    setIsInjecting(false);
                }
            }

            // Important: Even if writing to terminal fails or is pending, 
            // the database record is updated.
            toast.success(t('injection_db_updated') || 'تم تحديث أمان البطاقة في النظام بنجاح.');

        } catch (e) {
            setIsInjecting(false);
            console.error('Injection handling error:', e);
            toast.error(t('injection_error') || `فشل الحقن: ${e.message}`);
        }
    };

    const handleRevoke = async () => {
        if (!card?.uid || isInjecting) return;

        if (!confirm(t('confirm_revoke_security') || 'هل أنت متأكد من إبطال التوقيع الأمني لهذه البطاقة؟')) return;

        setLoading(true);
        try {
            const res = await fetch('/api/cards/revoke-signature', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: card.uid })
            });

            const data = await res.json();

            if (res.ok) {
                const updatedCard = data.card;
                // Update local state immediately so UI reflects "Unsecured" status
                if (updatedCard) {
                    setCard(prev => ({
                        ...prev,
                        dbRecord: updatedCard,
                        metadata: typeof updatedCard.metadata === 'string' ? JSON.parse(updatedCard.metadata) : (updatedCard.metadata || {})
                    }));
                }
                toast.success(t('revoke_success') || 'تم إبطال التوقيع الأمني بنجاح');
            } else {
                throw new Error(data.message || 'Failed to revoke security');
            }
        } catch (e) {
            console.error('Revoke Error:', e);
            toast.error(e.message || t('network_error'));
        } finally {
            setLoading(false);
        }
    };

    // Terminal status helper
    const getTerminalStatus = (term) => {
        if (!term.last_sync) return 'offline';
        const isOnline = (Date.now() - new Date(term.last_sync).getTime()) < 60000;
        return isOnline ? 'online' : 'offline';
    };

    // Card's terminal name
    const cardTerminalName = card?.terminal_id
        ? terminals.find(t => t.id.toString() === card.terminal_id.toString())?.name
        : null;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Status Column */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold flex items-center gap-2">
                                <Activity className="w-5 h-5 text-primary" />
                                {t('system_status') || 'حالة النظام'}
                            </h3>
                            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isConnected ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                {isConnected ? (t('online') || 'متصل') : (t('offline') || 'غير متصل')}
                            </div>
                        </div>

                        <div className="space-y-4 pt-2">
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl">
                                <span className="text-xs text-muted-foreground">{t('active_reader') || 'القارئ النشط'}</span>
                                <span className="text-xs font-bold truncate max-w-[120px]">{readerName}</span>
                            </div>

                            {/* Terminal Selector */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">
                                    {t('monitor_terminal') || 'تتبع جهاز محدد (عن بعد)'}
                                </label>
                                <select
                                    value={activeTerminalId || ''}
                                    onChange={(e) => setTerminalId(e.target.value)}
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 ring-primary/20"
                                >
                                    {terminals.map(term => (
                                        <option key={term.id} value={term.id}>
                                            {term.name} ({getTerminalStatus(term) === 'online' ? '✅' : '❌'})
                                        </option>
                                    ))}
                                    {terminals.length === 0 && <option value="">{t('loading') || 'جاري التحميل...'}</option>}
                                </select>
                            </div>

                            {!isConnected && (
                                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 rounded-2xl text-amber-700 dark:text-amber-400 text-[11px] leading-relaxed">
                                    <p className="font-bold mb-1">⚠️ {t('reader_disconnected_short') || 'لا يوجد قارئ نشط'}</p>
                                    <p>{t('bridge_remote_note') || 'تأكد من تشغيل الجسر المحلي أو اختيار جهاز "أونلاين" من القائمة أعلاه.'}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-primary to-blue-600 rounded-3xl p-6 shadow-lg text-white space-y-4">
                        <Shield className="w-10 h-10 opacity-50" />
                        <div>
                            <h3 className="font-bold text-lg">{t('security_center') || 'مركز الأمان'}</h3>
                            <p className="text-white/70 text-xs">
                                {t('security_desc') || 'أدوات تشفير وتأمين البطاقات المادية لضمان عدم التلاعب برصيد المشتركين.'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Card Info Column */}
                <div className="md:col-span-2 space-y-6">
                    {!card ? (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 shadow-sm border border-dashed flex flex-col items-center justify-center text-center space-y-4">
                            <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center animate-pulse">
                                <CreditCard className="w-10 h-10 text-gray-300" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-gray-400">{t('place_card') || 'يرجى وضع البطاقة على القارئ'}</h3>
                                <p className="text-gray-400 text-sm">{t('waiting_for_scan') || 'في انتظار عملية المسح...'}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-sm border">
                                <div className="p-1 bg-gradient-to-r from-primary/20 via-blue-500/20 to-primary/20" />
                                <div className="p-8 space-y-8">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${card.metadata?.secured ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                {card.metadata?.secured ? <ShieldCheck className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground mb-1">
                                                    {t('detected_card') || 'تم اكتشاف بطاقة'}
                                                </p>
                                                <h3 className="text-2xl font-mono font-bold tracking-tighter">
                                                    {card.uid}
                                                </h3>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${card.metadata?.secured ? 'bg-green-100 text-green-600 border border-green-200' : 'bg-red-100 text-red-600 border border-red-200'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${card.metadata?.secured ? 'bg-green-600' : 'bg-red-600'} animate-pulse`} />
                                                {card.metadata?.secured ? (t('secured_card') || 'بطاقة مؤمنة') : (t('unsecured_card') || 'بطاقة غير مهيئة')}
                                            </div>
                                            {cardTerminalName && (
                                                <p className="mt-2 text-[10px] text-muted-foreground font-bold">
                                                    📍 {cardTerminalName}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">{t('customer_name') || 'اسم العميل'}</p>
                                            <p className="font-bold text-sm">{card.customer?.full_name || t('unlinked_card') || 'بطاقة غير مرتبطة'}</p>
                                        </div>
                                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">{t('scan_source') || 'مصدر المسح'}</p>
                                            <p className="font-bold text-sm uppercase">{card.source || 'Local HID'}</p>
                                        </div>
                                    </div>

                                    <div className="pt-4 flex flex-col sm:flex-row gap-3">
                                        {!card.metadata?.secured ? (
                                            <button
                                                onClick={handleInject}
                                                disabled={isInjecting}
                                                className="flex-1 py-4 bg-primary text-white font-black rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-3 group"
                                            >
                                                {isInjecting ? (
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                ) : (
                                                    <Key className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                                                )}
                                                <span>{isInjecting ? (t('injecting') || 'جاري الحقن الأمني...') : (t('start_injection') || 'بدء الحقن الأمني')}</span>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={handleRevoke}
                                                className="flex-1 py-4 bg-red-50 text-red-600 border border-red-100 font-black rounded-2xl hover:bg-red-100 transition-all flex items-center justify-center gap-3 group"
                                            >
                                                <XCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                                <span>{t('revoke_security') || 'إبطال التوقيع الأمني'}</span>
                                            </button>
                                        )
                                        }
                                        <button
                                            onClick={() => setCard(null)}
                                            className="px-8 py-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                                        >
                                            {t('dismiss') || 'إغلاق'}
                                        </button>
                                    </div>

                                    {isInjecting && (
                                        <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-700/30 rounded-2xl flex items-start gap-3">
                                            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                                            <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed font-medium">
                                                {t('injection_process_desc') || 'جاري إرسال مفاتيح التشفير للبطاقة المتصلة بالقارئ. يرجى عدم تحريك البطاقة حتى انتهاء العملية.'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
