-- Enable Realtime for terminals and scan_events (2026-02-03)
-- Simple and Direct Fix

-- STEP 1: Enable RLS
ALTER TABLE IF EXISTS public.terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scan_events ENABLE ROW LEVEL SECURITY;

-- STEP 2: Add to Realtime Publication
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.terminals;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.scan_events;

-- STEP 3: Terminals RLS Policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.terminals;
DROP POLICY IF EXISTS "Enable all for service_role" ON public.terminals;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.terminals;

CREATE POLICY "Enable read access for authenticated users" ON public.terminals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable update for authenticated users" ON public.terminals
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for service_role" ON public.terminals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- STEP 4: Scan Events RLS Policies  
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.scan_events;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.scan_events;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.scan_events;
DROP POLICY IF EXISTS "Enable all for service_role" ON public.scan_events;

CREATE POLICY "Enable read for authenticated users" ON public.scan_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.scan_events
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.scan_events
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for service_role" ON public.scan_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
