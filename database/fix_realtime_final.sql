-- ==========================================
-- FINAL FIX FOR REALTIME CHANNEL_ERROR
-- ==========================================
-- Please copy and run this entire script in the Supabase SQL Editor.
-- It fixes Permissions, RLS Policies, and Realtime Publication settings.

BEGIN;

---------------------------------------------------
-- 1. CONFIGURATION: Enable Realtime for scan_events
---------------------------------------------------
-- Remove first to ensure a clean slate, then add.
-- Note: 'supabase_realtime' is the default publication for client listeners.
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.scan_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_events;

-- Also ensure terminals table is realtime enabled (if you listen to it)
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.terminals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.terminals;

---------------------------------------------------
-- 2. PERMISSIONS: Grant access to roles
---------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.scan_events TO authenticated;
GRANT ALL ON public.scan_events TO service_role;

GRANT SELECT ON public.terminals TO authenticated;

---------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
---------------------------------------------------
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminals ENABLE ROW LEVEL SECURITY;

-- >> CLEANUP OLD POLICIES <<
DROP POLICY IF EXISTS "Authenticated users can view scan events" ON public.scan_events;
DROP POLICY IF EXISTS "Allow Read Scan Events" ON public.scan_events;
DROP POLICY IF EXISTS "Service role unrestricted" ON public.scan_events;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.scan_events;
DROP POLICY IF EXISTS "Dashboard Realtime Access" ON public.scan_events;

-- >> CREATE NEW POLICIES <<

-- Policy 1: Allow Dashboard (Authenticated Users) to VIEW all scan events
-- We use USING (true) to allow seeing events from ANY terminal for now.
CREATE POLICY "Dashboard Realtime Access"
ON public.scan_events
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Allow Backend Script (Service Role) to DO EVERYTHING
CREATE POLICY "Service Role Full Access"
ON public.scan_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- >> TERMINALS POLICIES <<
DROP POLICY IF EXISTS "Authenticated users can view terminals" ON public.terminals;
CREATE POLICY "Allow Authenticated Read Terminals"
ON public.terminals
FOR SELECT
TO authenticated
USING (true);

COMMIT;

-- Check results
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
