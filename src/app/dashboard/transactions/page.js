'use client';
import { useState, useEffect } from 'react';
import { History, Receipt, ArrowDownRight, TrendingUp, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';
import DataTable from '@/components/DataTable';

export default function TransactionsPage() {
    const { t, dir } = useLanguage();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        async function fetchTx() {
            setLoading(true);
            try {
                const res = await fetch('/api/transactions');
                const data = await res.json();
                setTransactions(data.data || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        fetchTx();
    }, []);

    const filteredTx = transactions.filter(tx =>
        (tx.customer_name && tx.customer_name.toLowerCase().includes(search.toLowerCase())) ||
        tx.id.toString().includes(search)
    );

    const handleExportCSV = () => {
        if (transactions.length === 0) {
            toast.error(t('no_data'));
            return;
        }

        const headers = ['ID', 'Customer', 'Discount', 'Amount', 'Points', 'Status', 'Date'];
        const rows = filteredTx.map(tx => [
            tx.id,
            `"${tx.customer_name}"`,
            `"${tx.discount_name || 'N/A'}"`,
            tx.amount_after,
            tx.points_earned,
            tx.status,
            `"${new Date(tx.created_at).toLocaleString()}"`
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success(t('export_success') || 'Exported successfully!');
    };

    const handleClearLogs = async () => {
        if (!confirm(t('confirm_delete') || 'Are you sure you want to clear all logs?')) return;
        try {
            const res = await fetch('/api/transactions', { method: 'DELETE' });
            if (res.ok) {
                toast.success(t('delete_success'));
                setTransactions([]);
            }
        } catch (e) {
            toast.error(t('delete_error'));
        }
    };

    const columns = [
        {
            header: 'ID',
            accessor: 'id',
            className: 'font-mono text-[10px] text-gray-400 w-16'
        },
        {
            header: t('customer_name'),
            accessor: 'customer_name',
            className: 'font-bold text-gray-900 dark:text-white'
        },
        {
            header: t('discount'),
            accessor: 'discount_name',
            cell: (row) => row.discount_name ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 uppercase tracking-widest">
                    <TrendingUp size={10} />
                    {row.discount_name}
                </span>
            ) : (
                <span className="text-gray-300">---</span>
            )
        },
        {
            header: t('amount'),
            accessor: 'amount_after',
            className: 'font-mono font-bold text-gray-900 dark:text-white'
        },
        {
            header: t('packages') || 'الباقات',
            accessor: 'bundle_info',
            cell: (row) => {
                // Show bundle info if available
                if (row.bundle_info || row.campaign_name) {
                    return (
                        <div className="flex flex-col">
                            {row.campaign_name && (
                                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1 w-fit">
                                    <TrendingUp size={10} />
                                    {row.campaign_name}
                                </span>
                            )}
                            {row.coupon_count > 0 && (
                                <span className="text-[9px] text-gray-400 mt-1">
                                    {row.coupon_count} {t('coupons') || 'كوبون'}
                                </span>
                            )}
                        </div>
                    );
                }
                return <span className="text-gray-300">---</span>;
            }
        },
        {
            header: t('status'),
            accessor: 'status',
            cell: (row) => (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${row.status === 'success' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                    {row.status === 'success' ? t('status_success') : t('status_failed')}
                </span>
            )
        },
        {
            header: t('date'),
            accessor: 'created_at',
            cell: (row) => (
                <div className="text-gray-400 text-[11px] font-medium">
                    {new Date(row.created_at).toLocaleString(dir === 'rtl' ? 'ar-EG' : 'en-US')}
                </div>
            )
        }
    ];

    if (!mounted) return null;

    return (
        <div className="space-y-6" suppressHydrationWarning>
            <div className={`flex justify-between items-center mb-8`}>
                <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                    <History size={24} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3 text-start">
                        {t('nav_transactions')}
                    </h1>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={filteredTx}
                loading={loading}
                searchTerm={search}
                onSearchChange={setSearch}
                searchPlaceholder={t('search')}
                actions={
                    <div className="flex gap-2">
                        <button
                            onClick={handleExportCSV}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded-xl transition-all flex items-center gap-2 text-sm font-bold border border-blue-100"
                        >
                            <Download size={16} />
                            {t('export') || 'Export CSV'}
                        </button>
                        <button
                            onClick={handleClearLogs}
                            className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-xl transition-all flex items-center gap-2 text-sm font-bold border border-red-100"
                        >
                            <Trash2 size={16} />
                            {t('delete')}
                        </button>
                    </div>
                }
            />
        </div>
    );
}
