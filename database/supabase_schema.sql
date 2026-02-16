-- Supabase / Postgres Schema for NFC Discount System
-- Enable Realtime for relevant tables
BEGIN;

-- Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'staff' CHECK (role IN ('superadmin', 'admin', 'staff')),
    branch_id INT REFERENCES public.branches(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Branches Table
CREATE TABLE IF NOT EXISTS public.branches (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Terminals Table
CREATE TABLE IF NOT EXISTS public.terminals (
    id SERIAL PRIMARY KEY,
    branch_id INT REFERENCES public.branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    connection_url TEXT NOT NULL,
    terminal_secret TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    is_active BOOLEAN DEFAULT TRUE,
    last_sync TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
    id SERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    points_balance INT DEFAULT 0,
    balance DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cards Table
CREATE TABLE IF NOT EXISTS public.cards (
    id SERIAL PRIMARY KEY,
    uid TEXT NOT NULL UNIQUE,
    customer_id INT REFERENCES public.customers(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Realtime Events Table (For Push-based Notifications)
CREATE TABLE IF NOT EXISTS public.scan_events (
    id SERIAL PRIMARY KEY,
    terminal_id INT REFERENCES public.terminals(id) ON DELETE CASCADE,
    branch_id INT REFERENCES public.branches(id),
    uid TEXT NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate Limits Table (Distributed for global scale)
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id SERIAL PRIMARY KEY,
    key_name TEXT NOT NULL,
    attempt_count INT DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL,
    last_attempt TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_window ON public.rate_limits (key_name, window_start);

-- Discounts Table
CREATE TABLE IF NOT EXISTS public.discounts (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed_amount', 'gift')),
    value DECIMAL(10,2) NOT NULL,
    points_required INT DEFAULT 0,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES public.customers(id) ON DELETE SET NULL,
    card_id INT REFERENCES public.cards(id) ON DELETE SET NULL,
    discount_id INT REFERENCES public.discounts(id) ON DELETE SET NULL,
    amount_before DECIMAL(10,2) DEFAULT 0,
    amount_after DECIMAL(10,2) DEFAULT 0,
    points_earned INT DEFAULT 0,
    status TEXT DEFAULT 'success',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Points Ledger (For traceability)
CREATE TABLE IF NOT EXISTS public.points_ledger (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES public.customers(id) ON DELETE CASCADE,
    points INT NOT NULL,
    reason TEXT,
    transaction_id INT REFERENCES public.transactions(id) ON DELETE SET NULL,
    admin_id INT REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings Table (Key-Value pair for global config)
CREATE TABLE IF NOT EXISTS public.settings (
    key_name TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id SERIAL PRIMARY KEY,
    admin_id INT REFERENCES public.users(id) ON DELETE SET NULL,
    admin_username TEXT,
    action_type TEXT NOT NULL,
    entity_name TEXT,
    entity_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime for scan_events
ALTER TABLE public.scan_events REPLICA IDENTITY FULL;

-- Add scan_events to the Supabase Realtime publication
-- This ensures that Supabase actually broadcasts changes to this table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_events;
    ELSE
        CREATE PUBLICATION supabase_realtime FOR TABLE public.scan_events;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

-- Enable RLS for scan_events (Security best practice)
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;

-- Allow authenticated and anon users to read scan events (needed for realtime subscription)
CREATE POLICY "Allow read for scan events" ON public.scan_events FOR SELECT USING (true);

-- Allow authenticated users to mark scan events as processed
CREATE POLICY "Allow update for scan events" ON public.scan_events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Storage Setup (Run manualy in Supabase SQL Editor if not exists)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
-- CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );
-- CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'avatars' );

COMMIT;

-- ==========================================
-- PHASE 11: Comprehensive RLS Enforcement
-- ==========================================

-- 1. Users Table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmins have full access to users" ON public.users FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'superadmin');
CREATE POLICY "Users can view their own data" ON public.users FOR SELECT TO authenticated USING (username = (auth.jwt() ->> 'username'));

-- 2. Branches Table
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated users can view branches" ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Superadmins can manage branches" ON public.branches FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'superadmin');

-- 3. Customers Table
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage customers" ON public.customers FOR ALL TO authenticated USING (true);

-- 4. Transactions Table
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view transactions" ON public.transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (true);

-- 5. Settings Table
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated users can view settings" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Superadmins can update settings" ON public.settings FOR UPDATE TO authenticated USING (auth.jwt() ->> 'role' = 'superadmin');

-- 6. Audit Logs Table
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmins can view and manage audit logs" ON public.audit_logs FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'superadmin');
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (auth.jwt() ->> 'role' = 'admin');

-- 7. Rule Engine / Campaigns (If applicable in future)
-- ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
-- ...
