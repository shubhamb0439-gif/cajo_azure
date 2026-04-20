/*
  # Fix User Authentication System - Clean Approach

  ## Overview
  Fixes issues with user signup, login, and management by:
  1. Removing unused handle_new_user function (dead code - no trigger exists)
  2. Cleaning up duplicate RLS policies on users table
  3. Creating clear, non-overlapping policies

  ## Issues Identified
  - handle_new_user function exists but no trigger was created to call it
  - Multiple duplicate/overlapping RLS policies
  - Manual insertions during signup work but policies need cleanup

  ## Changes

  ### 1. Remove Unused Function
  - Drop handle_new_user function (never used)

  ### 2. Rebuild RLS Policies
  - Drop all existing policies
  - Create clean set of policies:
    - SELECT: All authenticated users can view users
    - INSERT: Users can insert own profile OR admins can insert any
    - UPDATE: Users update own OR admins update any
    - DELETE: Only admins can delete

  ## Security Model
  - During signup: auth.signUp creates auth user, then app inserts profile with auth_user_id
  - Policy allows insert if auth_user_id matches auth.uid() (self) or if admin
  - All fields (user_rights, enabled, customer_id) set by application code
*/

-- Step 1: Drop unused function
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Step 2: Disable RLS temporarily to avoid deadlocks
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Step 3: Drop all existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON users';
    END LOOP;
END $$;

-- Step 4: Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Step 5: Create clean policies

-- SELECT: All authenticated users can view all users
CREATE POLICY "authenticated_can_view_all_users"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Users can insert their own profile during signup
-- (after auth.signUp, user is authenticated and auth.uid() equals their auth_user_id)
CREATE POLICY "users_can_insert_own_profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

-- INSERT: Admins can insert any user profile
CREATE POLICY "admins_can_insert_any_user"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- UPDATE: Users can update own profile, admins can update any
CREATE POLICY "users_update_own_or_admins_update_any"
  ON users
  FOR UPDATE
  TO authenticated
  USING (is_admin_or_self(auth_user_id))
  WITH CHECK (is_admin_or_self(auth_user_id));

-- DELETE: Only admins can delete users
CREATE POLICY "only_admins_can_delete_users"
  ON users
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Add helpful comments
COMMENT ON TABLE users IS 'User profiles linked to auth.users. Created manually after auth.signUp.';
COMMENT ON COLUMN users.auth_user_id IS 'Links to auth.users.id. Set during profile creation.';
COMMENT ON COLUMN users.enabled IS 'Must be true for login. New signups default to false, requiring admin approval.';
COMMENT ON COLUMN users.user_rights IS 'read_write (full access) or read_only (view only).';
COMMENT ON COLUMN users.customer_id IS 'Required for client and manager roles. Links to customers table.';
