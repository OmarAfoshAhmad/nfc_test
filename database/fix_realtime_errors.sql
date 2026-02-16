-- Enable Realtime for scan_events table
-- Required for the Dashboard to receive new scan notifications

-- 1. Enable Realtime publication for scan_events
begin;
  -- Remove table from publication if it exists to avoid errors
  drop publication if exists supabase_realtime;
  
  -- Re-create publication for all tables (standard practice)
  -- OR specifically add scan_events
  create publication supabase_realtime for table public.scan_events, public.terminals;
commit;

-- 2. Add RLS Policy for Realtime Listeners (Dashboard)
-- Dashboard users (authenticated) need SELECT permission to subscribe
CREATE POLICY "Authenticated users can view scan events" 
  ON public.scan_events 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- 3. Ensure Terminals are visible
-- Dashboard also listens to terminals table
CREATE POLICY "Authenticated users can view terminals" 
  ON public.terminals 
  FOR SELECT 
  TO authenticated 
  USING (true);
