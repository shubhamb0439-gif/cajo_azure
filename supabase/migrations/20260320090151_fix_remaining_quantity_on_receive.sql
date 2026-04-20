/*
  # Fix Remaining Quantity When Receiving Purchase Items

  ## Problem
  - When purchase items are marked as received, remaining_quantity stays at 0
  - It should be set to quantity_received when received = true

  ## Solution
  - Add trigger to automatically set remaining_quantity = quantity_received when received is set to true
  - Update existing received items to have correct remaining_quantity

  ## Changes
  1. Create trigger function to set remaining_quantity on receive
  2. Create trigger on purchase_items
  3. Update existing data
*/

-- Create function to set remaining_quantity when item is received
CREATE OR REPLACE FUNCTION set_remaining_quantity_on_receive()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- When marking as received, set remaining_quantity to quantity_received
  IF NEW.received = true AND (OLD.received IS NULL OR OLD.received = false) THEN
    NEW.remaining_quantity := NEW.quantity_received;
  END IF;
  
  -- If quantity_received changes while already received, update remaining_quantity proportionally
  IF NEW.received = true AND OLD.received = true AND NEW.quantity_received != OLD.quantity_received THEN
    NEW.remaining_quantity := NEW.quantity_received - (OLD.quantity_received - OLD.remaining_quantity);
    -- Ensure it doesn't go negative
    IF NEW.remaining_quantity < 0 THEN
      NEW.remaining_quantity := 0;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_set_remaining_quantity_on_receive ON purchase_items;

-- Create trigger
CREATE TRIGGER trg_set_remaining_quantity_on_receive
  BEFORE UPDATE ON purchase_items
  FOR EACH ROW
  EXECUTE FUNCTION set_remaining_quantity_on_receive();

-- Fix existing data: set remaining_quantity = quantity_received for all received items
UPDATE purchase_items
SET remaining_quantity = quantity_received
WHERE received = true 
  AND remaining_quantity != quantity_received;