-- Initialize terminals with last_sync (2026-02-03)
-- هذا السكريبت يهيّئ جميع المحطات بقيم last_sync صحيحة

-- تحديث المحطات بـ last_sync = الآن
UPDATE public.terminals 
SET last_sync = NOW()
WHERE last_sync IS NULL OR last_sync > NOW();

-- تحديث المحطات التي لم تُحدّث لأكثر من 30 يوم
UPDATE public.terminals 
SET last_sync = NOW()
WHERE last_sync < NOW() - INTERVAL '30 days';

-- التحقق من النتائج
SELECT id, name, last_sync, is_active FROM public.terminals ORDER BY id;
