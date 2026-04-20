/*
  # Allow users to delete their own requests

  1. Changes
    - Add policy for users to delete their own bug reports and feature requests
    - Users can only delete requests they created
  
  2. Security
    - Users can only delete requests where created_by matches their user ID
    - Admins retain their existing ability to delete any request
*/

CREATE POLICY "Users can delete own requests"
  ON system_requests
  FOR DELETE
  TO authenticated
  USING (
    created_by IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );
