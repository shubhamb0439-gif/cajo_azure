/*
  # Allow Clients to Read Their Customer Company

  1. Changes
    - Add RLS policy to allow clients and managers to read their own customer record
    - This enables the client portal to display the company name

  2. Security
    - Clients can only read the customer record that matches their user.customer_id
    - Uses auth.uid() to ensure proper user identification
*/

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "secure_customers_select_own" ON customers;

-- Allow clients/managers to read their own customer record
CREATE POLICY "secure_customers_select_own"
  ON customers
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT customer_id 
      FROM users 
      WHERE auth_user_id = auth.uid()
      AND customer_id IS NOT NULL
    )
  );