/*
  # Fix Tickets SELECT Policy for General Tickets

  1. Changes
    - Drop the existing "Client and manager can view their customer tickets" policy
    - Create a new policy that allows clients/managers to view tickets based on customer_id match
    - This allows viewing both device-specific tickets AND general tickets (where device_id is NULL)

  2. Security
    - Clients and managers can only see tickets for their own customer
    - Admin users can still see all tickets via separate policy
*/

-- Drop the old policy that requires device_id
DROP POLICY IF EXISTS "Client and manager can view their customer tickets" ON tickets;

-- Create new policy that checks customer_id directly
CREATE POLICY "Client and manager can view their customer tickets"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_user_id = auth.uid() 
      AND customer_id = tickets.customer_id
      AND role IN ('client', 'manager')
    )
  );

-- Also update the Manager update policy to handle NULL device_id
DROP POLICY IF EXISTS "Manager can update their customer tickets" ON tickets;

CREATE POLICY "Manager can update their customer tickets"
  ON tickets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_user_id = auth.uid() 
      AND customer_id = tickets.customer_id
      AND role = 'manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_user_id = auth.uid() 
      AND customer_id = tickets.customer_id
      AND role = 'manager'
    )
  );
