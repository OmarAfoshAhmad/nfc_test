-- Add expires_at column to cards table
-- Default expiration set to 3 months from creation for new records (handled in app logic, but DB default can be null or specific)

ALTER TABLE public.cards 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Optional: Set default for existing cards to 3 months from now (or keep null if infinite)
-- UPDATE public.cards SET expires_at = NOW() + INTERVAL '3 months' WHERE expires_at IS NULL;
