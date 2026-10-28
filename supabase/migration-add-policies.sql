-- Run this in Supabase SQL Editor to add missing RLS policies
-- Required for: settings page saves, auto-provisioning on first login

-- Allow users to insert their own user_clients row (auto-provisioning)
CREATE POLICY "Users can insert their own mapping"
  ON user_clients FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Allow users to update their own client settings (owner/admin only)
CREATE POLICY "Users can update their own clients"
  ON clients FOR UPDATE
  USING (
    id IN (
      SELECT client_id FROM user_clients WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Allow users to find their client by email during auto-provisioning
CREATE POLICY "Users can find client by email for provisioning"
  ON clients FOR SELECT
  USING (sales_rep_email = (SELECT email FROM auth.users WHERE id = auth.uid()));
