'use client';
import { useState, useEffect, useRef } from 'react';
import { Plus, Building2, Zap, Trash2, Edit, Key, Monitor, Users, MapPin, RefreshCw, Eye, EyeOff, ShieldCheck, Lock } from 'lucide-react';
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
    const { t, language } = useLanguage();
    const { isConnected, onScan: subscribeToScan, injectCard, readerName } = useNFC();
    const [card, setCard] = useState(null);
    const [isInjecting, setIsInjecting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        if (!isConnected) return;

        const unsubscribe = subscribeToScan(async (data) => {
            // Handle card removal
            if (data.status === 'REMOVED') {
                setCard(null);
                setIsInjecting(false);
                setShowSuccess(false);
                return;
            }

            // Fetch latest card data from source of truth (cards table)
            // This prevents desync if the card was revoked in DB but still has physical signature
            try {
                const { data: dbCard } = await supabase
                    .from('cards')
                    .select('*')
                    .eq('uid', data.uid.toUpperCase())
                    .is('deleted_at', null)
                    .maybeSingle();

                const mergedCard = dbCard ? {
                    ...data,
                    metadata: {
                        ...data.metadata,
                        ...dbCard.metadata,
                        secured: dbCard.metadata?.secured || false
                    }
                } : data;

                setCard(mergedCard);

                // Auto-detect success if we were injecting and card became secured
                if (isInjecting && mergedCard.metadata?.secured) {
                    setIsInjecting(false);
                    setShowSuccess(true);
                }
            } catch (err) {
                console.error('Error fetching card details:', err);
                setCard(data); // Fallback
            }
        });

        return () => unsubscribe();
    }, [isConnected, subscribeToScan, isInjecting]);

    const handleInject = async () => {
        if (!card?.uid || isInjecting) return;

        setIsInjecting(true);

        try {
            // We use the context method which sends the command
            injectCard(card.uid);

            // Fallback timeout in case we don't get the update (e.g. bridge stuck)
            setTimeout(() => {
                setIsInjecting(false);
            }, 10000); // 10s timeout

        } catch (e) {
            setIsInjecting(false);
            toast.error(t('network_error'));
        }
    };

    const handleRevoke = async () => {
        if (!card?.uid || !confirm(t('confirm_revoke_signature') || 'Are you sure?')) return;

        const toastId = toast.loading(t('revoking_signature') || 'جاري إلغاء التوقيع...');
        try {
            const res = await fetch('/api/cards/revoke-signature', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: card.uid })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(t('revoke_signature_success'), { id: toastId });
                // Update local state immediately for instant feedback
                setCard(prev => prev ? ({
                    ...prev,
                    metadata: {
                        ...prev.metadata,
                        secured: false,
                        signature_valid: false
                    }
                }) : null);
            } else {
                toast.error(data.message || t('revoke_signature_failed'), { id: toastId });
            }
        } catch (err) {
            toast.error(t('network_error'), { id: toastId });
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Status Card */}
                <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                    <h3 className="text-xl font-black mb-6 text-gray-800 dark:text-white flex items-center gap-3">
                        <Key size={24} className="text-blue-500" />
                        {t('card_initialization') || 'تهيئة البطاقات الجديدة'}
                    </h3>

                    {!isConnected ? (
                        <div className="p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 rounded-2xl text-amber-700 dark:text-amber-400 text-sm">
                            <p className="font-bold mb-2">⚠️ {t('reader_disconnected') || 'القارئ غير متصل'}</p>
                            <p>{t('bridge_required_desc') || 'يرجى تشغيل برنامج الجسر المحلي (NFC Bridge) وتوصيل القارئ لتفعيل هذه الميزة.'}</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className={`p-8 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center transition-all duration-500 ${card ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-500/30' : 'bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700'}`}>
                                {!card ? (
                                    <>
                                        <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-2xl flex items-center justify-center shadow-lg mb-4 animate-pulse">
                                            <RefreshCw size={32} className="text-gray-300" />
                                        </div>
                                        <p className="text-gray-500 dark:text-gray-400 font-bold">{t('place_card_on_reader') || 'ضع البطاقة على القارئ الآن...'}</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/30 mb-4 animate-bounce">
                                            <Zap size={32} className="text-white fill-current" />
                                        </div>
                                        <p className="text-xs uppercase tracking-[0.3em] font-black text-blue-500 mb-1 leading-none">{t('card_detected') || 'تم اكتشاف بطاقة'}</p>
                                        <p className="text-3xl font-black text-gray-900 dark:text-white font-mono tracking-tighter mb-4">{card.uid}</p>

                                        <div className={`flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${card.metadata?.secured ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                            <div className={`w-2 h-2 rounded-full ${card.metadata?.secured ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                                            {card.metadata?.secured ? (t('card_already_secured') || 'بطاقة مؤمنة مسبقاً') : (t('card_unsecured') || 'بطاقة غير مهيئة')}
                                        </div>

                                        <div className="flex gap-3 w-full">
                                            <button
                                                onClick={handleInject}
                                                disabled={isInjecting || card.metadata?.secured}
                                                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                                            >
                                                {isInjecting ? <Loader2 className="animate-spin mx-auto" /> : (t('inject_signature_btn') || 'بدء عملية الحقن الأمني')}
                                            </button>

                                            {card.metadata?.secured && (
                                                <button
                                                    onClick={handleRevoke}
                                                    className="px-6 bg-purple-600 hover:bg-purple-500 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-purple-600/20 transition-all active:scale-95"
                                                    title={t('revoke_signature_btn')}
                                                >
                                                    <Lock size={24} />
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Instructions Card */}
                <div className="bg-gray-50 dark:bg-gray-900/50 p-8 rounded-3xl border border-gray-100 dark:border-gray-800">
                    <h3 className="text-lg font-black mb-4 text-gray-800 dark:text-white">{t('security_instructions') || 'تعليمات الأمان'}</h3>
                    <ul className="space-y-4">
                        {[
                            { title: 'AES-128', desc: 'يتم تشفير البيانات باستخدام خوارزمية AES-128 العالمية.' },
                            { title: 'Sector Locking', desc: 'بعد الحقن، يتم قفل القطاع الأمني بحيث لا يمكن قراءته إلا بواسطة هذا التطبيق.' },
                            { title: 'UID Dependency', desc: 'كل توقيع مرتبط برقم البطاقة الفريد (UID) لضمان عدم إمكانية نسخ التوقيع.' },
                            { title: 'One-Time Initialization', desc: 'تحتاج للقيام بهذه العملية مرة واحدة فقط قبل تسليم البطاقة للعميل.' }
                        ].map((item, i) => (
                            <li key={i} className="flex gap-4">
                                <div className="h-6 w-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center text-[10px] font-black text-blue-500 flex-shrink-0">
                                    {i + 1}
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-gray-700 dark:text-gray-200">{item.title}</p>
                                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">{item.desc}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Success Modal */}
            {showSuccess && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center relative overflow-hidden animate-in zoom-in-50 duration-500 border-2 border-emerald-500/20">
                        <div className="absolute inset-0 bg-emerald-500/5" />
                        <div className="relative">
                            <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                                <ShieldCheck size={48} className="text-emerald-500 animate-in zoom-in spin-in-12 duration-700" />
                            </div>
                            <h2 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mb-2">{t('injection_success_title') || 'تم الحقن بنجاح'}</h2>
                            <p className="text-gray-500 font-bold dark:text-gray-300 mb-8">{t('injection_success_msg') || 'تم تأمين البطاقة وتوقيعها بنجاح'}</p>

                            <button
                                onClick={() => setShowSuccess(false)}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
                            >
                                {t('close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Loader2({ className, size = 24 }) {
    return <RefreshCw className={`animate-spin ${className}`} size={size} />;
}
