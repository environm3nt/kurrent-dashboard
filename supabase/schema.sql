-- ============================================
-- KURRENT DASHBOARD — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. CLIENTS TABLE
-- One row per paying customer/agency
-- ============================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  agency_name TEXT,
  agency_initials TEXT,
  tier TEXT NOT NULL CHECK (tier IN ('starter', 'growth', 'scale', 'founding_partner', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'churned')),
  contact_email TEXT NOT NULL,
  contact_name TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  airtable_base_id TEXT,
  brand_primary_color TEXT DEFAULT '#2F2C25',
  brand_accent_color TEXT DEFAULT '#F1EADD',
  logo_url TEXT,
  white_label BOOLEAN DEFAULT false,
  target_roles JSONB DEFAULT '[]'::jsonb,
  target_locations JSONB DEFAULT '[]'::jsonb,
  max_results_per_role INTEGER DEFAULT 3,
  digest_recipients JSONB DEFAULT '{}'::jsonb,
  digest_send_time TEXT DEFAULT '07:00',
  timezone TEXT DEFAULT 'America/Toronto',
  sales_rep_name TEXT,
  sales_rep_title TEXT,
  sales_rep_email TEXT,
  agency_phone TEXT,
  agency_website TEXT,
  generate_pdfs BOOLEAN DEFAULT true,
  storage_preference TEXT DEFAULT 'onedrive',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 2. USER-CLIENT MAPPING
-- Links Supabase Auth users to client accounts
-- ============================================
CREATE TABLE IF NOT EXISTS user_clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  contact_name TEXT,
  contact_title TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, client_id)
);

-- ============================================
-- 3. LEADS TABLE
-- Mirrors Airtable data for fast dashboard queries
-- ============================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  airtable_record_id TEXT,
  company_name TEXT NOT NULL,
  role_title TEXT NOT NULL,
  industry TEXT,
  seniority_tier TEXT,
  work_arrangement TEXT,
  location TEXT,
  date_identified DATE DEFAULT CURRENT_DATE,
  job_posting_url TEXT,
  company_headcount TEXT,
  years_in_business TEXT,
  hiring_contact_name TEXT,
  hiring_contact_title TEXT,
  hiring_contact_email TEXT,
  hiring_contact_linkedin TEXT,
  company_domain TEXT,
  contact_quality TEXT DEFAULT 'none' CHECK (contact_quality IN ('verified', 'partial', 'none')),
  salary_range TEXT,
  time_to_fill_estimate TEXT,
  active_candidates INTEGER DEFAULT 0,
  passive_candidates INTEGER DEFAULT 0,
  role_change_drivers TEXT,
  candidate_1_name TEXT,
  candidate_1_url TEXT,
  candidate_2_name TEXT,
  candidate_2_url TEXT,
  candidate_3_name TEXT,
  candidate_3_url TEXT,
  sales_talking_points TEXT,
  candidate_pitch_points TEXT,
  competing_postings TEXT,
  talent_availability TEXT,
  market_insight TEXT,
  scarcity_insight TEXT,
  competition_insight TEXT,
  speed_insight TEXT,
  pdf_report_link TEXT,
  assigned_to TEXT,
  source TEXT,
  status TEXT DEFAULT 'New' CHECK (status IN ('New', 'Viewed', 'Contacted', 'Archived', 'Won', 'Lost')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 4. PIPELINE RUNS TABLE
-- Tracks each daily pipeline execution
-- ============================================
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  run_id TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed', 'partial')),
  jobs_discovered INTEGER DEFAULT 0,
  jobs_enriched INTEGER DEFAULT 0,
  jobs_deduped INTEGER DEFAULT 0,
  leads_created INTEGER DEFAULT 0,
  pdfs_generated INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error_log TEXT,
  cost_usd NUMERIC(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 5. API USAGE TABLE
-- Tracks per-service costs for billing
-- ============================================
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN ('apollo', 'pdl', 'claude', 'resend', 'airtable', 'pdfmonkey', 'browserbase')),
  credits_used NUMERIC(10,2) DEFAULT 0,
  cost_usd NUMERIC(10,4) DEFAULT 0,
  description TEXT,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 6. INDEXES for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_leads_client_id ON leads(client_id);
CREATE INDEX IF NOT EXISTS idx_leads_date_identified ON leads(date_identified DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_client_date ON leads(client_id, date_identified DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_client ON pipeline_runs(client_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started ON pipeline_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_client ON api_usage(client_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_recorded ON api_usage(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_clients_user ON user_clients(user_id);
CREATE INDEX IF NOT EXISTS idx_user_clients_client ON user_clients(client_id);

-- ============================================
-- 7. ROW LEVEL SECURITY (RLS)
-- Multi-tenant isolation via Supabase Auth
-- ============================================

-- Enable RLS on all tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Clients: users can only see clients they belong to
CREATE POLICY "Users can view their own clients"
  ON clients FOR SELECT
  USING (
    id IN (
      SELECT client_id FROM user_clients WHERE user_id = auth.uid()
    )
  );

-- User-clients: users can only see their own mappings
CREATE POLICY "Users can view their own mappings"
  ON user_clients FOR SELECT
  USING (user_id = auth.uid());

-- User-clients: allow auto-provisioning (insert own row)
CREATE POLICY "Users can insert their own mapping"
  ON user_clients FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Clients: users can update their own client settings
CREATE POLICY "Users can update their own clients"
  ON clients FOR UPDATE
  USING (
    id IN (
      SELECT client_id FROM user_clients WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Clients: allow reading by sales_rep_email for auto-provisioning
CREATE POLICY "Users can find client by email for provisioning"
  ON clients FOR SELECT
  USING (contact_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- User-clients: users can update their own row (recruiter contact card)
CREATE POLICY "Users can update their own user_client row"
  ON user_clients FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Leads: users can only see leads for their clients
CREATE POLICY "Users can view leads for their clients"
  ON leads FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM user_clients WHERE user_id = auth.uid()
    )
  );

-- Leads: users can update lead status for their clients
CREATE POLICY "Users can update leads for their clients"
  ON leads FOR UPDATE
  USING (
    client_id IN (
      SELECT client_id FROM user_clients WHERE user_id = auth.uid()
    )
  );

-- Pipeline runs: users can view runs for their clients
CREATE POLICY "Users can view pipeline runs for their clients"
  ON pipeline_runs FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM user_clients WHERE user_id = auth.uid()
    )
  );

-- API usage: users can view usage for their clients
CREATE POLICY "Users can view api usage for their clients"
  ON api_usage FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM user_clients WHERE user_id = auth.uid()
    )
  );

-- Service role bypass: allow pipeline (server-side) full access
-- The pipeline uses the service_role key, which bypasses RLS automatically

-- ============================================
-- 8. UPDATED_AT TRIGGER
-- Auto-update updated_at on row changes
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed data lives in seed-demo-account.sql.
