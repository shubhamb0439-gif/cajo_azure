/*
  # Allow Clients to View Their Sale Items (Fix)

  1. Changes
    - Add policy for clients to view sale items that belong to their customer account
    - This enables clients to raise tickets for devices they've purchased
    
  2. Security
    - Policy checks that the sale_item's sale belongs to the user's customer_id
    - Only affects SELECT operations for client role users
*/

-- Drop the old client policy if it exists
DROP POLICY IF EXISTS "allow_clients_view_own_sale_items" ON sale_items;

-- Allow clients to view sale items from their sales
CREATE POLICY "allow_clients_view_own_sale_items" 
  ON sale_items 
  FOR SELECT 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_items.sale_id
      AND sales.customer_id = get_user_customer_id()
    )
  );
