-- Add metadata column to terminals for device status tracking
ALTER TABLE public.terminals 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
