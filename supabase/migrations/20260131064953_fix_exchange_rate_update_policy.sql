/*
  # Fix Exchange Rate Update Policy

  ## Overview
  Updates the RLS policy for foreign_exchange_rates to properly allow users with
  write access to update exchange rates. The existing policy checks user_rights
  but needs to be rewritten to ensure it works correctly.

  ## Changes
  1. Drop the existing update policy for exchange rates
  2. Create a new update policy that explicitly checks for users with read_write access
  3. Add admin override to ensure admins can always update regardless of user_rights

  ## Security Notes
  - Users with user_rights = 'read_write' can update exchange rates
  - Admin users can update exchange rates regardless of their user_rights setting
  - The policy uses a subquery that checks the users table
*/

-- Drop the existing update policy
DROP POLICY IF EXISTS "Users with write access can update exchange rates" ON foreign_exchange_rates;
DROP POLICY IF EXISTS "Admin users can update exchange rates" ON foreign_exchange_rates;

-- Create new update policy that allows users with write access OR admins
CREATE POLICY "Users with write access or admins can update exchange rates"
  ON foreign_exchange_rates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.user_rights = 'read_write' OR users.role = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.user_rights = 'read_write' OR users.role = 'admin')
    )
  );
