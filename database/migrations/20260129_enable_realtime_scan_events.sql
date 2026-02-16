-- Enable Realtime for scan_events table (2026-01-29)
-- This ensures the web UI can receive real-time updates when cards are scanned

-- 1. Ensure the table exists and RLS is enabled
ALTER TABLE IF EXISTS public.scan_events ENABLE ROW LEVEL SECURITY;

-- 2. Ensure scan_events is in the Realtime publication
BEGIN;
  -- Check if the publication exists
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Add table to publication if not already there
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND tablename = 'scan_events'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_events;
      RAISE NOTICE 'Added scan_events to supabase_realtime publication';
    ELSE
      RAISE NOTICE 'scan_events is already in supabase_realtime publication';
    END IF;
  ELSE
    RAISE WARNING 'supabase_realtime publication does not exist';
  END IF;
COMMIT;

-- 3. Verify current policies
-- The following policies should allow realtime subscriptions to work
DROP POLICY IF EXISTS "allow_realtime_scan_events" ON public.scan_events;

CREATE POLICY "allow_realtime_scan_events" ON public.scan_events
FOR ALL
TO public
USING (true)
WITH CHECK (true);

RAISE NOTICE 'Realtime for scan_events has been configured';
