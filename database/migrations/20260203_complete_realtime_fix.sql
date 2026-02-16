-- Complete Realtime & Status Fix (2026-02-03)
-- هذا السكريبت يصلح جميع مشاكل Realtime وحالة الأجهزة

BEGIN;

-- ============================================
-- STEP 1: Initialize last_sync for all terminals
-- ============================================
-- تحديث جميع المحطات بقيمة last_sync صحيحة
UPDATE public.terminals 
SET last_sync = COALESCE(last_sync, NOW() - INTERVAL '1 minute')
WHERE last_sync IS NULL OR last_sync > NOW();

-- تحديث المحطات التي آخر تحديث لها قديم جداً
UPDATE public.terminals 
SET last_sync = NOW() 
WHERE last_sync < NOW() - INTERVAL '30 days';

-- ============================================
-- STEP 2: Ensure RLS is enabled
-- ============================================
ALTER TABLE IF EXISTS public.terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scan_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 3: Remove terminals and scan_events from publication (fresh start)
-- ============================================
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.terminals CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.scan_events CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

-- ============================================
-- STEP 4: Add tables back to publication
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.terminals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_events;

-- ============================================
-- STEP 5: Drop ALL old RLS policies
-- ============================================
-- Terminals policies
DROP POLICY IF EXISTS "Allow authenticated read terminals" ON public.terminals;
DROP POLICY IF EXISTS "Service role full access terminals" ON public.terminals;
DROP POLICY IF EXISTS "Allow authenticated read" ON public.terminals;
DROP POLICY IF EXISTS "Allow service role" ON public.terminals;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.terminals;
DROP POLICY IF EXISTS "Enable all for service_role" ON public.terminals;

-- Scan Events policies
DROP POLICY IF EXISTS "Allow authenticated read scan_events" ON public.scan_events;
DROP POLICY IF EXISTS "Allow service role scan_events" ON public.scan_events;
DROP POLICY IF EXISTS "Dashboard Realtime Access" ON public.scan_events;
DROP POLICY IF EXISTS "Service Role Full Access" ON public.scan_events;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.scan_events;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.scan_events;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.scan_events;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.scan_events;
DROP POLICY IF EXISTS "Enable all for service_role" ON public.scan_events;

-- ============================================
-- STEP 6: Create NEW permissive RLS policies
-- ============================================

-- === TERMINALS POLICIES ===
CREATE POLICY "terminals_authenticated_select" ON public.terminals
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "terminals_authenticated_insert" ON public.terminals
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "terminals_authenticated_update" ON public.terminals
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "terminals_authenticated_delete" ON public.terminals
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "terminals_service_role_all" ON public.terminals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- === SCAN_EVENTS POLICIES ===
CREATE POLICY "scan_events_authenticated_select" ON public.scan_events
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "scan_events_authenticated_insert" ON public.scan_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "scan_events_authenticated_update" ON public.scan_events
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "scan_events_authenticated_delete" ON public.scan_events
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "scan_events_service_role_all" ON public.scan_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- STEP 7: Verify Everything is Correct
-- ============================================
SELECT 
  'Tables in Realtime Publication' as check_name,
  COUNT(*) as count,
  STRING_AGG(tablename, ', ') as tables
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename IN ('terminals', 'scan_events');

-- Check RLS status
SELECT 
  schemaname,
  tablename,
  rowsecurity as "RLS Enabled",
  (SELECT COUNT(*) FROM pg_policies WHERE pg_policies.tablename = pg_tables.tablename) as "Policy Count"
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('terminals', 'scan_events');

-- Check sample terminals data
SELECT id, name, last_sync, is_active 
FROM public.terminals 
ORDER BY last_sync DESC 
LIMIT 5;

COMMIT;

-- ============================================
-- SUMMARY
-- ============================================
-- ✅ تحديث جميع المحطات بـ last_sync صحيح
-- ✅ تفعيل RLS على الجداول
-- ✅ إضافة الجداول إلى Realtime Publication
-- ✅ حذف جميع السياسات القديمة
-- ✅ إنشاء سياسات RLS جديدة وصحيحة
-- ✅ التحقق من التكوين
