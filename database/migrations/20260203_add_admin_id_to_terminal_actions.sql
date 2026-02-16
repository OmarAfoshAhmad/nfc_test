-- Migration: Add admin_id column to terminal_actions table
-- Date: 2026-02-03
-- Description: Standardizes auditing column name to admin_id

ALTER TABLE public.terminal_actions ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES auth.users(id);

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';

-- Optional: Add comment
COMMENT ON COLUMN public.terminal_actions.admin_id IS 'The ID of the admin who created this action';
