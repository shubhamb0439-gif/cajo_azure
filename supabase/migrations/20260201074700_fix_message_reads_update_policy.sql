/*
  # Fix message_reads table UPDATE policy

  1. Changes
    - Add UPDATE policy for message_reads table to support upsert operations
    - Users can update their own read status records

  2. Security
    - Only allow users to update their own read status
    - Restrict updates to the user's own records using auth.uid()
*/

-- Add UPDATE policy for message_reads
CREATE POLICY "Users can update their message reads"
  ON public.message_reads
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));
