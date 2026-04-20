/*
  # Fix Exchange Rate Policy with Helper Function

  ## Overview
  Creates a helper function to check if a user can update exchange rates,
  then updates the RLS policy to use this function. This ensures the permission
  check works correctly in all contexts.

  ## Changes
  1. Create a helper function `can_update_exchange_rates()` that checks user permissions
  2. Drop and recreate the update policy using this function
  3. Function checks if user has write access OR is an admin

  ## Security Notes
  - Function is SECURITY DEFINER to ensure it can read users table
  - Function is marked as STABLE since it depends on database state
  - Users with user_rights = 'read_write' OR role = 'admin' can update
*/

-- Create helper function to check if current user can update exchange rates
CREATE OR REPLACE FUNCTION can_update_exchange_rates()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM users 
    WHERE id = auth.uid()
    AND (user_rights = 'read_write' OR role = 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Drop the existing update policy
DROP POLICY IF EXISTS "Users with write access or admins can update exchange rates" ON foreign_exchange_rates;

-- Create new simplified update policy using the helper function
CREATE POLICY "Users with write access or admins can update exchange rates"
  ON foreign_exchange_rates
  FOR UPDATE
  TO authenticated
  USING (can_update_exchange_rates())
  WITH CHECK (can_update_exchange_rates());
