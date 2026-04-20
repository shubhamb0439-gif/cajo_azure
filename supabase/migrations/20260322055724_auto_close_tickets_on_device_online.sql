/*
  # Auto-close tickets when device goes online

  1. New Functions
    - `auto_close_device_tickets()` - Trigger function that automatically closes open tickets when a device status changes from offline to online
  
  2. Changes
    - Creates a trigger on the `devices` table that fires after an UPDATE
    - When a device status changes from 'offline' to 'online', all open tickets for that device are automatically closed
    - Closed tickets are marked with status 'closed' and updated timestamp
  
  3. Security
    - Function runs with SECURITY DEFINER to ensure it can update tickets regardless of RLS policies
    - Uses proper search path to prevent security issues
*/

-- Create function to auto-close tickets when device goes online
CREATE OR REPLACE FUNCTION auto_close_device_tickets()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if status changed from offline to online
  IF OLD.status = 'offline' AND NEW.status = 'online' THEN
    -- Close all open tickets for this device
    UPDATE tickets
    SET 
      status = 'closed',
      updated_at = NOW()
    WHERE 
      device_id = NEW.id
      AND status = 'open';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on devices table
DROP TRIGGER IF EXISTS trigger_auto_close_tickets_on_online ON devices;
CREATE TRIGGER trigger_auto_close_tickets_on_online
  AFTER UPDATE ON devices
  FOR EACH ROW
  EXECUTE FUNCTION auto_close_device_tickets();
