/*
  # Fix System Requests RLS Policy

  ## Changes
  - Drop and recreate the INSERT policy to properly check user identity
  - The created_by field references users.id, but auth.uid() returns auth_user_id
  - Fix the policy to properly validate the user can insert their own requests

  ## Security
  - Authenticated users can only insert requests where created_by is their user ID
  - Properly maps auth.uid() to the users table
*/

-- Drop the old INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert requests" ON public.system_requests;

-- Create the corrected INSERT policy
CREATE POLICY "Authenticated users can insert requests"
  ON public.system_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by IN (
      SELECT id FROM public.users
      WHERE auth_user_id = auth.uid()
    )
  );
