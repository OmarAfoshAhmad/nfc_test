-- Add signature column to cards table for security verification
-- 1. Add signature column (VARCHAR)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS signature VARCHAR(64);

-- 2. Add enrolled_at timestamp
ALTER TABLE cards ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMP WITH TIME ZONE;

-- 3. Add enrolled_by as TEXT (to support both UUIDs and legacy integer/string IDs like "2")
-- If column exists as UUID, this might fail, so we check or alter type explicitly if needed.
-- Ideally run:
ALTER TABLE cards ADD COLUMN IF NOT EXISTS enrolled_by TEXT;
-- If it already exists as UUID and you need to change it:
-- ALTER TABLE cards ALTER COLUMN enrolled_by TYPE TEXT;

-- Add index for signature lookups
CREATE INDEX IF NOT EXISTS idx_cards_signature ON cards(signature);

COMMENT ON COLUMN cards.signature IS 'HMAC signature written to the physical card for verification';
