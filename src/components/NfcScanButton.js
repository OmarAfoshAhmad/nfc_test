'use client';
import React, { useState, useEffect } from 'react';
import { Loader2, Scan } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';
import { useNFC } from '@/lib/NFCContext';

export default function NfcScanButton({ onScan, className = "" }) {
    const { t } = useLanguage();
    const { isConnected, onScan: subscribeToScan, connectHwReader } = useNFC();
    const [isScanning, setIsScanning] = useState(false);

    useEffect(() => {
        if (!isConnected) return;

        // Auto-subscribe to scans when component is mounted and reader is ready
        const unsubscribe = subscribeToScan((data) => {
            // Accept ANY card with a UID
            if (data.uid) {
                onScan(data.uid, data);
                setIsScanning(false);

                if (data.secured) {
                    toast.success(t('card_scanned_success') || 'تم قراءة البطاقة بنجاح');
                } else {
                    // Just a info/warning toast, not an error blocking the flow
                    toast.info(t('card_scanned_unverified') || 'تم قراءة بطاقة جديدة (غير موقعة)');
                }
            } else {
                toast.error(data.message || 'Error reading card');
                setIsScanning(false);
            }
        });

        return () => unsubscribe();
    }, [isConnected, onScan, subscribeToScan, t]);

    const handleClick = async () => {
        let activeConnection = isConnected;

        if (!activeConnection) {
            // Try to connect local hardware directly (WebHID)
            try {
                const success = await connectHwReader();
                if (success) {
                    activeConnection = true;
                } else {
                    toast.error(t('reader_not_connected') || 'القارئ غير متصل. يرجى تشغيل برنامج الجسر أو توصيل القارئ USB مباشرة.');
                    return;
                }
            } catch (e) {
                toast.error(t('reader_not_connected'));
                return;
            }
        }

        setIsScanning(true);

        // Timeout handling
        setTimeout(() => {
            setIsScanning(isScanningNow => {
                if (isScanningNow) {
                    // Only show message if we were still scanning (meaning no event received)
                    toast(t('scan_timeout') || 'انتهت مهلة المسح - لم يتم اكتشاف بطاقة');
                    return false;
                }
                return isScanningNow;
            });
        }, 15000); // 15s timeout
    };

    if (isScanning) {
        return (
            <button
                type="button"
                onClick={() => setIsScanning(false)}
                className={`flex items-center gap-2 px-3 py-2 bg-amber-500 text-white rounded-xl font-bold animate-pulse ${className}`}
            >
                <Loader2 size={16} className="animate-spin" />
                <span className="text-xs">{t('scanning') || 'جاري المسح...'}</span>
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white border-blue-500/20 ${className}`}
            title={t('scan') || 'مسح'}
        >
            <Scan size={16} className="text-current" />
            <span className="text-xs">{t('scan') || 'مسح'}</span>
        </button>
    );
}
