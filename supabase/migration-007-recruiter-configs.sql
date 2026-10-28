-- ============================================
-- MIGRATION 007: Recruiter Configs
-- Per-recruiter role/location/schedule configs
-- Supports the new recruiter-level intelligence model
-- ============================================

-- ============================================
-- 1. RECRUITER_CONFIGS TABLE
-- One row per recruiter per client
-- Stores their target roles, locations, and weekly schedule
-- ============================================
CREATE TABLE IF NOT EXISTS recruiter_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Recruiter's own target roles (subset of or additions to client pool)
  target_roles JSONB DEFAULT '[]'::jsonb,
  -- e.g. [{"title": "Legal Assistant", "function": "Legal", "seniority": "IC"}]

  -- Recruiter's target locations
  target_locations JSONB DEFAULT '[]'::jsonb,
  -- e.g. ["Toronto Ontario Canada", "Vancouver BC Canada"]

  -- Weekly schedule: which days each role runs
  -- e.g. {"Legal Assistant": ["mon","tue","wed"], "Paralegal": ["thu","fri"]}
  schedule JSONB DEFAULT '{}'::jsonb,

  -- Digest preferences
  digest_enabled BOOLEAN DEFAULT true,
  digest_days JSONB DEFAULT '["mon","tue","wed","thu","fri"]'::jsonb,

  -- Display name (denormalized for convenience)
  display_name TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(client_id, user_id)
);

-- ============================================
-- 2. ADD assigned_to_user_id ON LEADS
-- Links leads to specific recruiters (nullable = unassigned)
-- ============================================
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add projected_fee column for revenue tracking
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS projected_fee NUMERIC(10,2);

-- ============================================
-- 3. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_recruiter_configs_client ON recruiter_configs(client_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_configs_user ON recruiter_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_configs_client_user ON recruiter_configs(client_id, user_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to_user ON leads(assigned_to_user_id);

-- ============================================
-- 4. ROW LEVEL SECURITY
-- ============================================
ALTER TABLE recruiter_configs ENABLE ROW LEVEL SECURITY;

-- Recruiters can view all configs for their client (team visibility)
CREATE POLICY "Users can view recruiter configs for their clients"
  ON recruiter_configs FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM user_clients WHERE user_id = auth.uid()
    )
  );

-- Recruiters can update their own config
CREATE POLICY "Users can update their own recruiter config"
  ON recruiter_configs FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Recruiters can insert their own config
CREATE POLICY "Users can insert their own recruiter config"
  ON recruiter_configs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can update any recruiter config for their client
CREATE POLICY "Admins can update any recruiter config"
  ON recruiter_configs FOR UPDATE
  USING (
    client_id IN (
      SELECT client_id FROM user_clients
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Admins can insert configs for their team members
CREATE POLICY "Admins can insert recruiter configs for their client"
  ON recruiter_configs FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM user_clients
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================
-- 5. UPDATED_AT TRIGGER
-- ============================================
CREATE TRIGGER recruiter_configs_updated_at
  BEFORE UPDATE ON recruiter_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 6. AUTO-PROVISION DEFAULT CONFIG
-- When a user_clients row is created, auto-create a recruiter_config
-- with the client's default roles/locations
-- ============================================
CREATE OR REPLACE FUNCTION auto_provision_recruiter_config()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO recruiter_configs (client_id, user_id, target_roles, target_locations, display_name)
  SELECT
    NEW.client_id,
    NEW.user_id,
    c.target_roles,
    c.target_locations,
    COALESCE(NEW.contact_name, '')
  FROM clients c
  WHERE c.id = NEW.client_id
  ON CONFLICT (client_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER auto_provision_recruiter_config_trigger
  AFTER INSERT ON user_clients
  FOR EACH ROW EXECUTE FUNCTION auto_provision_recruiter_config();

-- ============================================
-- 7. BACKFILL: Create recruiter_configs for existing users
-- ============================================
INSERT INTO recruiter_configs (client_id, user_id, target_roles, target_locations, display_name)
SELECT
  uc.client_id,
  uc.user_id,
  c.target_roles,
  c.target_locations,
  COALESCE(uc.contact_name, '')
FROM user_clients uc
JOIN clients c ON c.id = uc.client_id
ON CONFLICT (client_id, user_id) DO NOTHING;
