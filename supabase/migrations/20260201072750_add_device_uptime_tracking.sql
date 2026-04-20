/*
  # Add Device Uptime Tracking and Enhanced Ticket Fields

  1. Changes to `devices` table
    - Add `total_offline_minutes` (integer) - tracks total minutes device has been offline
    - Add `total_online_minutes` (integer) - tracks total minutes device has been online
    - Add `last_status_change_at` (timestamptz) - timestamp of last status change
    - Add `current_offline_start` (timestamptz) - timestamp when device went offline (null when online)

  2. Changes to `tickets` table
    - Add `actions_before_offline` (text) - actions taken before device went offline
    - Add `suspected_reason` (text) - suspected reason for offline status
    - Add `actions_taken_to_fix` (text) - actions taken to fix the issue

  3. New Function
    - `update_device_uptime()` - automatically calculates and updates uptime/downtime when status changes

  4. Security
    - No RLS changes needed (existing policies cover new fields)

  5. Important Notes
    - Existing devices will have 0 for both total_offline_minutes and total_online_minutes
    - When device status changes, uptime is automatically calculated based on last_status_change_at
    - Real-time tracking starts from when this migration is applied
*/

-- Add new columns to devices table
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS total_offline_minutes integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS total_online_minutes integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS last_status_change_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_offline_start timestamptz;

-- Add new columns to tickets table
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS actions_before_offline text,
  ADD COLUMN IF NOT EXISTS suspected_reason text,
  ADD COLUMN IF NOT EXISTS actions_taken_to_fix text;

-- Create function to update device uptime tracking
CREATE OR REPLACE FUNCTION update_device_uptime()
RETURNS TRIGGER AS $$
DECLARE
  elapsed_minutes integer;
BEGIN
  -- Only process if status changed
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Calculate elapsed time if we have a previous status change timestamp
  IF OLD.last_status_change_at IS NOT NULL THEN
    elapsed_minutes := EXTRACT(EPOCH FROM (now() - OLD.last_status_change_at))::integer / 60;

    -- Add to appropriate counter based on OLD status
    IF OLD.status = 'online' THEN
      NEW.total_online_minutes := OLD.total_online_minutes + elapsed_minutes;
    ELSIF OLD.status = 'offline' THEN
      NEW.total_offline_minutes := OLD.total_offline_minutes + elapsed_minutes;
    END IF;
  END IF;

  -- Update last status change timestamp
  NEW.last_status_change_at := now();

  -- Set or clear current_offline_start based on new status
  IF NEW.status = 'offline' THEN
    NEW.current_offline_start := now();
  ELSE
    NEW.current_offline_start := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically track uptime
DROP TRIGGER IF EXISTS trigger_update_device_uptime ON devices;
CREATE TRIGGER trigger_update_device_uptime
  BEFORE UPDATE OF status ON devices
  FOR EACH ROW
  EXECUTE FUNCTION update_device_uptime();

-- Initialize last_status_change_at for existing devices
UPDATE devices
SET last_status_change_at = COALESCE(updated_at, created_at)
WHERE last_status_change_at IS NULL;

-- Create index for faster ticket queries
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_type ON tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_tickets_raised_at_desc ON tickets(raised_at DESC);

-- Enable realtime for device_history (if not already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'device_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE device_history;
  END IF;
END $$;
