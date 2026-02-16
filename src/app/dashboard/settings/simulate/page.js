'use client';

import React, { useState } from 'react';
import { Rocket, CheckCircle2, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function SimulateScanPage() {
    const [uid, setUid] = useState('0461765A466080');
    const [terminalId, setTerminalId] = useState('1');
    const [terminalSecret, setTerminalSecret] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchingTerminals, setFetchingTerminals] = useState(false);
    const [terminals, setTerminals] = useState([]);
    const [status, setStatus] = useState(null);

    const fetchTerminals = async () => {
        setFetchingTerminals(true);
        try {
            const res = await fetch('/api/debug/terminals');
            if (res.ok) {
                const { data } = await res.json();
                setTerminals(data || []);
                if (data?.length > 0 && !terminalSecret) {
                    setTerminalId(data[0].id.toString());
                    setTerminalSecret(data[0].terminal_secret);
                    toast.info('تم جلب بيانات أول جهاز متاح');
                }
            } else {
                toast.error('فشل جلب الأجهزة. تأكد أنك مسجل دخول كـ Admin');
            }
        } catch (err) {
            toast.error('خطأ في الاتصال');
        } finally {
            setFetchingTerminals(false);
        }
    };

    const handleScan = async () => {
        if (!terminalSecret) {
            toast.error('يرجى إدخال Terminal Secret');
            return;
        }

        setLoading(true);
        setStatus(null);

        try {
            const response = await fetch('/api/scan/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    terminal_id: parseInt(terminalId),
                    terminal_secret: terminalSecret,
                    uid: uid
                })
            });

            if (response.ok) {
                setStatus({ type: 'success', message: 'تم إرسال إشارة المسح بنجاح! راجع صفحة الـ Scan الآن.' });
                toast.success('تم إرسال إشارة المسح');
            } else {
                const data = await response.json().catch(() => ({}));
                setStatus({ type: 'error', message: data.message || 'فشل إرسال المسح' });
                toast.error(data.message || 'خطأ في السيرفر');
            }
        } catch (error) {
            setStatus({ type: 'error', message: 'تعذر الاتصال بالسيرفر' });
            toast.error('خطأ في الاتصال');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-6">
            <div className="rounded-2xl border border-blue-500/20 bg-slate-900/50 backdrop-blur-xl overflow-hidden">
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <h1 className="flex items-center gap-2 text-xl font-bold text-blue-400">
                        <Rocket className="w-6 h-6" />
                        محاكي مسح البطاقات (Debug Tool)
                    </h1>
                    <button
                        onClick={fetchTerminals}
                        disabled={fetchingTerminals}
                        className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1 transition-all"
                    >
                        {fetchingTerminals ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                        جلب بيانات الأجهزة
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {terminals.length > 0 && (
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">اختر جهازاً جاهزاً:</label>
                            <div className="flex flex-wrap gap-2">
                                {terminals.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => {
                                            setTerminalId(t.id.toString());
                                            setTerminalSecret(t.terminal_secret);
                                        }}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${terminalId === t.id.toString()
                                            ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                                            : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                                            }`}
                                    >
                                        {t.name} (ID: {t.id})
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-300">كود البطاقة (UID)</label>
                        <input
                            value={uid}
                            onChange={(e) => setUid(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg bg-slate-950/50 border border-slate-800 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                            placeholder="0461765A466080"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-300">رقم الجهاز (ID)</label>
                            <input
                                type="number"
                                value={terminalId}
                                onChange={(e) => setTerminalId(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg bg-slate-950/50 border border-slate-800 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-300 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> المفتاح (Secret)
                            </label>
                            <input
                                type="password"
                                value={terminalSecret}
                                onChange={(e) => setTerminalSecret(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg bg-slate-950/50 border border-slate-800 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                placeholder="أدخل السيكريت هنا"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleScan}
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl text-lg font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                    >
                        {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                        إرسال إشارة مسح تجريبية
                    </button>

                    {status && (
                        <div className={`p-4 rounded-xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${status.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/10 border-red-500/20 text-red-400'
                            }`}>
                            {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" /> : <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />}
                            <p className="font-medium text-sm">{status.message}</p>
                        </div>
                    )}

                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                        <p className="text-xs text-amber-400/80 leading-relaxed uppercase font-black tracking-tighter mb-2">تعليمات التشغيل 🛠️</p>
                        <ul className="text-[10px] text-amber-400/70 space-y-1 list-disc list-inside">
                            <li>اضغط على <b>"جلب بيانات الأجهزة"</b> في الأعلى لتعبئة البيانات تلقائياً.</li>
                            <li>تأكد من وجود عميل مسجل بـ UID المذكور أعلاه (أو غيره لعميل آخر).</li>
                            <li>ستظهر النتائج فوراً في صفحة الـ Scan المفتوحة في المتصفح.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
