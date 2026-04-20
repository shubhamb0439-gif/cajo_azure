/*
  # Add Pricing Fields to Purchase Orders and Sales

  ## Overview
  Adds unit price and total value tracking fields to purchase orders and sales systems.

  ## Modified Tables

  ### `purchase_order_items`
  - Add `unit_price` (numeric) - Unit price for each BOM item in the purchase order

  ### `purchase_orders`
  - Add `po_value` (numeric) - Total value of the purchase order (sum of all items)

  ### `sale_items`
  - Add `unit_price` (numeric) - Unit price for each product in the sale

  ### `sales`
  - Add `unit_price` (numeric) - Unit price when sale is linked to a PO
  - Add `sale_value` (numeric) - Total value of the sale

  ## Important Notes
  1. All price fields default to 0
  2. Values are stored as numeric for precision in financial calculations
  3. PO value is calculated as sum of (quantity × unit_price) for all items
  4. Sale value is calculated similarly based on whether it's a PO-based sale or not
*/

-- Add unit_price to purchase_order_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_order_items' AND column_name = 'unit_price'
  ) THEN
    ALTER TABLE purchase_order_items ADD COLUMN unit_price numeric(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Add po_value to purchase_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'po_value'
  ) THEN
    ALTER TABLE purchase_orders ADD COLUMN po_value numeric(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Add unit_price to sale_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_items' AND column_name = 'unit_price'
  ) THEN
    ALTER TABLE sale_items ADD COLUMN unit_price numeric(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Add unit_price to sales (for PO-based sales)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'unit_price'
  ) THEN
    ALTER TABLE sales ADD COLUMN unit_price numeric(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Add sale_value to sales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'sale_value'
  ) THEN
    ALTER TABLE sales ADD COLUMN sale_value numeric(10, 2) DEFAULT 0;
  END IF;
END $$;
