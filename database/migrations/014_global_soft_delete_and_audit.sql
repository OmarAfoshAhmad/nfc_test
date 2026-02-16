-- 1. Create Audit Logs Table
DROP TABLE IF EXISTS public.audit_logs; 
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID, -- Can be null if system action, or link to a users table if it exists
    admin_email TEXT, -- Snapshot of who did it
    action_type TEXT NOT NULL, -- CREATE, UPDATE, DELETE, RESTORE, LOGIN, BACKUP
    entity_name TEXT NOT NULL, -- campaigns, cards, customers
    entity_id TEXT, -- ID of the affected record
    details JSONB, -- Previous values, new values, changelog
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    hidden BOOLEAN DEFAULT FALSE -- In case we want to hide low-level logs later
);

-- Index for fast searching
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_name, entity_id);

-- 2. Add Soft Delete to Cards
ALTER TABLE public.cards 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 3. Add Soft Delete to Customers
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 4. Open RLS for these tables (Since we rely on API security as per Step 520)
-- CARDS
DROP POLICY IF EXISTS "Enable read access for all users" ON public.cards;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.cards;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.cards;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.cards;

CREATE POLICY "Allow API Manage Cards" ON public.cards USING (true) WITH CHECK (true);

-- CUSTOMERS
DROP POLICY IF EXISTS "Enable read access for all users" ON public.customers;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.customers;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.customers;

CREATE POLICY "Allow API Manage Customers" ON public.customers USING (true) WITH CHECK (true);

-- AUDIT LOGS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow API Manage Audit" ON public.audit_logs USING (true) WITH CHECK (true);
