/*
  # Enable Real-time for Messaging System

  1. Changes
    - Enable real-time replication for messages table
    - Enable real-time replication for message_reads table
    - Enable real-time replication for message_attachments table

  2. Purpose
    - Allow clients to receive instant updates when new messages are sent
    - Enable real-time read receipt updates
    - Support real-time attachment notifications
    - Improve user experience with instant messaging functionality
*/

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Enable realtime for message_reads table
ALTER PUBLICATION supabase_realtime ADD TABLE message_reads;

-- Enable realtime for message_attachments table
ALTER PUBLICATION supabase_realtime ADD TABLE message_attachments;
