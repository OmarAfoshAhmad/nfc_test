'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Trash2, Edit, CreditCard, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';
import DataTable from '@/components/DataTable';
import SearchableSelect from '@/components/SearchableSelect';
import NfcScanButton from '@/components/NfcScanButton';

export default function CustomersPage() {
    const { t } = useLanguage();
    return (
        <Suspense fallback={<div className="flex items-center justify-center p-20 font-bold opacity-50">{t('loading')}</div>}>
            <CustomersContent />
        </Suspense>
    );
}

function CustomersContent() {
    const { t, dir } = useLanguage();
    const [mounted, setMounted] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ id: null, full_name: '', phone: '', email: '', uid: '', type: 'single' });
    const [availableCards, setAvailableCards] = useState([]);
    const [showDeleted, setShowDeleted] = useState(false);

    const searchParams = useSearchParams();
    const uidFromUrl = searchParams.get('uid');

    useEffect(() => {
        setMounted(true);
        // Fetch cards for the dropdown
        fetch('/api/cards')
            .then(res => res.json())
            .then(data => setAvailableCards(data.data || []))
            .catch(err => console.error('Failed to load cards', err));
    }, []);

    // Helper to find card for specific customer
    const getCustomerCard = (customerId) => {
        return availableCards.find(c => c.customer_id === customerId)?.uid || '';
    }

    useEffect(() => {
        if (uidFromUrl && mounted) {
            setFormData(prev => ({ ...prev, uid: uidFromUrl }));
            setShowModal(true);
        }
    }, [uidFromUrl, mounted]);

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/customers?search=${encodeURIComponent(search)}&deleted=${showDeleted}`);
            const data = await res.json();
            setCustomers(data.data || []);
        } catch (e) {
            toast.error(t('error_loading'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timeout = setTimeout(fetchCustomers, 300);
        return () => clearTimeout(timeout);
    }, [search, showDeleted]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const isEdit = !!formData.id;
        try {
            const res = await fetch(isEdit ? `/api/customers/${formData.id}` : '/api/customers', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            if (res.ok) {
                setShowModal(false);
                setFormData({ id: null, full_name: '', phone: '', email: '', uid: '', type: 'single' });
                toast.success(t('save_success') || 'Success');
                fetchCustomers();
            } else {
                const error = await res.json();
                toast.error(error.message || t('save_error'));
            }
        } catch (err) {
            toast.error(t('network_error'));
        }
    };

    const handleDelete = async (id) => {
        if (!confirm(t('confirm_delete') || 'Are you sure?')) return;
        try {
            const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(t('delete_success') || 'Deleted');
                fetchCustomers();
            }
        } catch (e) {
            toast.error(t('delete_error'));
        }
    };

    const handleRestore = async (id) => {
        try {
            const res = await fetch('/api/customers', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, restore: true })
            });
            if (res.ok) {
                toast.success(t('restore_success'));
                fetchCustomers();
            }
        } catch (e) {
            toast.error(t('restore_error'));
        }
    };

    const handlePermanentDelete = async (id) => {
        if (!confirm(t('confirm_permanent_delete') || 'Are you sure you want to delete this permanently?')) return;
        try {
            const res = await fetch(`/api/customers/${id}?permanent=true`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(t('delete_success'));
                fetchCustomers();
            } else {
                toast.error(t('delete_error'));
            }
        } catch (e) {
            toast.error(t('network_error'));
        }
    };

    const columns = [
        {
            header: t('customer_name'),
            accessor: 'full_name',
            className: 'font-bold text-gray-900 dark:text-white'
        },
        {
            header: t('customer_type_label'),
            accessor: 'type',
            cell: (row) => (
                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${row.type === 'family'
                        ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300'
                        : 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-300'
                    }`}>
                    {row.type === 'family' ? t('type_family_short') : t('type_single_short')}
                </span>
            )
        },
        {
            header: t('card_uid'),
            accessor: 'card_uid',
            cell: (row) => (
                row.card_uid ? (
                    <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded border dark:border-gray-600">
                        {row.card_uid}
                    </span>
                ) : (
                    <span className="text-gray-400 text-xs">-</span>
                )
            )
        },
        { header: t('customer_phone'), accessor: 'phone' },
        {
            header: t('customer_wallet'),
            accessor: 'balance',
            cell: (row) => (
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {parseFloat(row.balance || 0).toFixed(2)}
                </span>
            )
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
                                        full_name: row.full_name,
                                        phone: row.phone || '',
                                        email: row.email || '',
                                        uid: getCustomerCard(row.id),
                                        type: row.type || 'single'
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
                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 font-bold flex items-center justify-center gap-2"
                    >
                        <UserPlus size={20} />
                        {t('register_customer')}
                    </button>
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
                        {showDeleted ? t('recycle_bin') : t('nav_customers')}
                    </h1>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={customers}
                loading={loading}
                searchTerm={search}
                onSearchChange={setSearch}
                searchPlaceholder={t('search')}
            />

            {/* Modal - Modern & Bilingual */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center gap-2 mb-2 text-blue-600">
                            <UserPlus size={18} />
                            <span className="text-xs font-bold uppercase tracking-widest">{t('new_member_badge') || 'New Member'}</span>
                        </div>
                        <h2 className={`text-2xl font-bold mb-6 dark:text-white text-start`}>
                            {formData.id ? t('edit') : t('register_customer')}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start`}>
                                    {t('customer_name')}
                                </label>
                                <input
                                    type="text"
                                    required
                                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all text-start`}
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start`}>
                                    {t('customer_phone')}
                                </label>
                                <input
                                    type="text"
                                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start`}>
                                    {t('customer_email')}
                                </label>
                                <input
                                    type="email"
                                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            {/* نوع العميل */}
                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start`}>
                                    {t('customer_type') || 'نوع العميل'}
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, type: 'single' })}
                                        className={`p-3 rounded-xl border-2 font-bold transition-all flex flex-col items-center gap-1 ${formData.type === 'single'
                                            ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-500 text-cyan-600 dark:text-cyan-400'
                                            : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-cyan-300'
                                            }`}
                                    >
                                        <span className="text-lg">👤</span>
                                        <span className="text-xs">{t('customer_single') || 'عازب'}</span>
                                        <span className="text-[10px] opacity-60">10% {t('discount') || 'خصم'}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, type: 'family' })}
                                        className={`p-3 rounded-xl border-2 font-bold transition-all flex flex-col items-center gap-1 ${formData.type === 'family'
                                            ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-500 text-purple-600 dark:text-purple-400'
                                            : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-purple-300'
                                            }`}
                                    >
                                        <span className="text-lg">👨‍👩‍👧‍👦</span>
                                        <span className="text-xs">{t('customer_family') || 'عائلة'}</span>
                                        <span className="text-[10px] opacity-60">20% {t('discount') || 'خصم'}</span>
                                    </button>
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2`}>
                                        <CreditCard size={14} className="text-blue-500" />
                                        {t('card_uid')}
                                    </label>
                                    <NfcScanButton onScan={(uid) => setFormData({ ...formData, uid: uid.toUpperCase() })} />
                                </div>
                                <SearchableSelect
                                    options={availableCards
                                        .filter(c => !c.customer_id || (formData.id && c.customer_id === formData.id))
                                        .map(c => ({
                                            value: c.uid,
                                            label: `${c.uid} ${c.customer_id ? `(${t('card_status_current')})` : `(${t('card_status_available')})`}`
                                        }))}
                                    value={formData.uid}
                                    onChange={(val) => setFormData({ ...formData, uid: (val || '').toUpperCase() })}
                                    placeholder={t('search') || "Search..."}
                                />
                                {uidFromUrl && <p className={`text-[10px] text-blue-500 mt-2 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('autofilled_msg') || 'Auto-filled from scan'}</p>}
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all"
                                >
                                    {t('save')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setFormData({ id: null, full_name: '', phone: '', email: '', uid: '', type: 'single' });
                                    }}
                                    className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-3.5 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all font-bold"
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
