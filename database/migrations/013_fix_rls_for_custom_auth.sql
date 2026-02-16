-- Fix RLS: Application uses Custom Auth, so DB connection is 'anon'.
-- We must allow 'anon' role to access the table, but we secure it via the API Layer.

-- 1. Drop previous restrictive policies
DROP POLICY IF EXISTS "Enable all read for authenticated" ON public.campaigns;
DROP POLICY IF EXISTS "Enable all write for authenticated" ON public.campaigns;
DROP POLICY IF EXISTS "Enable all update for authenticated" ON public.campaigns;
DROP POLICY IF EXISTS "Enable all delete for authenticated" ON public.campaigns;

-- 2. Create Permissive Policies (Relies on API Layer for Security)
CREATE POLICY "Allow API Access Select" ON public.campaigns FOR SELECT USING (true);
CREATE POLICY "Allow API Access Insert" ON public.campaigns FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow API Access Update" ON public.campaigns FOR UPDATE USING (true);
CREATE POLICY "Allow API Access Delete" ON public.campaigns FOR DELETE USING (true);
