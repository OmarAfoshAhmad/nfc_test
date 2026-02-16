'use client';
import { useState, useEffect } from 'react';
import { Plus, Tag, Percent, DollarSign, Gift, Calendar, Trash2, TicketPercent, Edit, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';
import DataTable from '@/components/DataTable';

export default function DiscountsClient() {
    const { t, dir } = useLanguage();
    const [discounts, setDiscounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showDeleted, setShowDeleted] = useState(false);
    const [formData, setFormData] = useState({
        id: null,
        name: '',
        type: 'percentage',
        value: '',
        start_date: '',
        end_date: '',
        is_active: true
    });

    const fetchDiscounts = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/discounts?deleted=${showDeleted}`);
            const data = await res.json();
            setDiscounts(data.data || []);
        } catch (e) {
            toast.error(t('error_loading'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDiscounts();
    }, [showDeleted]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const isEdit = !!formData.id;
        try {
            const res = await fetch(isEdit ? `/api/discounts/${formData.id}` : '/api/discounts', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            if (res.ok) {
                toast.success(t('save_success'));
                setShowModal(false);
                setFormData({ id: null, name: '', type: 'percentage', value: '', start_date: '', end_date: '', is_active: true });
                fetchDiscounts();
            } else {
                toast.error(t('save_error'));
            }
        } catch (err) {
            toast.error(t('network_error'));
        }
    };

    const handleDelete = async (id) => {
        if (!confirm(t('confirm_delete'))) return;
        try {
            const res = await fetch(`/api/discounts?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(t('delete_success'));
                fetchDiscounts();
            }
        } catch (e) {
            toast.error(t('delete_error'));
        }
    };

    const handleRestore = async (id) => {
        try {
            const res = await fetch(`/api/discounts`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, restore: true }),
            });
            if (res.ok) {
                toast.success(t('restore_success') || 'Restored');
                fetchDiscounts();
            }
        } catch (e) {
            toast.error(t('restore_error'));
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'percentage': return <Percent size={14} />;
            case 'fixed_amount': return <DollarSign size={14} />;
            case 'gift': return <Gift size={14} />;
            default: return <Tag size={14} />;
        }
    };

    const filteredDiscounts = discounts.filter(d =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const columns = [
        {
            header: t('discount_name'),
            accessor: 'name',
            className: 'font-bold text-gray-900 dark:text-white'
        },
        {
            header: t('discount_type'),
            accessor: 'type',
            cell: (row) => (
                <div className="flex items-center gap-2">
                    <span className={`p-1.5 rounded-lg ${row.type === 'percentage' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' : 'bg-orange-50 text-orange-600 dark:bg-orange-900/20'}`}>
                        {getTypeIcon(row.type)}
                    </span>
                    <span className="text-xs font-medium">{t(row.type)}</span>
                </div>
            )
        },
        {
            header: t('discount_value'),
            accessor: 'value',
            cell: (row) => (
                <span className="text-lg font-black text-green-600 dark:text-green-400">
                    {row.type === 'percentage' ? `${row.value}%` : `$${row.value}`}
                </span>
            )
        },
        {
            header: t('status'),
            accessor: 'is_active',
            cell: (row) => (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${row.deleted_at ? 'bg-orange-100 text-orange-700' : row.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {row.deleted_at ? (t('deleted') || 'DELETED') : (row.is_active ? t('active') || 'ACTIVE' : t('deactivated') || 'INACTIVE')}
                </span>
            )
        },
        {
            header: t('actions'),
            className: 'w-24',
            cell: (row) => (
                <div className="flex gap-1 justify-center">
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
                                        type: row.type,
                                        value: row.value,
                                        start_date: row.start_date ? new Date(row.start_date).toISOString().slice(0, 16) : '',
                                        end_date: row.end_date ? new Date(row.end_date).toISOString().slice(0, 16) : '',
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
                                className="p-2 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
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
        <div className="space-y-6" suppressHydrationWarning>
            <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
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
                        className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 font-bold flex items-center justify-center gap-2"
                    >
                        <Plus size={20} />
                        {t('add_discount')}
                    </button>
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                        {t('nav_discounts')}
                    </h1>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={filteredDiscounts}
                loading={loading}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                searchPlaceholder={t('search')}
            />

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-lg animate-in fade-in zoom-in duration-200">
                        <div className={`flex items-center gap-2 mb-2 text-green-600 ${dir === 'rtl' ? 'justify-end' : ''}`}>
                            <TicketPercent size={18} />
                            <span className="text-xs font-bold uppercase tracking-widest">{t('promotion_badge') || 'Promotion'}</span>
                        </div>
                        <h2 className={`text-2xl font-bold mb-6 dark:text-white text-start`}>
                            {formData.id ? t('edit') : t('add_discount')}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start`}>
                                    {t('discount_name')}
                                </label>
                                <input
                                    type="text"
                                    required
                                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-green-500 transition-all text-start`}
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start`}>
                                        {t('discount_type')}
                                    </label>
                                    <select
                                        className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-green-500 transition-all text-start`}
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        <option value="percentage">{t('percentage')}</option>
                                        <option value="fixed_amount">{t('fixed_amount')}</option>
                                        <option value="gift">{t('gift')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start`}>
                                        {t('discount_value')}
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-green-500 transition-all text-start`}
                                        value={formData.value}
                                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                    />
                                </div>
                            </div>


                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50 dark:border-gray-700">
                                <div>
                                    <label className={`block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                                        {t('discount_start')}
                                    </label>
                                    <input
                                        type="datetime-local"
                                        className={`w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg text-xs dark:text-white outline-none ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                                        value={formData.start_date || ''}
                                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                                        {t('discount_end')}
                                    </label>
                                    <input
                                        type="datetime-local"
                                        className={`w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg text-xs dark:text-white outline-none ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                                        value={formData.end_date || ''}
                                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                    />
                                </div>
                            </div>

                            {formData.id && (
                                <div className="flex items-center gap-2 mt-4">
                                    <input
                                        type="checkbox"
                                        id="is_active"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                    />
                                    <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {t('is_active')}
                                    </label>
                                </div>
                            )}

                            <div className="flex gap-4 pt-4">
                                <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all">{t('save')}</button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setFormData({ id: null, name: '', type: 'percentage', value: '', start_date: '', end_date: '', is_active: true });
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
