-- Migration 004: Client Invitations
-- Adds invitation system for team member management

-- Create invitations table
CREATE TABLE IF NOT EXISTS client_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  invited_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  accepted_at TIMESTAMPTZ
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_invitations_email ON client_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_client ON client_invitations(client_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON client_invitations(status);

-- Unique constraint: one pending invite per email per client
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_unique_pending
  ON client_invitations(client_id, email)
  WHERE status = 'pending';

-- Enable RLS
ALTER TABLE client_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view invitations for their client
CREATE POLICY "Users can view invitations for their client"
  ON client_invitations FOR SELECT
  USING (
    client_id IN (
      SELECT uc.client_id FROM user_clients uc WHERE uc.user_id = auth.uid()
    )
  );

-- Policy: Admins can insert invitations for their client
CREATE POLICY "Admins can create invitations for their client"
  ON client_invitations FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT uc.client_id FROM user_clients uc
      WHERE uc.user_id = auth.uid() AND uc.role IN ('admin', 'owner')
    )
  );

-- Policy: Admins can update (revoke) invitations for their client
CREATE POLICY "Admins can update invitations for their client"
  ON client_invitations FOR UPDATE
  USING (
    client_id IN (
      SELECT uc.client_id FROM user_clients uc
      WHERE uc.user_id = auth.uid() AND uc.role IN ('admin', 'owner')
    )
  );

-- Policy: Admins can delete invitations for their client
CREATE POLICY "Admins can delete invitations for their client"
  ON client_invitations FOR DELETE
  USING (
    client_id IN (
      SELECT uc.client_id FROM user_clients uc
      WHERE uc.user_id = auth.uid() AND uc.role IN ('admin', 'owner')
    )
  );
