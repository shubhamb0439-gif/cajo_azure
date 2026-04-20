/*
  # Allow Clients to View Their Sales

  1. Changes
    - Add policy for clients to view sales that belong to their customer account
    - This is required for the sale_items query with inner join to work
    
  2. Security
    - Policy checks that the sale's customer_id matches the user's customer_id
    - Only affects SELECT operations for client role users
*/

-- Allow clients to view their own sales
CREATE POLICY "allow_clients_view_own_sales" 
  ON sales 
  FOR SELECT 
  TO authenticated
  USING (
    customer_id = get_user_customer_id()
  );
