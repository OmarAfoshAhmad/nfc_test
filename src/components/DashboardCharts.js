'use client';
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';
import SafeResponsiveContainer from './SafeResponsiveContainer';

export default function DashboardCharts({ data = [] }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // If no data, show empty state or default empty array
    const chartData = data.length > 0 ? data : [
        { name: 'No Data', sales: 0, visits: 0 }
    ];

    if (!mounted) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 min-w-0 h-[400px] animate-pulse">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6"></div>
                    <div className="h-[300px] bg-gray-100 dark:bg-gray-900/50 rounded"></div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 min-w-0 h-[400px] animate-pulse">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6"></div>
                    <div className="h-[300px] bg-gray-100 dark:bg-gray-900/50 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 min-w-0">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Weekly Sales</h3>
                {/* 
                   Absolute Positioning Fix:
                   We use a relative container with fixed height, and an absolute inset-0 child.
                   This isolates the ResponsiveContainer from the parent's flex/grid layout logic,
                   forcing it to take the explicit size of the relative parent.
                */}
                <div className="relative h-[300px] w-full">
                    <div className="absolute inset-0">
                        <SafeResponsiveContainer>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                    cursor={{ fill: 'transparent' }}
                                />
                                <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </SafeResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 min-w-0">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Customer Visits</h3>
                <div className="relative h-[300px] w-full">
                    <div className="absolute inset-0">
                        <SafeResponsiveContainer>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Line type="monotone" dataKey="visits" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981' }} />
                            </LineChart>
                        </SafeResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
