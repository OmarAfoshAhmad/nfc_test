-- Fix RLS for scan_events to ensure Realtime works
-- Realtime requires SELECT permissions for the observing user (authenticated or anon)

-- 1. Enable RLS (if not already)
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Enable read access for all users" ON public.scan_events;
DROP POLICY IF EXISTS "Enable write access for all users" ON public.scan_events;
DROP POLICY IF EXISTS "Allow API Access" ON public.scan_events;

-- 3. create permissive policy
-- We allow ALL operations because this is an internal dashboard app relying on API layer security
CREATE POLICY "Allow API Realtime ScanEvents" ON public.scan_events
FOR ALL
USING (true)
WITH CHECK (true);

-- 4. Publication check skipped as it is already active
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_events;
