/*
  # Add Quantity Field to Sale Items

  ## Overview
  Adds quantity tracking to individual sale items to support multiple units
  of the same product being sold.

  ## Modified Tables

  ### `sale_items`
  - Add `quantity` (integer) - Number of units sold for this item (default 1)

  ## Important Notes
  1. Quantity defaults to 1 for backward compatibility
  2. Subtotal calculations will be quantity × unit_price
*/

-- Add quantity to sale_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_items' AND column_name = 'quantity'
  ) THEN
    ALTER TABLE sale_items ADD COLUMN quantity integer DEFAULT 1;
  END IF;
END $$;
