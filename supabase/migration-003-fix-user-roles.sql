-- ============================================
-- Migration 003: Fix User Roles
-- 1. Normalize 'owner' → 'admin' (single full-access role)
-- 2. Promote first user per client to 'admin' (fixes early provisioning bug)
-- 3. Add RLS policy for admin API to update roles
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Normalize: convert any 'owner' roles to 'admin'
UPDATE user_clients SET role = 'admin' WHERE role = 'owner';

-- 2. Promote first user per client to admin (general fix for early provisioning bug)
UPDATE user_clients uc
SET role = 'admin'
FROM (
  SELECT DISTINCT ON (client_id) id
  FROM user_clients
  ORDER BY client_id, created_at ASC
) first_users
WHERE uc.id = first_users.id
  AND uc.role != 'admin';

-- 3. (Optional) Promote a specific operator account to admin across every client.
-- Replace the placeholder before running, or skip this step.
UPDATE user_clients uc
SET role = 'admin'
FROM auth.users au
WHERE au.id = uc.user_id
  AND au.email = 'admin@example.com'
  AND uc.role != 'admin';

-- 4. Allow admin users to update other user_clients rows (for role management from admin portal)
-- The existing policy only allows users to update their OWN row.
-- This new policy lets admins update any row in user_clients.
CREATE POLICY "Admins can update any user_client role"
  ON user_clients FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_clients admin_uc
      WHERE admin_uc.user_id = auth.uid()
        AND admin_uc.client_id = user_clients.client_id
        AND admin_uc.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_clients admin_uc
      WHERE admin_uc.user_id = auth.uid()
        AND admin_uc.client_id = user_clients.client_id
        AND admin_uc.role = 'admin'
    )
  );

-- 5. Allow admins to read all user_clients for their client (for user management UI)
CREATE POLICY "Admins can read all user_clients for their client"
  ON user_clients FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM user_clients
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 6. Update constraint to remove 'owner' (no longer used)
ALTER TABLE user_clients DROP CONSTRAINT IF EXISTS user_clients_role_check;
ALTER TABLE user_clients ADD CONSTRAINT user_clients_role_check
  CHECK (role IN ('admin', 'member'));

-- 7. Multi-admin auto-provisioning.
-- A client's contact_email auto-provisions as 'admin' on first sign-in
-- (see layout.tsx). To let more than one address do that, each client
-- carries an allowed_admin_emails array.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS allowed_admin_emails TEXT[] DEFAULT '{}';

-- Example: allow two addresses to auto-provision as admin for one client.
-- UPDATE clients
-- SET allowed_admin_emails = ARRAY['owner@example.com', 'second-admin@example.com']
-- WHERE id = '<client uuid>';

-- Verify: check roles after migration
-- SELECT uc.role, au.email, c.agency_name
-- FROM user_clients uc
-- JOIN auth.users au ON au.id = uc.user_id
-- JOIN clients c ON c.id = uc.client_id
-- ORDER BY uc.created_at;
