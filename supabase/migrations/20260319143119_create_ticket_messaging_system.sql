/*
  # Create Ticket Messaging System

  1. New Tables
    - `ticket_messages`
      - `id` (uuid, primary key)
      - `ticket_id` (uuid, foreign key to tickets)
      - `sender_id` (uuid, foreign key to users)
      - `message` (text)
      - `created_at` (timestamptz)

    - `ticket_message_reads`
      - `id` (uuid, primary key)
      - `ticket_id` (uuid, foreign key to tickets)
      - `user_id` (uuid, foreign key to users)
      - `last_read_at` (timestamptz)
      - Unique constraint on (ticket_id, user_id)

  2. Security
    - Enable RLS on both tables
    - Users can view messages for tickets they have access to
    - Users can send messages to tickets they have access to
    - Users can update their own read status

  3. Indexes
    - Index on ticket_id for fast message lookups
    - Index on sender_id for user message queries
    - Composite index on (ticket_id, user_id) for read tracking
*/

-- Create ticket_messages table
CREATE TABLE IF NOT EXISTS ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create ticket_message_reads table
CREATE TABLE IF NOT EXISTS ticket_message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at timestamptz DEFAULT now(),
  UNIQUE(ticket_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_sender_id ON ticket_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_ticket_message_reads_ticket_user ON ticket_message_reads(ticket_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_message_reads_user_id ON ticket_message_reads(user_id);

-- Enable RLS
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_message_reads ENABLE ROW LEVEL SECURITY;

-- Policies for ticket_messages
CREATE POLICY "Users can view messages for their customer's tickets"
  ON ticket_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      INNER JOIN users u ON u.id = auth.uid()
      WHERE t.id = ticket_messages.ticket_id
      AND (
        (u.role = 'client' AND t.customer_id = u.customer_id)
        OR (u.role = 'manager' AND t.customer_id = u.customer_id)
        OR (u.role IN ('admin', 'user'))
      )
    )
  );

CREATE POLICY "Users can send messages to accessible tickets"
  ON ticket_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets t
      INNER JOIN users u ON u.id = auth.uid()
      WHERE t.id = ticket_messages.ticket_id
      AND (
        (u.role = 'client' AND t.customer_id = u.customer_id)
        OR (u.role = 'manager' AND t.customer_id = u.customer_id)
        OR (u.role IN ('admin', 'user'))
      )
    )
    AND sender_id = auth.uid()
  );

-- Policies for ticket_message_reads
CREATE POLICY "Users can view their own read status"
  ON ticket_message_reads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own read status"
  ON ticket_message_reads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own read status"
  ON ticket_message_reads FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Enable realtime for ticket messages
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_message_reads;
