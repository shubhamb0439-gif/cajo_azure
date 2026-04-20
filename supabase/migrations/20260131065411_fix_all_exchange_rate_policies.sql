/*
  # Fix All Exchange Rate Policies to Use Correct Column

  ## Overview
  Updates all RLS policies on foreign_exchange_rates to use auth_user_id
  instead of id when checking permissions. This ensures consistency across
  all operations.

  ## Changes
  1. Update INSERT policy to check auth_user_id
  2. Update DELETE policy to check auth_user_id
  3. All policies now consistently use the correct column reference

  ## Security Notes
  - Only admins can insert or delete exchange rates
  - Users with write access or admins can update exchange rates (already fixed)
  - All authenticated users can view exchange rates
*/

-- Drop and recreate INSERT policy with correct column
DROP POLICY IF EXISTS "Admin users can insert exchange rates" ON foreign_exchange_rates;

CREATE POLICY "Admin users can insert exchange rates"
  ON foreign_exchange_rates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
      AND users.enabled = true
    )
  );

-- Drop and recreate DELETE policy with correct column
DROP POLICY IF EXISTS "Admin users can delete exchange rates" ON foreign_exchange_rates;

CREATE POLICY "Admin users can delete exchange rates"
  ON foreign_exchange_rates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
      AND users.enabled = true
    )
  );
