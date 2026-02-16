'use client';

import { useState, useEffect } from 'react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart
} from 'recharts';

export default function TransactionsChart({ data }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Ensure the component is mounted on the client
        setMounted(true);
    }, []);

    // Placeholder until mounted or if no data
    if (!mounted || !data || data.length === 0) {
        return (
            <div className="h-[300px] w-full flex items-center justify-center text-gray-400 bg-gray-50/50 dark:bg-gray-900/20 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                {(!data || data.length === 0) ? 'No data available' : 'Loading Chart...'}
            </div>
        );
    }

    return (
        <div className="w-full h-full min-h-[300px]">
            {/* 
                Using aspect={2} (or similar) is often more stable than height="100%" 
                when ResponsiveContainer is inside a dynamically sized parent.
            */}
            <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                    data={data}
                    margin={{
                        top: 10,
                        right: 10,
                        left: -20,
                        bottom: 0,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6B7280', fontSize: 12 }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6B7280', fontSize: 12 }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#fff',
                            borderRadius: '8px',
                            border: '1px solid #E5E7EB',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#3B82F6"
                        fill="#EFF6FF"
                        strokeWidth={3}
                        animationDuration={1000}
                        isAnimationActive={true}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
