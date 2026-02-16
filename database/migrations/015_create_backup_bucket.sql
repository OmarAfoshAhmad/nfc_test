-- 1. Create 'backups' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- NOTE: We are skipping RLS policies here to avoid permission errors.
-- The API will use the Service Role Key to bypass RLS for backups.
