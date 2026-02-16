-- Migration: Add Prepaid Wallet System
BEGIN;

-- 1. Add balance column to customers
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) DEFAULT 0.00;

-- 2. Create balance_ledger table for financial traceability
CREATE TABLE IF NOT EXISTS public.balance_ledger (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES public.customers(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL, -- Positive for deposits, negative for withdrawals
    type TEXT NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAWAL', 'REFUND')),
    reason TEXT,
    transaction_id INT REFERENCES public.transactions(id) ON DELETE SET NULL,
    admin_id INT REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Update transactions table to support wallet payment
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'WALLET', 'CARD'));

COMMIT;
