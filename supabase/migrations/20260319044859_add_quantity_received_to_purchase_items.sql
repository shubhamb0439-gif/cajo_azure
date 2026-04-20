/*
  # Add Partial Receipt Tracking to Purchase Items

  ## Overview
  Adds quantity_received field to purchase_items table to track partial receipts.
  This allows vendors to deliver items in batches while maintaining accurate records
  of ordered vs. received quantities.

  ## Changes

  ### 1. Modified Tables
  - **purchase_items**
    - Add `quantity_received` (numeric) - Tracks how much has actually been received
    - Update CHECK constraint to ensure quantity_received <= quantity
    - Convert `received` to computed field based on quantity_received = quantity

  ### 2. Data Migration
  - For existing items where received=true, set quantity_received = quantity
  - For existing items where received=false, set quantity_received = 0

  ### 3. Important Notes
  - Stock updates should be based on quantity_received, not the received boolean
  - quantity_received can be incremented in batches as deliveries arrive
  - An item is fully received when quantity_received = quantity
*/

-- Add quantity_received column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_items' AND column_name = 'quantity_received'
  ) THEN
    ALTER TABLE purchase_items 
    ADD COLUMN quantity_received numeric DEFAULT 0 CHECK (quantity_received >= 0 AND quantity_received <= quantity);
  END IF;
END $$;

-- Migrate existing data
-- Items marked as received should have quantity_received = quantity
-- Items not received should have quantity_received = 0
UPDATE purchase_items
SET quantity_received = CASE 
  WHEN received = true THEN quantity
  ELSE 0
END
WHERE quantity_received IS NULL OR quantity_received = 0;

-- Add index for better performance on quantity tracking queries
CREATE INDEX IF NOT EXISTS idx_purchase_items_quantities ON purchase_items(quantity, quantity_received);

-- Update the check constraint to ensure quantity_received is valid
DO $$
BEGIN
  -- Drop old constraint if it exists
  ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS purchase_items_quantity_received_check;
  
  -- Add new constraint
  ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_quantity_received_check 
    CHECK (quantity_received >= 0 AND quantity_received <= quantity);
END $$;
