/*
  # Fix auto-close tickets function

  1. Changes
    - Updates `auto_close_device_tickets()` function to remove reference to non-existent `updated_at` column
    - Only updates the status field when auto-closing tickets
  
  2. Notes
    - The tickets table doesn't have an `updated_at` column, only `raised_at` and `closed_at`
*/

-- Update function to remove updated_at reference
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
      closed_at = NOW()
    WHERE 
      device_id = NEW.id
      AND status = 'open';
  END IF;
  
  RETURN NEW;
END;
$$;
