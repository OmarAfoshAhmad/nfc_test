-- Migration: Add bundle_type column to campaigns table
-- This column stores the type of bundle split configuration

ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS bundle_type VARCHAR(50) DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN campaigns.bundle_type IS 'Bundle split type: family, meat_family, youth, meat_individual, individual, or null for default';

-- Update existing campaigns based on their names (optional - for backward compatibility)
UPDATE campaigns SET bundle_type = 'family' WHERE name ILIKE '%عائل%' AND name NOT ILIKE '%لحم%' AND bundle_type IS NULL;
UPDATE campaigns SET bundle_type = 'meat_family' WHERE name ILIKE '%لحم%' AND name ILIKE '%عائل%' AND bundle_type IS NULL;
UPDATE campaigns SET bundle_type = 'youth' WHERE name ILIKE '%شباب%' AND bundle_type IS NULL;
UPDATE campaigns SET bundle_type = 'meat_individual' WHERE name ILIKE '%لحم%' AND (name ILIKE '%افراد%' OR name ILIKE '%أفراد%') AND bundle_type IS NULL;
UPDATE campaigns SET bundle_type = 'individual' WHERE (name ILIKE '%افراد%' OR name ILIKE '%أفراد%') AND name NOT ILIKE '%لحم%' AND bundle_type IS NULL;
