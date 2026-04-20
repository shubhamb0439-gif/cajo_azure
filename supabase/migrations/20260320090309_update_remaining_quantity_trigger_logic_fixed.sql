/*
  # Update Remaining Quantity Trigger Logic - Fixed

  ## Problem
  - The system uses `received = true` to indicate items are in stock
  - The actual quantity received is tracked in `quantity_received`
  - But when `quantity_received` is 0, we should use `quantity` as the available amount
  
  ## Solution
  - Update trigger to handle both scenarios:
    1. If quantity_received > 0, use that
    2. If quantity_received = 0 but received = true, use quantity
  - Update existing data to match this logic

  ## Changes
  1. Update trigger function with better logic
  2. Fix existing data
*/

-- Update the trigger function
CREATE OR REPLACE FUNCTION set_remaining_quantity_on_receive()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_used_amount numeric;
BEGIN
  -- When marking as received, set remaining_quantity appropriately
  IF NEW.received = true AND (OLD.received IS NULL OR OLD.received = false) THEN
    -- If quantity_received > 0, use that; otherwise use quantity
    IF NEW.quantity_received > 0 THEN
      NEW.remaining_quantity := NEW.quantity_received;
    ELSE
      NEW.remaining_quantity := NEW.quantity;
    END IF;
  END IF;
  
  -- If quantity_received changes while already received, update remaining_quantity
  IF NEW.received = true AND OLD.received = true THEN
    IF NEW.quantity_received > 0 AND NEW.quantity_received != OLD.quantity_received THEN
      -- Calculate how much was already used from the old received amount
      v_used_amount := OLD.quantity_received - OLD.remaining_quantity;
      -- Apply the same used amount to the new received quantity
      NEW.remaining_quantity := NEW.quantity_received - v_used_amount;
      -- Ensure it doesn't go negative
      IF NEW.remaining_quantity < 0 THEN
        NEW.remaining_quantity := 0;
      END IF;
    ELSIF NEW.quantity_received = 0 AND OLD.quantity_received = 0 AND NEW.quantity != OLD.quantity THEN
      -- If quantity changes and no quantity_received is set, update remaining based on quantity
      v_used_amount := OLD.quantity - OLD.remaining_quantity;
      NEW.remaining_quantity := NEW.quantity - v_used_amount;
      IF NEW.remaining_quantity < 0 THEN
        NEW.remaining_quantity := 0;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix existing data: for received items with quantity_received = 0, use quantity
UPDATE purchase_items
SET remaining_quantity = quantity
WHERE received = true 
  AND quantity_received = 0
  AND remaining_quantity != quantity;