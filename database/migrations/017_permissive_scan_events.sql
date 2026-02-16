-- Ultra permissive RLS for scan_events to ensure hardware compatibility
-- This follows the pattern of allowing all API operations and handling logic at API level

-- 1. Ensure RLS is enabled
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;

-- 2. Drop all previous related policies to avoid conflicts
DROP POLICY IF EXISTS "Allow API Realtime ScanEvents" ON public.scan_events;
DROP POLICY IF EXISTS "Allow read for scan events" ON public.scan_events;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.scan_events;
DROP POLICY IF EXISTS "Enable write access for all users" ON public.scan_events;
DROP POLICY IF EXISTS "Allow API Access" ON public.scan_events;

-- 3. Create explicit permissive policies for both anon and authenticated
CREATE POLICY "permissive_scan_events_all" ON public.scan_events
FOR ALL 
TO public
USING (true)
WITH CHECK (true);

-- Ensure publication is correctly set (re-run as a separate block if needed)
-- Note: Replication usually needs to be updated outside transaction if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'scan_events'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_events;
        END IF;
    END IF;
END $$;
