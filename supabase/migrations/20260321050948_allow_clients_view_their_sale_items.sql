/*
  # Allow Clients and Managers to View Their Sale Items

  ## Changes
  - Add RLS policy to allow clients and managers to view sale_items for their customer
  - This enables ticket creation for delivered devices by serial number lookup

  ## Security
  - Policy checks that the user's customer_id matches the sale's customer_id
  - Uses the existing get_user_customer_id() security definer function
*/

-- Add policy for clients and managers to view their own sale items
CREATE POLICY "Clients and managers can view their sale items"
  ON sale_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_items.sale_id
      AND sales.customer_id = get_user_customer_id()
    )
  );
