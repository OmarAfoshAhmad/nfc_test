-- Fix for Mac NFC Script: Allow service_role to bypass RLS on branches table
-- This ensures the NFC reader script can query branches during auto-enrollment

-- Add policy to allow service_role to read branches (bypasses RLS)
CREATE POLICY "Service role can read branches" 
  ON public.branches 
  FOR SELECT 
  TO service_role 
  USING (true);

-- Add policy to allow service_role to insert terminals (for auto-enrollment)
CREATE POLICY "Service role can manage terminals" 
  ON public.terminals 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- Add policy to allow service_role to insert scan_events
CREATE POLICY "Service role can insert scan events" 
  ON public.scan_events 
  FOR INSERT 
  TO service_role 
  WITH CHECK (true);
