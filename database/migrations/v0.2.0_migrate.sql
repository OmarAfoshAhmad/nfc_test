-- Consolidated Migration for v0.2.0
-- This script contains all schema changes implemented since the initial release.
-- Use this to update your cloud Supabase database.

BEGIN;

-- 1. Authentication Updates (2FA)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS two_factor_secret text,
ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS backup_codes text[];

COMMENT ON COLUMN public.users.two_factor_secret IS 'Secret key for TOTP (2FA)';

-- 2. Financial System (Prepaid Wallet)
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) DEFAULT 0.00;

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

ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'WALLET', 'CARD'));

-- 3. Terminal Monitoring (Heartbeat)
ALTER TABLE public.terminals 
ADD COLUMN IF NOT EXISTS last_sync TIMESTAMPTZ;

-- 4. Realtime Configuration
-- Ensure scan_events exists and is configured for realtime
CREATE TABLE IF NOT EXISTS public.scan_events (
    id SERIAL PRIMARY KEY,
    terminal_id INT REFERENCES public.terminals(id) ON DELETE CASCADE,
    branch_id INT REFERENCES public.branches(id),
    uid TEXT NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.scan_events REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        -- Check if table is already in publication to avoid errors
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND schemaname = 'public' 
            AND tablename = 'scan_events'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_events;
        END IF;
    ELSE
        CREATE PUBLICATION supabase_realtime FOR TABLE public.scan_events;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

-- 5. Security & RLS
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'scan_events' 
        AND policyname = 'Allow read for scan events'
    ) THEN
        CREATE POLICY "Allow read for scan events" ON public.scan_events FOR SELECT USING (true);
    END IF;
END $$;

COMMIT;
