/*
  # Fix Tickets Insert Policy for General Tickets

  1. Changes
    - Update the "Client and manager can insert tickets for their devices" policy
    - Allow clients and managers to insert tickets without a device (general tickets)
    - Maintain security by checking the customer_id matches the user's customer_id
  
  2. Security
    - Clients and managers can only create tickets for their own customer
    - Device-specific tickets still validate device ownership
    - General tickets (device_id IS NULL) only check customer ownership
*/

-- Drop and recreate the insert policy to allow general tickets
DROP POLICY IF EXISTS "Client and manager can insert tickets for their devices" ON public.tickets;

CREATE POLICY "Client and manager can insert tickets for their devices"
  ON public.tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_user_id = (select auth.uid()) 
        AND u.role IN ('client', 'manager')
        AND u.customer_id = customer_id
        AND (
          -- For general tickets (no device), just check customer ownership
          device_id IS NULL
          OR
          -- For device-specific tickets, verify device belongs to customer
          EXISTS (
            SELECT 1 FROM public.devices d 
            WHERE d.id = tickets.device_id 
              AND d.customer_id = u.customer_id
          )
        )
    )
  );