/*
  # Fix Ticket Message Reads RLS Policies for User ID Mismatch

  1. Problem
    - RLS policies were checking `user_id = auth.uid()`
    - But `user_id` column stores ERP users.id (not auth.users.id)
    - This caused all reads/writes to fail because of ID mismatch

  2. Solution
    - Update policies to properly resolve ERP user ID from auth user ID
    - Use subquery to find users.id where auth_user_id = auth.uid()

  3. Security
    - Maintains same security level - users can only access their own read status
    - Properly links auth users to ERP users via auth_user_id column
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own read status" ON ticket_message_reads;
DROP POLICY IF EXISTS "Users can insert their own read status" ON ticket_message_reads;
DROP POLICY IF EXISTS "Users can update their own read status" ON ticket_message_reads;

-- Recreate policies with correct user ID resolution
CREATE POLICY "Users can view their own read status"
  ON ticket_message_reads FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own read status"
  ON ticket_message_reads FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own read status"
  ON ticket_message_reads FOR UPDATE
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );
