-- ============================================
-- Migration 002: Portal Fields
-- Adds columns needed by the client portal and PDF generation
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add contact card fields to clients table (used in PDF CTA block)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sales_rep_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sales_rep_title TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sales_rep_email TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS agency_phone TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS agency_website TEXT;

-- 2. Add recruiter contact fields to user_clients (per-recruiter PDF personalization)
ALTER TABLE user_clients ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE user_clients ADD COLUMN IF NOT EXISTS contact_title TEXT;
ALTER TABLE user_clients ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE user_clients ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- 3. Add 'owner' to the role check constraint (schema.sql only has admin/member)
-- Drop and recreate the constraint to include 'owner'
ALTER TABLE user_clients DROP CONSTRAINT IF EXISTS user_clients_role_check;
ALTER TABLE user_clients ADD CONSTRAINT user_clients_role_check
  CHECK (role IN ('owner', 'admin', 'member'));

-- 4. Add additional lead fields used by status sync and PDF generation
ALTER TABLE leads ADD COLUMN IF NOT EXISTS competing_postings TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS talent_availability TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS market_insight TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS scarcity_insight TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS competition_insight TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS speed_insight TEXT;

-- 5. Fix the auto-provisioning policy (should use contact_email, not sales_rep_email)
-- Drop the old policy if it exists with the wrong column
DROP POLICY IF EXISTS "Users can find client by email for provisioning" ON clients;
CREATE POLICY "Users can find client by email for provisioning"
  ON clients FOR SELECT
  USING (contact_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- 6. Add RLS policy for user_clients update (recruiters updating their own contact card)
CREATE POLICY "Users can update their own user_client row"
  ON user_clients FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 7. Verify: check that all RLS policies are active
-- Run this SELECT to confirm:
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
