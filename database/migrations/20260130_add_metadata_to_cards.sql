-- Migration: Add metadata column to cards table
-- Date: 2026-01-30
-- Description: Adds a JSONB metadata column to store additional card information

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'cards'
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE public.cards ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;
