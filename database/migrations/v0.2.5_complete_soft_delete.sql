-- Add deleted_at to Users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_at to Branches
ALTER TABLE public.branches 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_at to Terminals
ALTER TABLE public.terminals 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_at to Discounts
ALTER TABLE public.discounts 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Update RLS for soft delete visibility (optional if handled in API)
-- Example for users:
-- DROP POLICY IF EXISTS "Hide deleted users" ON public.users;
-- CREATE POLICY "Hide deleted users" ON public.users FOR SELECT USING (deleted_at IS NULL);
