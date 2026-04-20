/*
  # Fix Exchange Rate Permission Check - Use auth_user_id

  ## Overview
  Fixes the permission check function to use the correct column.
  The users table has both 'id' (local PK) and 'auth_user_id' (reference to auth.users).
  The function must check auth_user_id against auth.uid().

  ## Changes
  1. Update can_update_exchange_rates() function to check auth_user_id column
  2. This ensures the permission check matches the actual authenticated user

  ## Security Notes
  - Correctly identifies the authenticated user using auth_user_id
  - Users with user_rights = 'read_write' OR role = 'admin' can update
*/

-- Update helper function to use auth_user_id instead of id
CREATE OR REPLACE FUNCTION can_update_exchange_rates()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM users 
    WHERE auth_user_id = auth.uid()
    AND (user_rights = 'read_write' OR role = 'admin')
    AND enabled = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
