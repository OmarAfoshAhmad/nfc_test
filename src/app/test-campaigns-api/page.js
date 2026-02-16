// Test API Connection
// Navigate to: /test-campaigns-api

'use client';

import { useState } from 'react';

export default function TestCampaignsAPI() {
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const testAPI = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/campaigns?deleted=false');
            const data = await res.json();

            setResult({
                status: res.status,
                statusText: res.statusText,
                ok: res.ok,
                data: data,
                dataType: Array.isArray(data) ? 'Array' : typeof data,
                count: Array.isArray(data) ? data.length : 'N/A'
            });
        } catch (error) {
            setResult({
                error: error.message,
                stack: error.stack
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Test Campaigns API</h1>

            <button
                onClick={testAPI}
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
            >
                {loading ? 'Testing...' : 'Test API Connection'}
            </button>

            {result && (
                <div className="mt-6 bg-gray-100 p-6 rounded-lg">
                    <h2 className="text-xl font-bold mb-4">Result:</h2>
                    <pre className="bg-white p-4 rounded overflow-auto text-sm">
                        {JSON.stringify(result, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
