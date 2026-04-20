/*
  # Optimize RLS Policy Performance

  1. Performance Improvements
    - Replace auth.uid() with (select auth.uid()) in RLS policies
    - This prevents re-evaluation of auth functions for each row
    - Significantly improves query performance at scale

  2. Tables Updated
    - messages: 2 policies
    - message_attachments: 2 policies
    - message_reads: 2 policies
    - users: 1 policy
    - help_categories: 3 policies
    - help_articles: 3 policies
    - leads: 2 policies
    - devices: 5 policies
    - device_history: 2 policies
    - tickets: 6 policies
    - purchase_order_items: 3 policies
    - purchase_orders: 3 policies
    - foreign_exchange_rates: 2 policies
    - assembly_files: 2 policies
*/

-- Messages policies
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view messages they sent or received" ON public.messages;
CREATE POLICY "Users can view messages they sent or received"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    sender_id = (select auth.uid()) OR 
    receiver_id = (select auth.uid())
  );

-- Message attachments policies
DROP POLICY IF EXISTS "Users can create attachments for their messages" ON public.message_attachments;
CREATE POLICY "Users can create attachments for their messages"
  ON public.message_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messages
      WHERE id = message_id AND sender_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view attachments for their messages" ON public.message_attachments;
CREATE POLICY "Users can view attachments for their messages"
  ON public.message_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages
      WHERE id = message_id AND (sender_id = (select auth.uid()) OR receiver_id = (select auth.uid()))
    )
  );

-- Message reads policies
DROP POLICY IF EXISTS "Users can mark messages as read" ON public.message_reads;
CREATE POLICY "Users can mark messages as read"
  ON public.message_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view read status for their messages" ON public.message_reads;
CREATE POLICY "Users can view read status for their messages"
  ON public.message_reads
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Users policies
DROP POLICY IF EXISTS "users_can_insert_own_profile" ON public.users;
CREATE POLICY "users_can_insert_own_profile"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = (select auth.uid()));

-- Help categories policies
DROP POLICY IF EXISTS "Admins can delete help categories" ON public.help_categories;
CREATE POLICY "Admins can delete help categories"
  ON public.help_categories
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert help categories" ON public.help_categories;
CREATE POLICY "Admins can insert help categories"
  ON public.help_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update help categories" ON public.help_categories;
CREATE POLICY "Admins can update help categories"
  ON public.help_categories
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid()) AND role = 'admin'
    )
  );

-- Help articles policies
DROP POLICY IF EXISTS "Admins can delete help articles" ON public.help_articles;
CREATE POLICY "Admins can delete help articles"
  ON public.help_articles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert help articles" ON public.help_articles;
CREATE POLICY "Admins can insert help articles"
  ON public.help_articles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update help articles" ON public.help_articles;
CREATE POLICY "Admins can update help articles"
  ON public.help_articles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid()) AND role = 'admin'
    )
  );

-- Leads policies
DROP POLICY IF EXISTS "Authenticated users can create leads" ON public.leads;
CREATE POLICY "Authenticated users can create leads"
  ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authenticated users can update leads" ON public.leads;
CREATE POLICY "Authenticated users can update leads"
  ON public.leads
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid())
    )
  );

-- Devices policies
DROP POLICY IF EXISTS "Admin and user can update devices" ON public.devices;
CREATE POLICY "Admin and user can update devices"
  ON public.devices
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid()) AND role IN ('admin', 'user')
    )
  );

DROP POLICY IF EXISTS "Admin and user can view all devices" ON public.devices;
CREATE POLICY "Admin and user can view all devices"
  ON public.devices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid()) AND role IN ('admin', 'user')
    )
  );

DROP POLICY IF EXISTS "Admin can delete devices" ON public.devices;
CREATE POLICY "Admin can delete devices"
  ON public.devices
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admin can insert devices" ON public.devices;
CREATE POLICY "Admin can insert devices"
  ON public.devices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Client and manager can view their customer devices" ON public.devices;
CREATE POLICY "Client and manager can view their customer devices"
  ON public.devices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid()) 
        AND role IN ('client', 'manager')
        AND customer_id = devices.customer_id
    )
  );

-- Device history policies
DROP POLICY IF EXISTS "Admin and user can view all device history" ON public.device_history;
CREATE POLICY "Admin and user can view all device history"
  ON public.device_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid()) AND role IN ('admin', 'user')
    )
  );

DROP POLICY IF EXISTS "Client and manager can view their device history" ON public.device_history;
CREATE POLICY "Client and manager can view their device history"
  ON public.device_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.devices d ON d.id = device_history.device_id
      WHERE u.auth_user_id = (select auth.uid()) 
        AND u.role IN ('client', 'manager')
        AND u.customer_id = d.customer_id
    )
  );

-- Tickets policies
DROP POLICY IF EXISTS "Admin can insert tickets" ON public.tickets;
CREATE POLICY "Admin can insert tickets"
  ON public.tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admin can update tickets" ON public.tickets;
CREATE POLICY "Admin can update tickets"
  ON public.tickets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admin can view all tickets" ON public.tickets;
CREATE POLICY "Admin can view all tickets"
  ON public.tickets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Client and manager can insert tickets for their devices" ON public.tickets;
CREATE POLICY "Client and manager can insert tickets for their devices"
  ON public.tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.devices d ON d.id = device_id
      WHERE u.auth_user_id = (select auth.uid()) 
        AND u.role IN ('client', 'manager')
        AND u.customer_id = d.customer_id
    )
  );

DROP POLICY IF EXISTS "Client and manager can view their customer tickets" ON public.tickets;
CREATE POLICY "Client and manager can view their customer tickets"
  ON public.tickets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.devices d ON d.id = tickets.device_id
      WHERE u.auth_user_id = (select auth.uid()) 
        AND u.role IN ('client', 'manager')
        AND u.customer_id = d.customer_id
    )
  );

DROP POLICY IF EXISTS "Manager can update their customer tickets" ON public.tickets;
CREATE POLICY "Manager can update their customer tickets"
  ON public.tickets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.devices d ON d.id = tickets.device_id
      WHERE u.auth_user_id = (select auth.uid()) 
        AND u.role = 'manager'
        AND u.customer_id = d.customer_id
    )
  );

-- Purchase order items policies
DROP POLICY IF EXISTS "Users can create PO items" ON public.purchase_order_items;
CREATE POLICY "Users can create PO items"
  ON public.purchase_order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete PO items" ON public.purchase_order_items;
CREATE POLICY "Users can delete PO items"
  ON public.purchase_order_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update PO items" ON public.purchase_order_items;
CREATE POLICY "Users can update PO items"
  ON public.purchase_order_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid())
    )
  );

-- Purchase orders policies
DROP POLICY IF EXISTS "Users can create purchase orders" ON public.purchase_orders;
CREATE POLICY "Users can create purchase orders"
  ON public.purchase_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete purchase orders" ON public.purchase_orders;
CREATE POLICY "Users can delete purchase orders"
  ON public.purchase_orders
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update purchase orders" ON public.purchase_orders;
CREATE POLICY "Users can update purchase orders"
  ON public.purchase_orders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid())
    )
  );

-- Foreign exchange rates policies
DROP POLICY IF EXISTS "Admin users can delete exchange rates" ON public.foreign_exchange_rates;
CREATE POLICY "Admin users can delete exchange rates"
  ON public.foreign_exchange_rates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admin users can insert exchange rates" ON public.foreign_exchange_rates;
CREATE POLICY "Admin users can insert exchange rates"
  ON public.foreign_exchange_rates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid()) AND role = 'admin'
    )
  );

-- Assembly files policies
DROP POLICY IF EXISTS "Authenticated users can delete own assembly files" ON public.assembly_files;
CREATE POLICY "Authenticated users can delete own assembly files"
  ON public.assembly_files
  FOR DELETE
  TO authenticated
  USING (uploaded_by = (select auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert assembly files" ON public.assembly_files;
CREATE POLICY "Authenticated users can insert assembly files"
  ON public.assembly_files
  FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = (select auth.uid()));