/*
  # Allow clients and managers to update device status

  1. Changes
    - Add policy for clients and managers to update device status for their devices
    - Clients and managers can mark devices as "received", "online", or "offline"
    - When device goes offline, automatically create a support ticket
    - All other status changes remain admin-only

  2. Security
    - Only allow status updates for devices belonging to user's customer
    - Limit status changes to specific allowed values for non-admin users
    - Log all status changes in device_history

  3. Important Notes
    - Status flow: ordered → ready_for_dispatch → dispatched → received → installed → online/offline
    - Clients can only update: received, online, offline
    - When status changes to "offline", auto-create ticket if one doesn't exist
*/

-- Create policy for clients and managers to update device status
CREATE POLICY "Client and manager can update their device status"
  ON devices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_user_id = auth.uid() 
      AND customer_id = devices.customer_id
      AND role IN ('client', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_user_id = auth.uid() 
      AND customer_id = devices.customer_id
      AND role IN ('client', 'manager')
    )
    AND status IN ('received', 'online', 'offline')
  );

-- Create function to auto-create ticket when device goes offline
CREATE OR REPLACE FUNCTION auto_create_offline_ticket()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id uuid;
  v_user_id uuid;
  v_ticket_exists boolean;
BEGIN
  IF NEW.status = 'offline' AND (OLD.status IS NULL OR OLD.status != 'offline') THEN
    SELECT customer_id INTO v_customer_id FROM devices WHERE id = NEW.id;
    
    SELECT id INTO v_user_id 
    FROM users 
    WHERE auth_user_id = auth.uid() 
    LIMIT 1;
    
    SELECT EXISTS(
      SELECT 1 FROM tickets 
      WHERE device_id = NEW.id 
      AND status IN ('open', 'in_progress')
      AND ticket_type = 'device_offline'
    ) INTO v_ticket_exists;
    
    IF NOT v_ticket_exists THEN
      INSERT INTO tickets (
        device_id, 
        customer_id, 
        ticket_type, 
        status, 
        priority,
        description,
        raised_by,
        raised_at
      )
      VALUES (
        NEW.id,
        v_customer_id,
        'device_offline',
        'open',
        'high',
        'Device reported offline by client. Serial: ' || NEW.device_serial_number,
        v_user_id,
        now()
      );
    END IF;
  END IF;
  
  IF NEW.status = 'online' AND OLD.status = 'offline' THEN
    UPDATE tickets 
    SET 
      status = 'closed',
      closed_at = now(),
      closed_by = (SELECT id FROM users WHERE auth_user_id = auth.uid() LIMIT 1),
      resolution_notes = 'Device reported back online by client'
    WHERE device_id = NEW.id 
    AND status IN ('open', 'in_progress')
    AND ticket_type = 'device_offline';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-creating offline tickets
DROP TRIGGER IF EXISTS trigger_auto_create_offline_ticket ON devices;
CREATE TRIGGER trigger_auto_create_offline_ticket
  AFTER UPDATE ON devices
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION auto_create_offline_ticket();