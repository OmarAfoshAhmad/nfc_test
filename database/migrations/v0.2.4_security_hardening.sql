-- Migration to harden Security for Scan Events
-- Restricts selective visibility to the last 30 minutes only

-- 1. Drop the overly permissive policy
DROP POLICY IF EXISTS "Allow read for scan events" ON public.scan_events;

-- 2. Create a hardened policy
-- This allows both 'anon' (reader) and 'authenticated' (web app) to see only recent scans.
-- This prevents bulk data scraping of historical scanning patterns.
CREATE POLICY "Allow read for recent scan events" ON public.scan_events 
FOR SELECT 
USING (created_at > (NOW() - INTERVAL '30 minutes'));

-- 3. Verify RLS is enabled
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;
