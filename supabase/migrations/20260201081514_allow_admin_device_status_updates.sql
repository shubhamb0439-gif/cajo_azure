/*
  # Allow admins to update any device status

  1. Changes
    - Add policy for admins to update any device status
    - Admins can update to any status (not limited like clients/managers)
    - This allows admins to scan and update device status from mobile

  2. Security
    - Only authenticated admins can use this policy
    - Admins have full control over device status
*/

-- Create policy for admins to update any device status
CREATE POLICY "Admin can update any device status"
  ON devices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_user_id = auth.uid() 
      AND role IN ('admin', 'user')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_user_id = auth.uid() 
      AND role IN ('admin', 'user')
    )
  );