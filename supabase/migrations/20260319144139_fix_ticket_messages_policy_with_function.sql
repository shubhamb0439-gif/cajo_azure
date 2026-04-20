/*
  # Fix Ticket Messages Insert Policy with Helper Function

  1. Changes
    - Create a SECURITY DEFINER function to check ticket access
    - This bypasses RLS when checking if a user can access a ticket
    - Update the INSERT policy to use this function

  2. Security
    - Function runs with elevated privileges but only returns boolean
    - Properly checks user role and customer_id matching
    - Maintains security while allowing proper access
*/

-- Create helper function to check ticket access (bypasses RLS)
CREATE OR REPLACE FUNCTION can_user_access_ticket(p_ticket_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
  v_user_customer_id uuid;
  v_ticket_customer_id uuid;
BEGIN
  -- Get user info
  SELECT role, customer_id INTO v_user_role, v_user_customer_id
  FROM users
  WHERE id = p_user_id;

  -- Admin and user roles can access all tickets
  IF v_user_role IN ('admin', 'user') THEN
    RETURN true;
  END IF;

  -- Get ticket customer_id
  SELECT customer_id INTO v_ticket_customer_id
  FROM tickets
  WHERE id = p_ticket_id;

  -- Client and manager can access tickets for their customer
  IF v_user_role IN ('client', 'manager') AND v_user_customer_id = v_ticket_customer_id THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Drop and recreate the INSERT policy using the helper function
DROP POLICY IF EXISTS "Users can send messages to accessible tickets" ON ticket_messages;

CREATE POLICY "Users can send messages to accessible tickets"
  ON ticket_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND can_user_access_ticket(ticket_id, auth.uid())
  );
