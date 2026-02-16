'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Search, CreditCard, User, Key, CheckCircle, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import NfcScanButton from '@/components/NfcScanButton';
import Link from 'next/link';

import { useSearchParams } from 'next/navigation';

export default function EnrollCardPage() {
    const searchParams = useSearchParams();
    const { t, language } = useLanguage();
    const [step, setStep] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [customers, setCustomers] = useState([]);
    const [loadingCustomers, setLoadingCustomers] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [scannedUid, setScannedUid] = useState(null);
    const [programming, setProgramming] = useState(false);
    const [programStatus, setProgramStatus] = useState('idle'); // idle, waiting, writing, success, error
    const [terminalId, setTerminalId] = useState(null);

    // Initial load of customers
    useEffect(() => {
        const storedTerminal = localStorage.getItem('selected_terminal');
        if (storedTerminal) setTerminalId(storedTerminal);

        // Check for Quick Program params
        // Use a slight delay to ensure customers are loaded if we want to validte customer existence, 
        // but for now we just trust the ID if provided or fetch details later.

        const uidParam = searchParams.get('uid');
        const customerIdParam = searchParams.get('customer_id');

        if (uidParam) {
            setScannedUid(uidParam);
            // If we have customer ID, try to find in list after fetching, or just set partial object
            if (customerIdParam && customerIdParam !== 'undefined' && customerIdParam !== 'null') {
                // We'll fetch this customer specifically or wait for list
                fetchCustomerById(customerIdParam).then(c => {
                    if (c) setSelectedCustomer(c);
                    setStep(3); // Go straight to program
                });
            } else {
                setStep(3); // Go straight to program (card only)
            }
        } else {
            fetchCustomers();
        }
    }, [searchParams]);

    const fetchCustomerById = async (id) => {
        const { data } = await supabase.from('customers').select('id, full_name, phone').eq('id', id).single();
        return data;
    };

    const fetchCustomers = async (search = '') => {
        setLoadingCustomers(true);
        try {
            let query = supabase
                .from('customers')
                .select('id, full_name, phone, student_id')
                .is('deleted_at', null)
                .limit(20);

            if (search) {
                query = query.ilike('full_name', `%${search}%`);
            }

            const { data, error } = await query;
            if (error) throw error;
            setCustomers(data || []);
        } catch (error) {
            console.error('Error fetching customers:', error);
            toast.error('Failed to load customers');
        } finally {
            setLoadingCustomers(false);
        }
    };

    const handleSearch = (e) => {
        const val = e.target.value;
        setSearchTerm(val);
        // Debounce simple
        setTimeout(() => {
            if (val === e.target.value) fetchCustomers(val);
        }, 500);
    };

    const handleSelectCustomer = (customer) => {
        setSelectedCustomer(customer);
        setStep(2);
    };

    const handleScan = (uid) => {
        setScannedUid(uid);
        setStep(3);
    };

    const startProgramming = async () => {
        if (!scannedUid || !terminalId) {
            toast.error('Missing information');
            return;
        }

        setProgramming(true);
        setProgramStatus('waiting');

        try {
            // 1. Register/Enroll in Backend (Generates Signature)
            const response = await fetch('/api/cards/enroll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uid: scannedUid,
                    customer_id: selectedCustomer ? selectedCustomer.id : null
                })
            });

            const result = await response.json();
            console.log('🔍 Full API Response:', result); // DEBUG LOG

            if (!response.ok) throw new Error(result.message);

            // Handle nested data structure from successResponse helper
            // v5 fix: Ensure we look in result.data
            const signature = result.data?.signature || result.signature;

            console.log('✅ NEW CODE LOADED. Signature:', signature);
            console.log('🔍 Full API Response:', result);

            if (!signature) {
                throw new Error('Server responded with success but NO Signature was found!');
            }

            // 2. Queue Action for Reader
            const { data: { user } } = await supabase.auth.getUser();

            const { data: actionData, error: actionError } = await supabase
                .from('terminal_actions')
                .insert({
                    terminal_id: terminalId,
                    action_type: 'WRITE_SIGNATURE',
                    payload: { signature, uid: scannedUid },
                    status: 'PENDING',
                    admin_id: user?.id
                })
                .select()
                .single();

            if (actionError) throw actionError;

            // 3. Listen for Completion (Robust: Realtime + Polling Fallback)
            setProgramStatus('writing');

            let isCompleted = false;

            // Strategy A: Realtime Listener
            const channel = supabase
                .channel(`action-${actionData.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'terminal_actions',
                        filter: `id=eq.${actionData.id}`
                    },
                    (payload) => {
                        handleCompletion(payload.new.status);
                    }
                )
                .subscribe((status) => {
                    console.log('Realtime Status:', status);
                });

            // Strategy B: Polling Fallback (Check every 1s)
            const interval = setInterval(async () => {
                if (isCompleted) return;

                const { data } = await supabase
                    .from('terminal_actions')
                    .select('status')
                    .eq('id', actionData.id)
                    .single();

                if (data && (data.status === 'COMPLETED' || data.status === 'FAILED')) {
                    console.log('Detected status change via polling:', data.status);
                    handleCompletion(data.status);
                }
            }, 1000);

            // Completion Handler
            const handleCompletion = (status) => {
                if (isCompleted) return; // Prevent double trigger

                if (status === 'COMPLETED') {
                    isCompleted = true;
                    setProgramStatus('success');
                    setProgramming(false);
                    toast.success('Card programmed successfully!');
                    cleanup();
                } else if (status === 'FAILED') {
                    isCompleted = true;
                    setProgramStatus('error');
                    setProgramming(false);
                    toast.error('Failed to write to card');
                    cleanup();
                }
            };

            const cleanup = () => {
                clearInterval(interval);
                supabase.removeChannel(channel);
            };

            // Timeout safety (20 seconds)
            setTimeout(() => {
                if (!isCompleted && programming) {
                    setProgramStatus('error');
                    setProgramming(false);
                    cleanup();
                    // Optional: Don't show error if it's just slow, let the user retry
                    // toast.error('Programming timed out. Check if Reader is active.');
                }
            }, 20000);

        } catch (error) {
            console.error(error);
            setProgramStatus('error');
            setProgramming(false);
            toast.error(error.message || 'Programming failed');
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <ShieldCheck className="w-8 h-8 text-primary" />
                        Card Programming
                    </h1>
                    <p className="text-muted-foreground">Enroll and secure NFC cards for customers</p>
                </div>
                {!terminalId && (
                    <div className="bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-bold animate-pulse">
                        ⚠️ No Terminal Selected
                    </div>
                )}
            </div>

            {/* Steps Indicator */}
            <div className="flex items-center gap-4">
                {[1, 2, 3].map((s) => (
                    <div key={s} className={`flex items-center gap-2 ${step >= s ? 'text-primary' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 
                            ${step >= s ? 'border-primary bg-primary/10' : 'border-gray-300'}`}>
                            {s}
                        </div>
                        <span className="font-medium">
                            {s === 1 && 'Select Customer'}
                            {s === 2 && 'Scan Card'}
                            {s === 3 && 'Program'}
                        </span>
                        {s < 3 && <ArrowRight size={16} className="text-gray-300 mx-2" />}
                    </div>
                ))}
            </div>

            {/* Step 1: Customer Selection */}
            {step === 1 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search by name..."
                            value={searchTerm}
                            onChange={handleSearch}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border bg-gray-50 dark:bg-gray-900 focus:ring-2 ring-primary/20 outline-none"
                        />
                    </div>

                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {customers.map(customer => (
                            <div
                                key={customer.id}
                                onClick={() => handleSelectCustomer(customer)}
                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl border transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                                        <User size={20} />
                                    </div>
                                    <div>
                                        <p className="font-bold">{customer.full_name}</p>
                                        <p className="text-xs text-muted-foreground">{customer.phone}</p>
                                    </div>
                                </div>
                                <ArrowRight size={16} className="text-gray-400" />
                            </div>
                        ))}
                        {loadingCustomers && <div className="text-center py-4 text-muted-foreground">Loading...</div>}
                    </div>

                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                        <button
                            onClick={() => { setSelectedCustomer(null); setStep(2); }}
                            className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all flex items-center justify-center gap-2"
                        >
                            <span>Skip & Program Card Only</span>
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Scan Card */}
            {step === 2 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border text-center space-y-6">
                    <div className="flex flex-col items-center gap-4">
                        {selectedCustomer && (
                            <>
                                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                                    <User size={32} />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Selected Customer</p>
                                    <h3 className="text-xl font-bold">{selectedCustomer.full_name}</h3>
                                </div>
                            </>
                        )}
                        {!selectedCustomer && (
                            <div>
                                <h3 className="text-xl font-bold text-gray-500">Unassigned Card</h3>
                                <p className="text-sm text-muted-foreground">Card won't be linked to a customer</p>
                            </div>
                        )}
                    </div>

                    <div className="py-8 border-t border-b border-dashed">
                        <p className="mb-4 text-lg">Place new card on terminal</p>
                        <div className="flex justify-center">
                            <NfcScanButton
                                onScan={handleScan}
                                className="!px-8 !py-4 !text-lg !bg-primary !text-white hover:!bg-primary/90"
                            />
                        </div>
                    </div>

                    <button
                        onClick={() => setStep(1)}
                        className="text-sm text-muted-foreground hover:underline"
                    >
                        Change Customer
                    </button>
                </div>
            )}

            {/* Step 3: Program */}
            {step === 3 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border text-center space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                            <p className="text-xs text-muted-foreground">Customer</p>
                            <p className="font-bold">{selectedCustomer?.full_name || 'Unassigned'}</p>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                            <p className="text-xs text-muted-foreground">Card UID</p>
                            <p className="font-mono font-bold">{scannedUid}</p>
                        </div>
                    </div>

                    {programStatus === 'idle' && (
                        <div className="py-6">
                            <button
                                onClick={startProgramming}
                                className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
                            >
                                <Key className="w-6 h-6" />
                                Program & Secure Card
                            </button>
                            <p className="mt-4 text-sm text-muted-foreground">
                                This will write a unique digital signature to the card.
                                <br />Please keep the card on the reader.
                            </p>
                        </div>
                    )}

                    {programStatus !== 'idle' && programStatus !== 'error' && programStatus !== 'success' && (
                        <div className="py-12 flex flex-col items-center gap-4 animate-in fade-in zoom-in">
                            {programStatus === 'waiting' && <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />}
                            {programStatus === 'writing' && <Loader2 className="w-16 h-16 text-purple-500 animate-spin" />}

                            <h3 className="text-xl font-bold">
                                {programStatus === 'waiting' ? 'Preparing...' : 'Writing to Card...'}
                            </h3>
                            <p className="text-muted-foreground">Do not remove the card</p>
                        </div>
                    )}

                    {programStatus === 'success' && (
                        <div className="py-8 flex flex-col items-center gap-4 text-green-600 animate-in fade-in zoom-in">
                            <CheckCircle className="w-20 h-20" />
                            <h3 className="text-2xl font-bold">Success!</h3>
                            <p className="text-gray-600 dark:text-gray-300">Card is now active and secured.</p>
                            <div className="pt-4 flex gap-3">
                                <button
                                    onClick={() => { setStep(1); setProgramStatus('idle'); setScannedUid(null); setSelectedCustomer(null); }}
                                    className="px-6 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg font-medium hover:bg-gray-200"
                                >
                                    Enroll Another
                                </button>
                                <Link
                                    href="/dashboard/cards"
                                    className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90"
                                >
                                    View Cards
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
