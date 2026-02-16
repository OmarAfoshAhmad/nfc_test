'use client';

import { useState, useEffect } from 'react';
import { Users, Coins, CreditCard, Activity, ArrowRight } from 'lucide-react';
import StatsCard from '@/components/analytics/StatsCard';
import TransactionsChart from '@/components/analytics/TransactionsChart';
import { useLanguage } from '@/lib/LanguageContext';
import { toast } from 'sonner';

export default function Dashboard() {
    const { t } = useLanguage();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/analytics/dashboard')
            .then(res => res.json())
            .then(json => {
                if (json.data) {
                    setData(json.data);
                } else {
                    toast.error(t('error_loading'));
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                toast.error(t('network_error'));
                setLoading(false);
            });
    }, [t]);

    if (loading) {
        return (
            <div className="space-y-8 animate-pulse p-4 lg:p-0">
                <div className="flex justify-between items-center">
                    <div className="space-y-2">
                        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                        <div className="h-4 w-64 bg-gray-100 dark:bg-gray-800 rounded-lg"></div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700"></div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 h-80 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700"></div>
                    <div className="h-80 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700"></div>
                </div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="space-y-8 animate-in fade-in duration-500" suppressHydrationWarning>
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('nav_home')}</h1>
                    <p className="text-gray-500 mt-1">{t('enterprise_desc')}</p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatsCard
                    title={t('nav_customers')}
                    value={data.totalCustomers}
                    icon={Users}
                    color="blue"
                />
                <StatsCard
                    title={t('customer_points')}
                    value={data.totalPoints.toLocaleString()}
                    icon={Coins}
                    color="orange"
                />
            </div>

            {/* Discounts Statistics Section - Full Width */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-green-500" />
                        {t('discounts_completed') || 'الخصومات المنجزة'}
                    </h3>
                    <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        {t('last_7_days') || 'آخر 7 أيام'}
                    </span>
                </div>

                {data.discountsChartData && data.discountsChartData.length > 0 ? (
                    <div className="space-y-4">
                        {data.discountsChartData.map((day, idx) => {
                            const maxCount = Math.max(...data.discountsChartData.map(d => d.count)) || 1;
                            const percentage = (day.count / maxCount) * 100;

                            return (
                                <div key={idx} className="flex items-center gap-4 group">
                                    <span className="text-sm font-bold text-gray-600 dark:text-gray-400 w-16">
                                        {day.date}
                                    </span>
                                    <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden relative">
                                        <div
                                            className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-lg transition-all duration-500 flex items-center justify-end pr-3"
                                            style={{ width: `${Math.max(percentage, 8)}%` }}
                                        >
                                            {day.count > 0 && (
                                                <span className="text-xs font-bold text-white">
                                                    {day.count}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-sm font-mono font-bold text-gray-500 w-20 text-right">
                                        €{day.total}
                                    </span>
                                </div>
                            );
                        })}

                        {/* Summary */}
                        <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <span className="text-sm text-gray-400">{t('total') || 'الإجمالي'}</span>
                            <div className="flex items-center gap-6">
                                <span className="text-lg font-bold text-green-600">
                                    {data.discountsChartData.reduce((sum, d) => sum + d.count, 0)} {t('discounts') || 'خصم'}
                                </span>
                                <span className="text-lg font-bold text-gray-900 dark:text-white">
                                    €{data.discountsChartData.reduce((sum, d) => sum + d.total, 0).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 text-center py-12">{t('no_data')}</p>
                )}
            </div>
        </div>
    );
}
