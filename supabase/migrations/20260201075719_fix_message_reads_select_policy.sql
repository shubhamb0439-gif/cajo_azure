/*
  # Fix message_reads SELECT policy

  1. Changes
    - Drop the incorrect SELECT policy that directly compares user_id with auth.uid()
    - Create a correct SELECT policy that properly validates user access
    - This ensures users can only view their own read status

  2. Security
    - Only allow users to view read status for their own messages
    - Properly validates by checking auth_user_id from users table
*/

-- Drop the incorrect SELECT policy
DROP POLICY IF EXISTS "Users can view read status for their messages" ON public.message_reads;

-- Create correct SELECT policy
CREATE POLICY "Users can view read status for their messages"
  ON public.message_reads
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );