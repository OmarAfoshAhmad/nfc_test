import { supabase, supabaseAdmin } from './supabase';

/**
 * Professional Wallet Management Library
 * Handles debits, credits, and ledger logging with transactional integrity.
 */

const db = supabaseAdmin || supabase;

export async function getBalance(customerId) {
    const { data, error } = await db
        .from('customers')
        .select('balance')
        .eq('id', customerId)
        .single();

    if (error) throw error;
    return data?.balance || 0;
}

export async function logWalletAction({ customer_id, amount, type, reason, transaction_id, admin_id }) {
    // CRITICAL SAFETY GUARD: Prevent bulk updates if customer_id is missing
    if (!customer_id) {
        throw new Error('CRITICAL: logWalletAction called without customer_id. Operation aborted to protect data integrity.');
    }

    const normalizedAmount = parseFloat(amount);
    const normalizedAdminId = Number.isInteger(Number(admin_id)) ? Number(admin_id) : null;

    const { data, error } = await db.rpc('wallet_apply_delta', {
        p_customer_id: customer_id,
        p_amount: normalizedAmount,
        p_type: type,
        p_reason: reason || null,
        p_transaction_id: transaction_id || null,
        p_admin_id: normalizedAdminId
    });

    if (error) throw error;
    return parseFloat(data || 0);
}

export async function topUp(customerId, amount, adminId, reason = 'Wallet Top-up') {
    const numericAmount = parseFloat(amount);
    if (!numericAmount || numericAmount <= 0) throw new Error('Amount must be positive');
    return await logWalletAction({
        customer_id: customerId,
        amount: numericAmount,
        type: 'DEPOSIT',
        reason,
        admin_id: adminId
    });
}

export async function payWithWallet(customerId, amount, transactionId, adminId) {
    const numericAmount = parseFloat(amount);
    if (!numericAmount || numericAmount <= 0) throw new Error('Amount must be positive');

    const balance = await getBalance(customerId);
    if (balance < numericAmount) {
        throw new Error('Insufficient wallet balance');
    }

    return await logWalletAction({
        customer_id: customerId,
        amount: -numericAmount,
        type: 'WITHDRAWAL',
        reason: 'Payment for Transaction',
        transaction_id: transactionId,
        admin_id: adminId
    });
}
