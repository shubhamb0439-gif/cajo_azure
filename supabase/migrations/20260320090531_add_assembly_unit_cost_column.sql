/*
  # Add Assembly Unit Cost Column

  ## Problem
  - execute_assembly_transaction function tries to insert assembly_unit_cost
  - But assembly_units table doesn't have this column
  
  ## Solution
  - Add assembly_unit_cost column to assembly_units table
  - This tracks the calculated cost of each assembled unit based on component costs

  ## Changes
  1. Add assembly_unit_cost column (numeric, nullable, default 0)
  2. Add created_by and updated_by columns if missing (for consistency)
*/

-- Add assembly_unit_cost column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assembly_units' AND column_name = 'assembly_unit_cost'
  ) THEN
    ALTER TABLE assembly_units 
    ADD COLUMN assembly_unit_cost numeric DEFAULT 0;
  END IF;
END $$;

-- Add created_by column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assembly_units' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE assembly_units 
    ADD COLUMN created_by uuid REFERENCES users(id);
  END IF;
END $$;

-- Add updated_by column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assembly_units' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE assembly_units 
    ADD COLUMN updated_by uuid REFERENCES users(id);
  END IF;
END $$;