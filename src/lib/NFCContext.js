'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from './supabase';
import { NfcReader } from './hardware/NfcReader';

const NFCContext = createContext(null);

export function NFCProvider({ children }) {
    const [terminalInfo, setTerminalInfo] = useState(null);
    const [lastRefresh, setLastRefresh] = useState(Date.now());
    const [hwReader, setHwReader] = useState(null);
    const [isHwConnected, setIsHwConnected] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Callbacks ref needs to be accessible by hardware listener
    const scanCallbacksRef = useRef([]);

    // Hardware Reader Logic
    const connectHwReader = async () => {
        if (typeof window === 'undefined' || !('hid' in navigator)) {
            toast.error('WebHID requires Chrome/Edge and HTTPS');
            return false;
        }

        try {
            // Disconnect existing if any
            if (hwReader) await hwReader.disconnect();

            const reader = new NfcReader();

            reader.onScan = (uid) => {
                // Ensure UID is standardized
                const formattedUid = uid.toUpperCase();
                console.log('⚡ [HW] Fast Scan:', formattedUid);
                toast.success('Card Scanned (Local)');

                // Simulate event for listeners
                scanCallbacksRef.current.forEach(cb => {
                    cb({
                        uid: formattedUid,
                        type: 'scan',
                        status: 'PRESENT',
                        source: 'hardware',
                        timestamp: new Date().toISOString()
                    });
                });
            };

            reader.onCardRemoved = () => {
                console.log('⚡ [HW] Card Removed');
                // toast.info('Card Removed');
                scanCallbacksRef.current.forEach(cb => {
                    cb({
                        uid: null, // UID might be unknown on removal if we didn't track it here, or we can just send null
                        type: 'scan',
                        status: 'REMOVED',
                        source: 'hardware',
                        timestamp: new Date().toISOString()
                    });
                });
            };

            reader.onStatusChange = (status, msg) => {
                console.log(`[HW] Status: ${status} - ${msg}`);
                if (status === 'connected') {
                    setIsHwConnected(true);
                    toast.success(`Reader Connected: ${msg.split(':')[1] || 'USB'}`);
                } else if (status === 'disconnected') {
                    setIsHwConnected(false);
                    // toast.info('Reader Disconnected');
                } else if (status === 'error') {
                    setIsHwConnected(false);
                    toast.error(msg);
                }
            };

            const success = await reader.connect();
            if (success) {
                setHwReader(reader);
                return true;
            }
            return false;
        } catch (e) {
            console.error(e);
            toast.error('Failed to connect hardware reader');
            return false;
        }
    };

    useEffect(() => {
        // Cleanup hardware reader on unmount
        return () => {
            if (hwReader) hwReader.disconnect();
        };
    }, [hwReader]);

    // Existing Cloud Logic (unchanged but shortened for context)
    useEffect(() => {
        // Only run on client side
        if (typeof window === 'undefined') return;

        // ... (Existing implementation for Terminal selection & Supabase Realtime)
        // إذا لم يتم تحديد terminal، استخدم الافتراضي (1)
        const storedTerminalId = localStorage.getItem('selected_terminal');
        const terminalId = storedTerminalId || '1';
        if (!storedTerminalId) {
            localStorage.setItem('selected_terminal', terminalId);
        }
        if (!terminalId) return;

        console.log('📡 Starting NFC Context Monitoring for Terminal:', terminalId);

        // Initial Fetch
        const fetchInitialStatus = async () => {
            const { data } = await supabase.from('terminals').select('*').eq('id', terminalId).single();
            if (data) setTerminalInfo(data);
        };
        fetchInitialStatus();

        // Subscribe to scan events - ONLY INSERT (new scans), not UPDATE (removals)
        const scanChannel = supabase
            .channel(`nfc-scans-${terminalId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'scan_events', filter: `terminal_id=eq.${terminalId}` },
                (payload) => {
                    // Only process new card scans (INSERT), ignore updates (removals)
                    console.log('🎴 New Scan Event:', payload.new?.uid);
                    scanCallbacksRef.current.forEach(cb => {
                        cb({ ...payload.new, type: 'scan', eventType: payload.eventType, source: 'cloud' });
                    });
                }
            )
            .subscribe();

        // Subscribe to terminal updates
        const statusChannel = supabase
            .channel(`nfc-status-${terminalId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'terminals', filter: `id=eq.${terminalId}` },
                (payload) => {
                    setTerminalInfo(payload.new);
                }
            )
            .subscribe();

        // Refresh timer
        const interval = setInterval(() => {
            setLastRefresh(Date.now());
            fetchInitialStatus();
        }, 5000);

        setMounted(true);

        const handleStorageChange = (e) => {
            if (e.key === 'selected_terminal') {
                window.location.reload();
            }
        };
        window.addEventListener('storage', handleStorageChange);

        return () => {
            supabase.removeChannel(scanChannel);
            supabase.removeChannel(statusChannel);
            clearInterval(interval);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    // Derived State
    const lastSync = terminalInfo?.last_sync ? new Date(terminalInfo.last_sync) : null;
    const isCloudConnected = lastSync && (Date.now() - lastSync) < 60000 && !terminalInfo?.metadata?.is_shutdown;

    // Combined "Connected" state
    const isConnected = isCloudConnected || isHwConnected;

    const readerName = isHwConnected
        ? (hwReader?.device?.productName || 'USB Local Reader')
        : (isCloudConnected && terminalInfo?.metadata?.device_connected
            ? (terminalInfo.metadata.device_name || 'Cloud Reader')
            : 'Disconnected');

    const onScan = useCallback((callback) => {
        scanCallbacksRef.current.push(callback);
        return () => {
            scanCallbacksRef.current = scanCallbacksRef.current.filter(cb => cb !== callback);
        };
    }, []);

    const value = React.useMemo(() => ({
        isConnected: !!isConnected,
        isHwConnected,
        isCloudConnected,
        readerName: readerName,
        connectHwReader, // New export
        onScan,
        injectCard: async (uid) => {
            // ... (keep existing implementation)
            const terminalId = typeof window !== 'undefined' ? localStorage.getItem('selected_terminal') : null;
            /* ... */
            // Keep the function logic as is, or use simplified version below if too long
            // For safety, I'll return the existing logic from previous view if I can, but I'm rewriting the Provider.
            // I'll assume I need to rewrite the body of injectCard.
            if (!terminalId) {
                toast.error('Terminal ID not selected.');
                throw new Error('No terminal selected');
            }
            try {
                const res = await fetch('/api/terminals/actions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action_type: 'WRITE_SIGNATURE',
                        terminal_id: terminalId,
                        payload: { uid }
                    })
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.message || 'Failed to send command');
                }
                toast.success('Security Injection Command Sent');
            } catch (e) {
                console.error(e);
                toast.error(`Injection Failed: ${e.message}`);
                throw e;
            }
        }
    }), [isConnected, isHwConnected, isCloudConnected, readerName, onScan]); // Dependencies for useMemo

    return (
        <NFCContext.Provider value={value}>
            {children}
            {mounted && (
                <>
                    {!isConnected && (
                        <div className="fixed bottom-4 right-4 bg-red-600/90 backdrop-blur-sm text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl animate-pulse z-50" suppressHydrationWarning>
                            NFC Offline
                        </div>
                    )}
                    {isConnected && (
                        <div className={`fixed bottom-4 right-4 ${isHwConnected ? 'bg-amber-600' : 'bg-green-600'} backdrop-blur-sm text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl z-50`} suppressHydrationWarning>
                            {isHwConnected ? 'NFC: USB LOCAL' : 'NFC: CLOUD BRIDGE'}
                        </div>
                    )}
                </>
            )}
        </NFCContext.Provider>
    );
}

export const useNFC = () => {
    const context = useContext(NFCContext);
    if (!context) {
        throw new Error('useNFC must be used within an NFCProvider');
    }
    return context;
};
