/*
  # Fix Ticket Messages Insert Policy

  1. Changes
    - Drop and recreate the INSERT policy for ticket_messages
    - Simplify the policy to properly check ticket access for clients/managers
    - Ensure the policy works correctly during INSERT operations

  2. Security
    - Clients can send messages to tickets for their customer
    - Managers can send messages to tickets for their customer
    - Admin and user roles can send messages to any ticket
    - Users can only send messages as themselves (sender_id check)
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can send messages to accessible tickets" ON ticket_messages;

-- Create new simplified policy
CREATE POLICY "Users can send messages to accessible tickets"
  ON ticket_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM tickets t
        WHERE t.id = ticket_id
        AND t.customer_id = (SELECT customer_id FROM users WHERE id = auth.uid())
      )
      OR
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'user')
      )
    )
  );
