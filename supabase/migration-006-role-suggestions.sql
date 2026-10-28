-- Migration 006: Role suggestions table for predictive role search with demand signals
-- Run this against your Supabase project

CREATE TABLE IF NOT EXISTS role_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT, -- e.g., 'Healthcare', 'Technology', 'Finance' — for grouping only
  seniority_default TEXT DEFAULT 'IC', -- suggested default seniority
  posting_count INTEGER DEFAULT 0, -- aggregate Indeed postings across probed markets
  probe_location TEXT, -- which location was probed (primary market)
  last_probed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(title)
);

-- Index for fast ILIKE search
CREATE INDEX IF NOT EXISTS idx_role_suggestions_title_trgm
  ON role_suggestions USING gin (title gin_trgm_ops);

-- Fallback B-tree index if pg_trgm isn't enabled
CREATE INDEX IF NOT EXISTS idx_role_suggestions_title_lower
  ON role_suggestions (lower(title));

-- Index for sorting by demand
CREATE INDEX IF NOT EXISTS idx_role_suggestions_posting_count
  ON role_suggestions (posting_count DESC);

-- RLS: allow authenticated users to read, only service role can write
ALTER TABLE role_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read role suggestions"
  ON role_suggestions FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage role suggestions"
  ON role_suggestions FOR ALL
  USING (auth.role() = 'service_role');

-- Grant read access
GRANT SELECT ON role_suggestions TO authenticated;
GRANT SELECT ON role_suggestions TO anon;
