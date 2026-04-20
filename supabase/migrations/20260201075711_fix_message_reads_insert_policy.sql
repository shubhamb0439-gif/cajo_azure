/*
  # Fix message_reads INSERT policy

  1. Changes
    - Drop the incorrect INSERT policy that directly compares user_id with auth.uid()
    - Create a correct INSERT policy that validates the user_id belongs to the authenticated user
    - This ensures users can only mark their own messages as read

  2. Security
    - Only allow users to insert read status for messages they received
    - Properly validates by checking if the user_id matches the authenticated user's id
*/

-- Drop the incorrect INSERT policy
DROP POLICY IF EXISTS "Users can mark messages as read" ON public.message_reads;

-- Create correct INSERT policy
CREATE POLICY "Users can mark messages as read"
  ON public.message_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );