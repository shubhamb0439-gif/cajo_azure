/*
  # Fix Ticket Messages Policy to Use auth_user_id

  1. Changes
    - Update the INSERT policy to compare sender_id with users.id (not auth.uid directly)
    - The frontend sends userProfile.id (from users table), so we need to match that
    - Keep the helper function for checking ticket access

  2. Security
    - Ensures sender_id matches the authenticated user's users.id
    - Maintains proper access control through helper function
*/

-- Drop and recreate the INSERT policy with correct id comparison
DROP POLICY IF EXISTS "Users can send messages to accessible tickets" ON ticket_messages;

CREATE POLICY "Users can send messages to accessible tickets"
  ON ticket_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    -- sender_id must be the current user's id from users table
    sender_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    AND can_user_access_ticket(ticket_id, sender_id)
  );
