-- Team Management Migration
-- Adds invitation system, RLS fixes, and contact columns to user_clients
-- Run against Supabase production database

-- ============================================================
-- 1. Create client_invitations table
-- ============================================================
CREATE TABLE IF NOT EXISTS client_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  UNIQUE(client_id, email, status)
);

ALTER TABLE client_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Add contact columns to user_clients
-- ============================================================
ALTER TABLE user_clients ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE user_clients ADD COLUMN IF NOT EXISTS contact_title TEXT;
ALTER TABLE user_clients ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE user_clients ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- ============================================================
-- 3. Create SECURITY DEFINER function to avoid RLS recursion
-- ============================================================
CREATE OR REPLACE FUNCTION public.auth_user_client_info()
RETURNS TABLE(client_id UUID, role TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT uc.client_id, uc.role::TEXT FROM user_clients uc WHERE uc.user_id = auth.uid();
$$;

-- ============================================================
-- 4. Fix user_clients RLS policies (avoid infinite recursion)
-- ============================================================
DROP POLICY IF EXISTS "Admins can read all user_clients for their client" ON user_clients;
DROP POLICY IF EXISTS "Admins can update any user_client role" ON user_clients;

CREATE POLICY "Admins can read all user_clients for their client"
  ON user_clients FOR SELECT
  USING (client_id IN (SELECT info.client_id FROM public.auth_user_client_info() info WHERE info.role IN ('admin', 'owner')));

CREATE POLICY "Admins can update any user_client role"
  ON user_clients FOR UPDATE
  USING (client_id IN (SELECT info.client_id FROM public.auth_user_client_info() info WHERE info.role IN ('admin', 'owner')))
  WITH CHECK (client_id IN (SELECT info.client_id FROM public.auth_user_client_info() info WHERE info.role IN ('admin', 'owner')));

-- ============================================================
-- 5. Fix clients table RLS policies
-- ============================================================
DROP POLICY IF EXISTS "Users can view their own clients" ON clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON clients;

CREATE POLICY "Users can view their own clients"
  ON clients FOR SELECT
  USING (id IN (SELECT info.client_id FROM public.auth_user_client_info() info));

CREATE POLICY "Users can update their own clients"
  ON clients FOR UPDATE
  USING (id IN (SELECT info.client_id FROM public.auth_user_client_info() info WHERE info.role IN ('admin', 'owner')));

-- ============================================================
-- 6. Fix client_invitations RLS policies
-- ============================================================
DROP POLICY IF EXISTS "Users can view invitations for their client" ON client_invitations;
DROP POLICY IF EXISTS "Admins can create invitations for their client" ON client_invitations;
DROP POLICY IF EXISTS "Admins can update invitations for their client" ON client_invitations;
DROP POLICY IF EXISTS "Admins can delete invitations for their client" ON client_invitations;

CREATE POLICY "Users can view invitations for their client"
  ON client_invitations FOR SELECT
  USING (client_id IN (SELECT info.client_id FROM public.auth_user_client_info() info));

CREATE POLICY "Admins can create invitations for their client"
  ON client_invitations FOR INSERT
  WITH CHECK (client_id IN (SELECT info.client_id FROM public.auth_user_client_info() info WHERE info.role IN ('admin', 'owner')));

CREATE POLICY "Admins can update invitations for their client"
  ON client_invitations FOR UPDATE
  USING (client_id IN (SELECT info.client_id FROM public.auth_user_client_info() info WHERE info.role IN ('admin', 'owner')));

CREATE POLICY "Admins can delete invitations for their client"
  ON client_invitations FOR DELETE
  USING (client_id IN (SELECT info.client_id FROM public.auth_user_client_info() info WHERE info.role IN ('admin', 'owner')));

-- ============================================================
-- 7. Backfill contact_email from auth.users
-- ============================================================
UPDATE user_clients uc
SET contact_email = u.email
FROM auth.users u
WHERE uc.user_id = u.id
AND uc.contact_email IS NULL;
