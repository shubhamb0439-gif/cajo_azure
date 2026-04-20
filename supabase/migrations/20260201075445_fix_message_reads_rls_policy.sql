/*
  # Fix message_reads RLS UPDATE policy

  1. Changes
    - Drop the incorrect UPDATE policy that directly compares user_id with auth.uid()
    - Create a correct UPDATE policy that properly looks up auth_user_id from users table
    - This ensures upsert operations work correctly when marking messages as read

  2. Security
    - Only allow users to update their own read status records
    - Properly validates by comparing auth.uid() with auth_user_id from users table
*/

-- Drop the incorrect UPDATE policy
DROP POLICY IF EXISTS "Users can update their message reads" ON public.message_reads;

-- Create correct UPDATE policy
CREATE POLICY "Users can update their message reads"
  ON public.message_reads
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = (SELECT auth_user_id FROM users WHERE id = user_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT auth_user_id FROM users WHERE id = user_id)
  );