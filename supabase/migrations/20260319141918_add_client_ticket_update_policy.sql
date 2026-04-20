/*
  # Add Client Ticket Update Policy

  1. Changes
    - Add policy to allow clients to update tickets for their customer
    - This enables clients to close tickets they raised

  2. Security
    - Clients can only update tickets belonging to their customer
    - Uses customer_id match to ensure proper authorization
*/

-- Add policy for clients to update their customer's tickets
CREATE POLICY "Client can update their customer tickets"
  ON tickets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_user_id = auth.uid() 
      AND customer_id = tickets.customer_id
      AND role = 'client'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_user_id = auth.uid() 
      AND customer_id = tickets.customer_id
      AND role = 'client'
    )
  );
