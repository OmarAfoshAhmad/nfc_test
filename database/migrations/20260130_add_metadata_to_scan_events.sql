-- Migration: Add metadata column to scan_events table
-- Date: 2026-01-30
-- Description: Adds a JSONB metadata column to store additional scan information (e.g. security status)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'scan_events'
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE public.scan_events ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;
