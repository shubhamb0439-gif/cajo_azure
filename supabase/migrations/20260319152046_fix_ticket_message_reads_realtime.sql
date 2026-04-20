/*
  # Fix Ticket Message Reads for Realtime Updates

  1. Changes
    - Set replica identity to FULL for ticket_message_reads table
    - This ensures all row data is included in realtime updates
    - Allows proper detection of read status changes across all sessions

  2. Notes
    - FULL replica identity includes all column values in the replication stream
    - This is critical for real-time notification removal when tickets are opened
*/

-- Set replica identity to FULL to capture all changes including updates
ALTER TABLE ticket_message_reads REPLICA IDENTITY FULL;
