'use client';
import React from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { Search } from 'lucide-react';

export default function DataTable({
    columns,
    data,
    loading,
    searchTerm,
    onSearchChange,
    searchPlaceholder,
    actions
}) {
    const { t, dir } = useLanguage();

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            {/* Table Header / Search */}
            <div className={`p-4 border-b border-gray-50 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center justify-between`}>
                {actions && <div className="flex gap-2 w-full md:w-auto">{actions}</div>}
                <div className="relative w-full md:w-96">
                    <div className={`absolute inset-y-0 ${dir === 'rtl' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center pointer-events-none text-gray-400`}>
                        <Search size={18} />
                    </div>
                    <input
                        type="text"
                        placeholder={searchPlaceholder || t('search')}
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className={`w-full ${dir === 'rtl' ? 'pr-11 pl-4 text-right' : 'pl-11 pr-4 text-left'} py-2.5 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all dark:text-white`}
                    />
                </div>
            </div>

            {/* Table Body */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50/50 dark:bg-gray-900/30 border-b border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold">
                            {columns.map((col, idx) => (
                                <th
                                    key={idx}
                                    className={`px-6 py-4 text-start ${col.className || ''}`}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                        {loading ? (
                            <tr>
                                <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-400 italic">
                                    {t('loading')}
                                </td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-400">
                                    {t('no_data')}
                                </td>
                            </tr>
                        ) : (
                            data.map((row, rowIdx) => (
                                <tr
                                    key={rowIdx}
                                    className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group"
                                >
                                    {columns.map((col, colIdx) => (
                                        <td
                                            key={colIdx}
                                            className={`px-6 py-4 text-gray-700 dark:text-gray-300 text-start ${col.className || ''}`}
                                        >
                                            {col.cell ? col.cell(row) : row[col.accessor]}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
