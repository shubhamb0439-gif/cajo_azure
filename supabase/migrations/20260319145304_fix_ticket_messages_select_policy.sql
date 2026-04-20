/*
  # Fix Ticket Messages SELECT Policy

  1. Changes
    - Update SELECT policy to correctly join users table using auth_user_id
    - Previous policy was using u.id = auth.uid() which is incorrect
    - Should use u.auth_user_id = auth.uid()

  2. Security
    - Maintains proper access control for different user roles
    - Allows clients/managers to view messages for their customer's tickets
    - Allows admins/users to view all ticket messages
*/

-- Drop the incorrect SELECT policy
DROP POLICY IF EXISTS "Users can view messages for their customer's tickets" ON ticket_messages;

-- Create corrected SELECT policy
CREATE POLICY "Users can view messages for their customer's tickets"
  ON ticket_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM tickets t
      JOIN users u ON u.auth_user_id = auth.uid()
      WHERE t.id = ticket_messages.ticket_id
      AND (
        (u.role = 'client' AND t.customer_id = u.customer_id)
        OR (u.role = 'manager' AND t.customer_id = u.customer_id)
        OR u.role IN ('admin', 'user')
      )
    )
  );
