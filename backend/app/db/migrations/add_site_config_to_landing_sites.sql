-- Add site_config column to landing_sites table
-- This column will store the JSON configuration for each cloned site
ALTER TABLE landing_sites ADD COLUMN IF NOT EXISTS site_config JSONB;

-- Create index on site_config for faster queries (optional)
CREATE INDEX IF NOT EXISTS idx_landing_sites_template_name ON landing_sites(template_name);
