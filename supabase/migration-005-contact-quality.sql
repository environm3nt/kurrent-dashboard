-- Migration 005: Add company_domain and contact_quality to leads table
-- Supports PDL-first contact waterfall and CRM contact quality badges
--
-- Run against Supabase SQL Editor BEFORE deploying the pipeline changes.

-- Add new columns
ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_domain TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_quality TEXT DEFAULT 'none';

-- Add check constraint for contact_quality values
ALTER TABLE leads ADD CONSTRAINT leads_contact_quality_check
  CHECK (contact_quality IN ('verified', 'partial', 'none'));

-- Backfill existing leads: compute contact_quality from existing data
-- Verified: has a real name (not matching title) AND has email or LinkedIn
UPDATE leads
SET contact_quality = 'verified'
WHERE hiring_contact_name IS NOT NULL
  AND hiring_contact_name != ''
  AND (hiring_contact_name != hiring_contact_title OR hiring_contact_title IS NULL)
  AND (hiring_contact_email IS NOT NULL OR hiring_contact_linkedin IS NOT NULL);

-- Partial: has a name that matches the title (redacted) or has title but no email
UPDATE leads
SET contact_quality = 'partial'
WHERE contact_quality = 'none'
  AND hiring_contact_name IS NOT NULL
  AND hiring_contact_name != ''
  AND (hiring_contact_name = hiring_contact_title
       OR (hiring_contact_email IS NULL AND hiring_contact_linkedin IS NULL));

-- Clean up ghost contacts: where name equals title (redacted), null out the name
-- so the CRM doesn't show "HR Manager" as a person's name
UPDATE leads
SET hiring_contact_name = NULL
WHERE hiring_contact_name IS NOT NULL
  AND hiring_contact_title IS NOT NULL
  AND hiring_contact_name = hiring_contact_title;

-- Index for CRM filtering by contact quality
CREATE INDEX IF NOT EXISTS idx_leads_contact_quality ON leads (contact_quality);
