-- ============================================
-- Migration 008: Fix leads status constraint
-- Adds 'Proposal' status to match the pipeline UI stages
-- Pipeline stages: New → Contacted → Viewed (Meeting) → Proposal → Won
-- ============================================

-- Drop the old constraint
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;

-- Add the updated constraint with 'Proposal' included
ALTER TABLE leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('New', 'Viewed', 'Contacted', 'Proposal', 'Archived', 'Won', 'Lost'));
