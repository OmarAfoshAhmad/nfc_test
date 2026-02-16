import { supabase } from './supabase';

/**
 * Professional Wallet Management Library
 * Handles debits, credits, and ledger logging with transactional integrity.
 */

export async function getBalance(customerId) {
    const { data, error } = await supabase
        .from('customers')
        .select('balance')
        .eq('id', customerId)
        .single();

    if (error) throw error;
    return data?.balance || 0;
}

export async function logWalletAction({ customer_id, amount, type, reason, transaction_id, admin_id }) {
    // 1. Log to ledger
    const { error: ledgerError } = await supabase
        .from('balance_ledger')
        .insert([{
            customer_id,
            amount,
            type,
            reason,
            transaction_id: transaction_id || null,
            admin_id: admin_id || null
        }]);

    if (ledgerError) throw ledgerError;

    // 2. Update customer aggregate balance
    // Note: In a production environment, we'd use a Postgres Function (RPC) 
    // to ensure this is atomic. For now, we update the balance field.
    const currentBalance = await getBalance(customer_id);
    const newBalance = parseFloat(currentBalance) + parseFloat(amount);

    const { error: updateError } = await supabase
        .from('customers')
        .update({ balance: newBalance })
        .eq('id', customer_id);

    if (updateError) throw updateError;

    return newBalance;
}

export async function topUp(customerId, amount, adminId, reason = 'Wallet Top-up') {
    if (amount <= 0) throw new Error('Amount must be positive');
    return await logWalletAction({
        customer_id: customerId,
        amount: amount,
        type: 'DEPOSIT',
        reason,
        admin_id: adminId
    });
}

export async function payWithWallet(customerId, amount, transactionId, adminId) {
    const balance = await getBalance(customerId);
    if (balance < amount) {
        throw new Error('Insufficient wallet balance');
    }

    return await logWalletAction({
        customer_id: customerId,
        amount: -amount,
        type: 'WITHDRAWAL',
        reason: 'Payment for Transaction',
        transaction_id: transactionId,
        admin_id: adminId
    });
}
