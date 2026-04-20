/*
  # Set Ticket Messages Replica Identity to FULL

  1. Changes
    - Set replica identity to FULL for ticket_messages table
    - This ensures all row data is included in realtime updates
    - Improves real-time chat message delivery

  2. Notes
    - FULL replica identity includes all column values in the replication stream
    - This is needed for proper real-time subscriptions
*/

-- Set replica identity to FULL to capture all changes
ALTER TABLE ticket_messages REPLICA IDENTITY FULL;
