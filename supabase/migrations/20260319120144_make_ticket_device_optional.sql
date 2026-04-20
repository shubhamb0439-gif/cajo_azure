/*
  # Make Device Reference Optional in Tickets

  1. Changes
    - Make `device_id` nullable in tickets table to support general tickets
    - Add `device_serial_number` field for manual entry
    - Add `is_device_online` field to track device status when ticket is raised
    - Update foreign key constraint to allow NULL device_id
  
  2. Security
    - No changes to RLS policies needed
    - Maintains existing access controls
*/

-- Make device_id nullable
ALTER TABLE tickets 
  ALTER COLUMN device_id DROP NOT NULL;

-- Add device serial number field for manual entry
ALTER TABLE tickets 
  ADD COLUMN IF NOT EXISTS device_serial_number text;

-- Add device online/offline status field
ALTER TABLE tickets 
  ADD COLUMN IF NOT EXISTS is_device_online boolean DEFAULT true;

-- Add index for device serial number lookups
CREATE INDEX IF NOT EXISTS idx_tickets_device_serial_number 
  ON tickets(device_serial_number);