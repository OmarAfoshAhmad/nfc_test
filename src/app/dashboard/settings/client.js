'use client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Save, Settings as SettingsIcon, Coins, DollarSign } from 'lucide-react';
import { useSettings } from '@/lib/SettingsContext';

export default function SettingsClient() {
    const { updateSettingsState } = useSettings();
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState({
        currency_symbol: '€',
        points_ratio: '10'
    });

    useEffect(() => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                // Determine if data fetch succeeded in a way we expect
                if (data && typeof data === 'object') {
                    setSettings(data);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                toast.error('Failed to load settings');
                setLoading(false);
            });
    }, []);

    const handleChange = (e) => {
        setSettings({ ...settings, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            if (res.ok) {
                toast.success('Settings saved successfully');
                // Update global context immediately
                updateSettingsState(settings);
            } else {
                toast.error('Failed to save settings');
            }
        } catch (err) {
            toast.error('Network error');
        }
    };

    if (loading) return <div className="p-8">Loading...</div>;

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-2 text-gray-800 dark:text-white">
                <SettingsIcon className="w-8 h-8" />
                System Settings
            </h1>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* Currency Settings */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Currency Symbol
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <DollarSign size={18} />
                            </div>
                            <input
                                type="text"
                                name="currency_symbol"
                                value={settings.currency_symbol}
                                onChange={handleChange}
                                className="pl-10 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g. SAR, USD, LE"
                            />
                        </div>
                        <p className="mt-1 text-sm text-gray-500">The currency symbol displayed across the application.</p>
                    </div>

                    <hr className="border-gray-100 dark:border-gray-700" />

                    {/* Points Settings */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Points Earning Logic
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <Coins size={18} />
                            </div>
                            <input
                                type="number"
                                name="points_ratio"
                                value={settings.points_ratio}
                                onChange={handleChange}
                                min="1"
                                className="pl-10 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                placeholder="10"
                            />
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                            How much a customer needs to spend to earn <b>1 Point</b>.
                            (e.g. If set to 10, spending {settings.currency_symbol}100 earns 10 points).
                        </p>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
                        >
                            <Save size={18} />
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
