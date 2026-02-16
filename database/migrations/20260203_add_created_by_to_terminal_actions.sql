-- Migration: Add created_by column to terminal_actions table
-- Date: 2026-02-03
-- Description: Adds a column to track who initiated the terminal action

ALTER TABLE public.terminal_actions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Optional: Add comment
COMMENT ON COLUMN public.terminal_actions.created_by IS 'The ID of the admin/user who created this action';
