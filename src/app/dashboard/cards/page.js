'use client';
import { useState, useEffect } from 'react';
import { Plus, CreditCard, Link as LinkIcon, AlertCircle, Edit, Trash2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';
import DataTable from '@/components/DataTable';
import NfcScanButton from '@/components/NfcScanButton';

export default function CardsPage() {
    const { t, dir, language } = useLanguage();
    const [mounted, setMounted] = useState(false);
    const [cards, setCards] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all, connected, recharge, disconnected
    const [expiryWarningDays, setExpiryWarningDays] = useState(7); // Default
    const [showModal, setShowModal] = useState(false);
    // Helper: Calculate date 2 months from a given date
    const calculateExpiryDate = (startDate) => {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + 2);
        return date.toISOString().split('T')[0];
    };
    const today = new Date().toISOString().split('T')[0];
    const [formData, setFormData] = useState({ id: null, uid: '', customer_id: '', valid_from: today, expires_at: calculateExpiryDate(today), is_active: true });
    const [showDeleted, setShowDeleted] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setMounted(true);
        fetchData();
        fetchSettings();
    }, [showDeleted]);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (data && Array.isArray(data.data)) {
                const days = parseInt(data.data.find(s => s.key_name === 'expiry_warning_days')?.value || '7');
                setExpiryWarningDays(days);
            }
        } catch (e) {
            console.error('Failed to load settings', e);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [cardsRes, customersRes] = await Promise.all([
                fetch(`/api/cards?deleted=${showDeleted}`),
                fetch('/api/customers')
            ]);
            const cardsData = await cardsRes.json();
            const customersData = await customersRes.json();

            setCards(cardsData.data || []);
            setCustomers(customersData.data || []);
        } catch (e) {
            toast.error(t('error_loading'));
        } finally {
            setLoading(false);
        }
    };

    // Helper to determine card status
    const getCardStatus = (card) => {
        if (!card.is_active) return 'disconnected'; // Manually Inactive
        if (!card.expires_at) return 'connected'; // No expiry = Connected
        const now = new Date();
        const expiryDate = new Date(card.expires_at);
        const warningDate = new Date();
        warningDate.setDate(warningDate.getDate() + expiryWarningDays);

        if (expiryDate < now) return 'disconnected'; // Expired
        if (expiryDate <= warningDate) return 'recharge'; // Near Expiry
        return 'connected'; // Healthy
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'connected': return t('connected');
            case 'recharge': return t('card_status_recharge');
            case 'disconnected': return t('disconnected');
            default: return status;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'connected': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'recharge': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
            case 'disconnected': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const isEdit = !!formData.id;
        try {
            const res = await fetch(isEdit ? `/api/cards/${formData.id}` : '/api/cards', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (res.ok) {
                setShowModal(false);
                setFormData({ id: null, uid: '', customer_id: '' });
                toast.success(isEdit ? t('save_success') : (t('save_success') || 'Card registered'));
                fetchData();
            } else {
                setError(data.message || t('save_error'));
            }
        } catch (err) {
            toast.error(t('network_error'));
        }
    };

    const handleDelete = async (id) => {
        if (!confirm(t('confirm_delete'))) return;
        try {
            const res = await fetch(`/api/cards/${id}`, { method: 'DELETE' });
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
            const res = await fetch('/api/cards', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, restore: true })
            });
            if (res.ok) {
                toast.success(t('restore_success'));
                fetchData();
            }
        } catch (e) {
            toast.error(t('restore_error'));
        }
    };

    const handlePermanentDelete = async (id) => {
        if (!confirm(t('confirm_permanent_delete') || 'Are you sure to delete permanently?')) return;
        try {
            const res = await fetch(`/api/cards/${id}?permanent=true`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(t('delete_success'));
                fetchData();
            } else {
                toast.error(t('delete_error'));
            }
        } catch (e) {
            toast.error(t('network_error'));
        }
    };

    const filteredCards = cards.filter(card => {
        const matchesSearch = card.uid.toLowerCase().includes(search.toLowerCase()) ||
            (card.customer_name && card.customer_name.toLowerCase().includes(search.toLowerCase()));

        if (statusFilter === 'all') return matchesSearch;

        const status = getCardStatus(card);
        return matchesSearch && status === statusFilter;
    });

    const columns = [
        {
            header: t('card_uid'),
            accessor: 'uid',
            className: 'font-mono font-bold text-blue-600 dark:text-blue-400'
        },
        {
            header: t('security_status') || 'Security',
            accessor: 'security',
            cell: (row) => {
                const isSecured = row.signature || row.metadata?.secured;
                return (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${isSecured
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400'
                        : 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'}`}>
                        {isSecured ? <ShieldCheck size={14} /> : <AlertCircle size={14} />}
                        <span className="text-[10px] font-black uppercase tracking-wider">
                            {isSecured ? (t('secured') || 'SECURED') : (t('unsecured') || 'UNSECURED')}
                        </span>
                    </div>
                );
            }
        },
        {
            header: t('customer_name'),
            accessor: 'customer_name',
            cell: (row) => row.customer_name ? (
                <span className="font-medium text-gray-900 dark:text-white">{row.customer_name}</span>
            ) : (
                <span className="text-gray-400 italic text-xs">{t('no_data')}</span>
            )
        },
        {
            header: t('valid_from') || 'Valid From',
            accessor: 'valid_from',
            cell: (row) => row.valid_from ? (
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                    {new Date(row.valid_from).toLocaleDateString()}
                </span>
            ) : <span className="text-gray-400">-</span>
        },
        {
            header: t('expires_at') || 'Expires At',
            accessor: 'expires_at',
            cell: (row) => {
                if (!row.expires_at) return <span className="text-gray-400">-</span>;
                const date = new Date(row.expires_at);
                const status = getCardStatus(row);
                // Highlight if expired or purge
                let colorClass = 'text-gray-600 dark:text-gray-400';
                if (status === 'disconnected') colorClass = 'text-red-500 font-bold';
                if (status === 'recharge') colorClass = 'text-yellow-600 font-bold';

                return (
                    <span className={`text-xs ${colorClass}`}>
                        {date.toLocaleDateString()}
                    </span>
                );
            }
        },
        {
            header: t('status'),
            accessor: 'status', // Virtual accessor
            cell: (row) => {
                const status = getCardStatus(row);
                return (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(status)}`}>
                        {getStatusLabel(status)}
                    </span>
                );
            }
        },
        {
            header: t('actions'),
            className: 'w-24',
            cell: (row) => (
                <div className={`flex gap-1`}>
                    {!showDeleted ? (
                        <>

                            <button
                                onClick={() => {
                                    setFormData({
                                        id: row.id,
                                        uid: row.uid,
                                        customer_id: row.customer_id || '',
                                        expires_at: row.expires_at ? new Date(row.expires_at).toISOString().split('T')[0] : '',
                                        valid_from: row.valid_from ? new Date(row.valid_from).toISOString().split('T')[0] : '',
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
                    ) : (
                        <>
                            <button
                                onClick={() => handleRestore(row.id)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg text-xs font-bold transition-all"
                            >
                                {t('restore')}
                            </button>
                            <button
                                onClick={() => handlePermanentDelete(row.id)}
                                className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-all"
                                title={t('delete_permanent') || 'Delete Forever'}
                            >
                                <Trash2 size={14} />
                            </button>
                        </>
                    )}
                </div>
            )
        }
    ];

    if (!mounted) return null;

    return (
        <div className="space-y-6" suppressHydrationWarning>
            <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
                <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
                    <button
                        onClick={() => {
                            const todayDate = new Date().toISOString().split('T')[0];
                            setFormData({ id: null, uid: '', customer_id: '', valid_from: todayDate, expires_at: calculateExpiryDate(todayDate), is_active: true });
                            setShowModal(true);
                        }}
                        className="flex-1 md:flex-none bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 font-bold flex items-center justify-center gap-2"
                    >
                        <Plus size={20} />
                        {t('link_card')}
                    </button>

                    {/* Status Filter */}
                    <div className="relative">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-bold text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                        >
                            <option value="all">{t('all') || 'الكل'}</option>
                            <option value="connected">{t('connected')}</option>
                            <option value="recharge">{t('card_status_recharge')}</option>
                            <option value="disconnected">{t('disconnected')}</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowDeleted(!showDeleted)}
                        className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all ${showDeleted
                            ? 'bg-red-100 text-red-600 ring-2 ring-red-200'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                    >
                        <Trash2 size={18} />
                        <span className="hidden sm:inline">{showDeleted ? t('hide_deleted') : t('show_deleted')}</span>
                    </button>
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center justify-end gap-3">
                        {showDeleted ? t('recycle_bin') : t('nav_cards')}
                    </h1>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={filteredCards}
                loading={loading}
                searchTerm={search}
                onSearchChange={setSearch}
                searchPlaceholder={t('search')}
            />

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md animate-in fade-in zoom-in duration-200 text-start">
                        <div className="flex items-center gap-2 mb-2 text-purple-600">
                            <CreditCard size={18} />
                            <span className="text-xs font-bold uppercase tracking-widest">{t('card_registry_badge') || 'NFC Registry'}</span>
                        </div>
                        <h2 className={`text-2xl font-bold mb-6 dark:text-white text-start`}>
                            {formData.id ? t('edit') : t('link_card')}
                        </h2>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl text-sm flex items-center gap-3 animate-shake">
                                <AlertCircle size={18} />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400`}>
                                        {t('card_uid')}
                                    </label>
                                    {!formData.id && <NfcScanButton onScan={(uid, additionalData) => {
                                        // Handle Removal
                                        if (additionalData?.status === 'REMOVED') {
                                            if (formData.uid === uid) {
                                                setFormData({ ...formData, uid: '', _securityCheck: false });
                                                toast.info(t('card_removed') || 'تم إزالة البطاقة');
                                            }
                                            return;
                                        }

                                        // Check security status from metadata
                                        const isSecured = additionalData?.metadata?.secured || false;
                                        setFormData({
                                            ...formData,
                                            uid: uid.toUpperCase(),
                                            _securityCheck: isSecured // Store internal check state
                                        });

                                        if (!isSecured) {
                                            // Don't show error, just update UI state to show it needs signing later
                                            console.log('New unverified card scanned');
                                        } else {
                                            toast.success(t('card_verified_badge'));
                                        }
                                    }} />}
                                </div>
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        required
                                        disabled={!!formData.id}
                                        className={`w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border ${formData.uid && !formData.id ? (formData._securityCheck ? 'border-green-500 ring-1 ring-green-500' : 'border-red-500 ring-1 ring-red-500') : 'border-gray-100 dark:border-gray-700'
                                            } rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-purple-500 font-mono transition-all disabled:opacity-50 uppercase`}
                                        value={formData.uid}
                                        onChange={(e) => setFormData({ ...formData, uid: e.target.value.toUpperCase(), _securityCheck: false /* Reset check on manual edit */ })}
                                        placeholder="e.g. 04 A1 B2 C3"
                                    />

                                    {/* Security Status feedback */}
                                    {formData.uid && !formData.id && (
                                        <div className={`text-xs flex items-center gap-2 font-bold px-2 ${formData._securityCheck ? 'text-green-600' : 'text-amber-600'}`}>
                                            {formData._securityCheck ? (
                                                <>
                                                    <ShieldCheck size={14} />
                                                    {t('card_verified_badge')}
                                                </>
                                            ) : (
                                                <>
                                                    <AlertCircle size={14} />
                                                    {t('card_unverified_warning') || 'تنبيه: لم يتم التحقق من التوقيع (سيتم إنشاء توقيع جديد عند الحفظ)'}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1`}>
                                    {t('customer_name')}
                                </label>
                                <select
                                    className={`w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-purple-500 transition-all`}
                                    value={formData.customer_id}
                                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                                >
                                    <option value="">{t('no_data')}</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1`}>
                                        {t('valid_from') || 'تاريخ البدء'}
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        className={`w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-purple-500 transition-all`}
                                        value={formData.valid_from || ''}
                                        onChange={(e) => {
                                            const newStartDate = e.target.value;
                                            setFormData({
                                                ...formData,
                                                valid_from: newStartDate,
                                                expires_at: calculateExpiryDate(newStartDate)
                                            });
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1`}>
                                        {t('expires_at')}
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        className={`w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-purple-500 transition-all`}
                                        value={formData.expires_at}
                                        onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                                    />
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-400">
                                {t('default_expiry_msg') || 'الافتراضي: شهرين من الآن'}
                            </p>

                            {formData.id && (
                                <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-gray-700 dark:text-white">{t('status')}</p>
                                        <p className="text-xs text-gray-400">{formData.is_active ? t('connected') : t('disconnected')}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${formData.is_active ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                                    >
                                        <span
                                            className={`${formData.is_active ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition duration-200`}
                                        />
                                    </button>
                                </div>
                            )}

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="submit"
                                    disabled={loading || (formData.uid && !formData.id && formData.uid.length < 4)}
                                    title={formData.uid && !formData.id && !formData._securityCheck ? t('unverified_warning_title') : ''}
                                    className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl shadow-lg transition-all"
                                >
                                    {t('save')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setFormData({ id: null, uid: '', customer_id: '', expires_at: '', valid_from: new Date().toISOString().split('T')[0], is_active: true });
                                    }}
                                    className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all font-bold"
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
