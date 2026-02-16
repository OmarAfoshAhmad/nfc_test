-- Migration to add last_sync and ensure terminals table is up to date
ALTER TABLE public.terminals 
ADD COLUMN IF NOT EXISTS last_sync TIMESTAMPTZ;

-- Optional: If you want to migrate existing last_seen data (if any)
-- UPDATE public.terminals SET last_sync = last_seen WHERE last_sync IS NULL;
