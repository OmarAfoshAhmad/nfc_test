'use client';

import { useState, useEffect } from 'react';
import {
    Landmark,
    DollarSign,
    Wallet,
    Coins,
    TrendingUp,
    ArrowUpRight,
    ArrowDownRight,
    PieChart,
    Activity,
    Info,
    Calendar,
    Download
} from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/LanguageContext';
import { toast } from 'sonner';
import StatsCard from '@/components/analytics/StatsCard';
import { useSettings } from '@/lib/SettingsContext';

export default function FinanceHub() {
    const { t, dir } = useLanguage();
    const { settings } = useSettings();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const currency = settings.currency_symbol || '€';

    useEffect(() => {
        const fetchFinanceData = async () => {
            try {
                const res = await fetch('/api/analytics/finance');
                const json = await res.json();
                if (json.data) {
                    setData(json.data);
                } else {
                    toast.error(t('error_loading'));
                }
            } catch (err) {
                console.error(err);
                toast.error(t('network_error'));
            } finally {
                setLoading(false);
            }
        };
        fetchFinanceData();
    }, [t]);

    if (loading) {
        return (
            <div className="space-y-8 animate-pulse p-4 lg:p-0" dir={dir}>
                <div className="h-10 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg mb-8"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-2xl"></div>
                    ))}
                </div>
                <div className="h-96 bg-gray-100 dark:bg-gray-800 rounded-3xl"></div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="max-w-7xl mx-auto pb-12 animate-in fade-in duration-700" dir={dir}>
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white flex items-center gap-4">
                        <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/20">
                            <Landmark size={32} />
                        </div>
                        {t('finance_hub_title')}
                    </h1>
                    <p className="text-gray-500 dark:text-slate-400 font-medium mt-2">
                        {t('finance_hub_desc')}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 flex items-center gap-3 px-4">
                        <Calendar size={18} className="text-blue-500" />
                        <span className="text-sm font-black text-gray-700 dark:text-gray-300">{t('last_7_days')}</span>
                    </div>
                </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                    title={t('total_cash_revenue')}
                    value={`${currency} ${data.totalCash?.toLocaleString()}`}
                    icon={DollarSign}
                    color="blue"
                    className="border-none shadow-xl shadow-blue-500/5"
                />
                <StatsCard
                    title={t('total_wallet_spending')}
                    value={`${currency} ${data.totalWalletSpend?.toLocaleString()}`}
                    icon={Wallet}
                    color="purple"
                    className="border-none shadow-xl shadow-purple-500/5"
                />
                <StatsCard
                    title={t('total_topups')}
                    value={`${currency} ${data.totalTopups?.toLocaleString()}`}
                    icon={Coins}
                    color="orange"
                    className="border-none shadow-xl shadow-orange-500/5"
                />
                <StatsCard
                    title={t('total_savings')}
                    value={`${currency} ${data.totalSavings?.toLocaleString()}`}
                    icon={TrendingUp}
                    color="emerald"
                    className="border-none shadow-xl shadow-emerald-500/5"
                />
            </div>

            {/* Charts & Analysis Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-10">

                {/* Visual Chart Area */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-sm border border-gray-100 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                                <Activity className="text-blue-500" />
                                {t('revenue_vs_savings')}
                            </h3>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{t('cash')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{t('wallet')}</span>
                                </div>
                            </div>
                        </div>

                        {/* Custom SVG Bar Chart */}
                        <div className="relative h-64 flex items-end justify-between gap-4 pt-4 px-2">
                            {data.chartData.map((day, idx) => {
                                const maxVal = Math.max(...data.chartData.map(d => d.total)) || 1;
                                const cashHeight = (day.cash / maxVal) * 100;
                                const walletHeight = (day.wallet / maxVal) * 100;

                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center group">
                                        <div className="w-full relative flex flex-col items-center justify-end h-full">
                                            {/* Tooltip on hover */}
                                            <div className="absolute bottom-full mb-2 bg-slate-900 text-white text-[10px] p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                                                {day.fullDate}<br />
                                                {currency} {day.total.toLocaleString()}
                                            </div>

                                            {/* Stacked Bar */}
                                            <div className="w-full max-w-[40px] flex flex-col-reverse rounded-t-lg overflow-hidden transition-all group-hover:scale-110">
                                                <div style={{ height: `${cashHeight}%` }} className="bg-blue-600/90 w-full" />
                                                <div style={{ height: `${walletHeight}%` }} className="bg-purple-600/90 w-full" />
                                            </div>
                                        </div>
                                        <span className="mt-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">
                                            {new Date(day.fullDate).toLocaleDateString(dir === 'rtl' ? 'ar-EG' : 'en-US', { weekday: 'short' })}
                                        </span>
                                    </div>
                                );
                            })}
                            <div className="absolute inset-x-0 bottom-[35px] h-[1px] bg-gray-100 dark:bg-slate-800 -z-10" />
                        </div>
                    </div>

                    {/* Retention & Growth Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-blue-500/20">
                            <div className="relative z-10">
                                <h4 className="text-indigo-100 font-bold text-sm uppercase tracking-widest mb-1">{t('wallet_retention')}</h4>
                                <div className="text-3xl font-black mb-4">{currency} {data.walletRetention?.toLocaleString()}</div>
                                <p className="text-indigo-100/70 text-xs leading-relaxed max-w-[200px]">
                                    {t('have_balance_msg')}
                                </p>
                            </div>
                            <Wallet className="absolute -right-6 -bottom-6 w-32 h-32 text-white/10 -rotate-12" />
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                                <div className={`p-3 rounded-2xl ${data.is_positive_growth ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-red-50 dark:bg-red-900/20 text-red-600'}`}>
                                    {data.is_positive_growth ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{t('financial_growth')}</div>
                                    <div className={`text-2xl font-black ${data.is_positive_growth ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {data.is_positive_growth ? '+' : ''}{data.growth_percentage}%
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6">
                                <div className="h-1.5 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className={`h-full ${data.is_positive_growth ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.min(Math.abs(data.growth_percentage), 100)}%` }} />
                                </div>
                                <p className="text-[10px] text-gray-400 mt-2 font-bold tracking-tight">
                                    {data.is_positive_growth
                                        ? t('growth_performance_note_positive').replace('{percent}', data.growth_percentage)
                                        : t('growth_performance_note_negative').replace('{percent}', Math.abs(data.growth_percentage))
                                    }
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Top Selling Packages Section */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-sm border border-gray-100 dark:border-slate-800">
                        <h3 className="text-xl font-black text-gray-900 dark:text-white mb-8 flex items-center gap-3">
                            <PieChart size={24} className="text-purple-500" />
                            {t('top_selling_packages')}
                        </h3>

                        <div className="space-y-6">
                            {data.topPackages && data.topPackages.length > 0 ? data.topPackages.map((pkg, idx) => (
                                <div key={idx} className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center font-black text-gray-400">
                                        #{idx + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm font-black text-gray-800 dark:text-gray-200 truncate max-w-[140px]">
                                                {pkg.name === 'Generic Purchase' ? t('generic_purchase') : pkg.name}
                                            </span>
                                            <span className="text-xs font-black text-blue-600">{pkg.count} {t('sales_count')}</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-gray-50 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500 transition-all duration-1000"
                                                style={{ width: `${(pkg.count / data.topPackages[0].count) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-10">
                                    <Info className="mx-auto text-gray-300 mb-2" size={32} />
                                    <p className="text-sm text-gray-400 font-bold">{t('no_data')}</p>
                                </div>
                            )}
                        </div>

                        <Link
                            href="/dashboard/transactions"
                            className="w-full mt-10 p-4 bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-2xl text-xs font-black text-gray-600 dark:text-gray-300 transition-all flex items-center justify-center gap-2"
                        >
                            {t('nav_transactions')}
                            <ArrowUpRight size={14} />
                        </Link>
                    </div>

                    {/* Quick Warning/Note */}
                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/40 p-6 rounded-3xl">
                        <div className="flex gap-4">
                            <div className="p-2 bg-amber-500 text-white rounded-xl h-fit">
                                <Info size={16} />
                            </div>
                            <div>
                                <h5 className="text-sm font-black text-amber-900 dark:text-amber-200 mb-1">{t('security_note_title')}</h5>
                                <p className="text-[10px] text-amber-800/70 dark:text-amber-200/50 font-medium leading-relaxed">
                                    {t('security_note_desc')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
