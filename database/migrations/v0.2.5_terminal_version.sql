-- Add script_version column to terminals for auto-update tracking
ALTER TABLE public.terminals 
ADD COLUMN IF NOT EXISTS script_version TEXT DEFAULT '0.2.4';

-- Update all existing terminals to 0.2.4 as a baseline
UPDATE public.terminals SET script_version = '0.2.4' WHERE script_version IS NULL;
