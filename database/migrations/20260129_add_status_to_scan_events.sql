-- Add status column to scan_events table (2026-01-29)
-- This allows tracking whether a card is PRESENT or REMOVED

ALTER TABLE public.scan_events
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PRESENT' 
CHECK (status IN ('PRESENT', 'REMOVED'));

-- Create index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_scan_events_status 
ON public.scan_events(status, terminal_id, processed);

-- Comment for clarity
COMMENT ON COLUMN public.scan_events.status IS 'Card status: PRESENT = card is on reader, REMOVED = card was removed';
