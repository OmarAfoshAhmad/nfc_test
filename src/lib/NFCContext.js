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
    const [selectedTerminalId, setSelectedTerminalId] = useState(null);
    const terminalIdRef = useRef(null);

    // Callbacks ref needs to be accessible by hardware listener
    const scanCallbacksRef = useRef([]);
    const lastProcessedUidRef = useRef(null);
    const lastProcessedTimeRef = useRef(0);

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

                // Client-side de-duplication
                const now = Date.now();
                if (formattedUid === lastProcessedUidRef.current && (now - lastProcessedTimeRef.current < 1500)) {
                    console.log('🛡️ [NFCContext] Blocking Duplicate HW Scan:', formattedUid);
                    return;
                }

                lastProcessedUidRef.current = formattedUid;
                lastProcessedTimeRef.current = now;

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

    const fetchInitialStatus = useCallback(async (tid) => {
        const id = tid || terminalIdRef.current;
        if (!id) return;
        try {
            const { data } = await supabase.from('terminals').select('*').eq('id', id).maybeSingle();
            if (data) setTerminalInfo(data);
        } catch (err) {
            console.error('Fetch Status Error:', err);
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const tid = localStorage.getItem('selected_terminal') || '1';
        setSelectedTerminalId(tid);
        terminalIdRef.current = tid;
        setMounted(true);
    }, []);

    // Monitoring Effect - Re-runs if terminalId changes
    useEffect(() => {
        // Only run on client side
        if (typeof window === 'undefined' || !selectedTerminalId) return;

        const terminalId = selectedTerminalId;
        terminalIdRef.current = terminalId;

        // If terminalId changes, ensure localStorage is updated
        if (localStorage.getItem('selected_terminal') !== terminalId) {
            localStorage.setItem('selected_terminal', terminalId);
        }

        console.log('📡 Starting NFC Context Monitoring for Terminal:', terminalId);

        // Initial Fetch
        fetchInitialStatus(terminalId);

        // Subscribe to scan events - ONLY INSERT (new scans), not UPDATE (removals)
        const scanChannel = supabase
            .channel(`nfc-scans-${terminalId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'scan_events', filter: `terminal_id=eq.${terminalId}` },
                (payload) => {
                    // Only process new card scans (INSERT), ignore updates (removals)
                    const newUid = payload.new?.uid;
                    if (!newUid) return;

                    // Client-side de-duplication (1.5s window for same UID)
                    const now = Date.now();
                    if (newUid === lastProcessedUidRef.current && (now - lastProcessedTimeRef.current < 1500)) {
                        console.log('🛡️ [NFCContext] Blocking Duplicate RT Scan:', newUid);
                        return;
                    }

                    lastProcessedUidRef.current = newUid;
                    lastProcessedTimeRef.current = now;

                    console.log('🎴 New Scan Event:', newUid);

                    // Mark as processed immediately to prevent poll duplication
                    if (payload.new?.id) {
                        supabase.from('scan_events').update({ processed: true }).eq('id', payload.new.id)
                            .then(({ error }) => {
                                if (error) console.error('[NFCContext] Error marking processed:', error);
                            });
                    }

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

        // Refresh timer for terminal status
        const statusInterval = setInterval(() => {
            setLastRefresh(Date.now());
            fetchInitialStatus(terminalId);
        }, 5000);

        // Polling Fallback for Scans (Backup for WebSocket)
        const scanPollInterval = setInterval(async () => {
            if (!terminalId) return;

            try {
                // Fetch the latest unprocessed scan event for this terminal
                const { data } = await supabase
                    .from('scan_events')
                    .select('*')
                    .eq('terminal_id', terminalId)
                    .eq('processed', false)
                    .eq('status', 'PRESENT')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (data && data.uid) {
                    // Time filter: ignore events older than 15 seconds
                    const eventTime = new Date(data.created_at).getTime();
                    const now = Date.now();

                    if (now - eventTime < 15000) {
                        // Client-side de-duplication
                        if (data.uid === lastProcessedUidRef.current && (now - lastProcessedTimeRef.current < 1500)) {
                            // Still mark as processed even if we block the callback
                            await supabase.from('scan_events').update({ processed: true }).eq('id', data.id);
                            return;
                        }

                        console.log('📡 [Poll] Missed Scan recovered:', data.uid);

                        lastProcessedUidRef.current = data.uid;
                        lastProcessedTimeRef.current = now;

                        // Mark as processed in DB immediately
                        await supabase.from('scan_events').update({ processed: true }).eq('id', data.id);

                        // Trigger callbacks
                        scanCallbacksRef.current.forEach(cb => {
                            cb({ ...data, type: 'scan', source: 'poll' });
                        });
                    } else {
                        // Mark stale event as processed
                        await supabase.from('scan_events').update({ processed: true }).eq('id', data.id);
                    }
                }
            } catch (err) {
                console.error('NFC Polling Error:', err);
            }
        }, 3000); // Check every 3s

        const handleStorageChange = (e) => {
            if (e.key === 'selected_terminal' && e.newValue !== selectedTerminalId) {
                setSelectedTerminalId(e.newValue);
            }
        };
        window.addEventListener('storage', handleStorageChange);

        return () => {
            supabase.removeChannel(scanChannel);
            supabase.removeChannel(statusChannel);
            clearInterval(statusInterval);
            clearInterval(scanPollInterval);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [selectedTerminalId, fetchInitialStatus]);

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
        terminalId: selectedTerminalId,
        setTerminalId: setSelectedTerminalId,
        connectHwReader, // New export
        onScan,
        injectCard: async (uid, terminalIdOverride) => {
            const finalTerminalId = terminalIdOverride || selectedTerminalId;
            if (!finalTerminalId) {
                toast.error('Terminal ID not selected.');
                throw new Error('No terminal selected');
            }

            try {
                // 1. Ensure card is enrolled in DB (Generates signature record)
                const enrollRes = await fetch('/api/cards/enroll', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uid })
                });

                const enrollData = await enrollRes.json();

                if (!enrollRes.ok) {
                    console.warn('Enrollment pre-check warning:', enrollData);
                    throw new Error(enrollData.message || 'Failed to enroll/verify card');
                }

                // 2. Send WRITE_SIGNATURE command to terminal
                const res = await fetch('/api/terminals/actions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action_type: 'WRITE_SIGNATURE',
                        terminal_id: finalTerminalId,
                        payload: { uid }
                    })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.message || 'Failed to send command');
                }

                toast.success('Security Injection Command Sent');

                // Return the enrolled card data to update UI immediately
                return enrollData.data || enrollData;
            } catch (e) {
                console.error('Injection Error:', e);
                toast.error(`Injection Failed: ${e.message}`);
                throw e;
            }
        }
    }), [isConnected, isHwConnected, isCloudConnected, readerName, onScan, selectedTerminalId]); // Dependencies for useMemo

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
