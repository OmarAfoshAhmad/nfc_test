'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, Copy, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function TwoFactorSetup() {
    const { t } = useLanguage();
    const [status, setStatus] = useState('loading'); // loading, enabled, disabled
    const [step, setStep] = useState('initial'); // initial, qr, success
    const [loading, setLoading] = useState(false);
    const [qrData, setQrData] = useState(null);
    const [secret, setSecret] = useState('');
    const [token, setToken] = useState('');

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json();
            if (res.ok) {
                setStatus(data.user.two_factor_enabled ? 'enabled' : 'disabled');
            }
        } catch (err) {
            console.error('Failed to fetch 2FA status');
        }
    };

    const startSetup = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/auth/2fa/setup', { method: 'POST' });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message);

            setQrData(data.qrCode);
            setSecret(data.secret);
            setStep('qr');
        } catch (err) {
            toast.error('Failed to start 2FA setup: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const verifyAndEnable = async () => {
        if (token.length !== 6) {
            toast.error(t('invalid_code') || 'Please enter a valid 6-digit code');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/2fa/enable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            setStep('success');
            setStatus('enabled');
            toast.success(t('2fa_enabled_msg') || 'Two-factor authentication enabled successfully!');
        } catch (err) {
            toast.error('Verification failed: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const disable2FA = async () => {
        if (!confirm(t('confirm_disable_2fa') || 'Are you sure you want to disable 2FA? This will reduce your account security.')) return;

        setLoading(true);
        try {
            const res = await fetch('/api/auth/2fa/disable', { method: 'POST' });
            if (res.ok) {
                setStatus('disabled');
                setStep('initial');
                toast.success(t('2fa_disabled_msg') || '2FA disabled successfully');
            } else {
                const data = await res.json();
                throw new Error(data.message);
            }
        } catch (err) {
            toast.error('Failed to disable 2FA: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (status === 'loading') {
        return (
            <div className="flex justify-center p-4">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        );
    }

    if (status === 'enabled' && step !== 'success') {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-semibold text-green-800 dark:text-green-300">{t('two_factor_auth')}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            <span className="text-sm text-green-600 dark:text-green-400">{t('active')}</span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={disable2FA}
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-2 font-medium"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('disable_2fa')}
                </button>
            </div>
        );
    }

    if (step === 'initial') {
        return (
            <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
                    <div className="w-10 h-10 bg-amber-100 dark:bg-amber-800 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 mt-1">
                        <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-amber-800 dark:text-amber-300">{t('two_factor_auth')}</h4>
                        <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
                            {t('security_desc')}
                        </p>
                    </div>
                </div>
                <button
                    onClick={startSetup}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('enable_2fa')}
                </button>
            </div>
        );
    }

    if (step === 'qr') {
        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="text-center space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">1. Scan this QR code with your authenticator app</p>
                    {qrData && (
                        <div className="flex justify-center p-6 bg-white rounded-2xl shadow-inner border mx-auto w-fit">
                            <img src={qrData} alt="2FA QR Code" className="w-40 h-40" />
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    <label className="text-xs text-gray-500 font-bold uppercase tracking-wider">Manual Setup Key</label>
                    <div className="flex gap-2">
                        <code className="flex-1 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl text-sm font-mono break-all border dark:border-gray-700">{secret}</code>
                        <button
                            className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors border dark:border-gray-700"
                            onClick={() => {
                                navigator.clipboard.writeText(secret);
                                toast.success('Copied to clipboard');
                            }}
                        >
                            <Copy className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>
                </div>

                <div className="space-y-3 pt-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400">2. Enter the 6-digit verification code</p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={token}
                            onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000 000"
                            className="flex-1 p-3 border dark:border-gray-700 rounded-xl text-center tracking-[0.5em] text-xl font-bold bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            maxLength={6}
                            autoFocus
                        />
                        <button
                            onClick={verifyAndEnable}
                            disabled={loading || token.length !== 6}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center shadow-lg shadow-blue-500/20"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enable'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'success') {
        return (
            <div className="text-center p-8 space-y-4 animate-in zoom-in">
                <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 shadow-xl shadow-green-500/10">
                    <CheckCircle2 className="w-10 h-10" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">Success!</h3>
                    <p className="text-gray-500 dark:text-gray-400">Two-factor authentication is now active.</p>
                </div>
                <button
                    onClick={() => setStep('initial')}
                    className="text-sm text-blue-600 font-medium hover:underline"
                >
                    Back to settings
                </button>
            </div>
        );
    }

    return null;
}
