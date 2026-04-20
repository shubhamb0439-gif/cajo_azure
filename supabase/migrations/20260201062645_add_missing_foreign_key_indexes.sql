/*
  # Add Missing Foreign Key Indexes

  1. Performance Improvements
    - Add indexes for all foreign key columns that are missing them
    - Improves JOIN performance and query optimization
    - Resolves unindexed foreign key warnings

  2. New Indexes
    - activity_logs: user_id
    - customers: created_by, updated_by
    - deliveries: created_by, delivered_by, updated_by
    - device_history: changed_by
    - foreign_exchange_rates: updated_by
    - leads: created_by, updated_by
    - prospects: created_by, updated_by
    - purchase_items: created_by, updated_by
    - purchase_order_items: bom_id
    - purchase_orders: created_by
    - sales: created_by, updated_by
    - stock_movements: created_by
    - tickets: closed_by, raised_by
*/

-- Activity logs indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);

-- Customers indexes
CREATE INDEX IF NOT EXISTS idx_customers_created_by ON public.customers(created_by);
CREATE INDEX IF NOT EXISTS idx_customers_updated_by ON public.customers(updated_by);

-- Deliveries indexes
CREATE INDEX IF NOT EXISTS idx_deliveries_created_by ON public.deliveries(created_by);
CREATE INDEX IF NOT EXISTS idx_deliveries_delivered_by ON public.deliveries(delivered_by);
CREATE INDEX IF NOT EXISTS idx_deliveries_updated_by ON public.deliveries(updated_by);

-- Device history indexes
CREATE INDEX IF NOT EXISTS idx_device_history_changed_by ON public.device_history(changed_by);

-- Foreign exchange rates indexes
CREATE INDEX IF NOT EXISTS idx_foreign_exchange_rates_updated_by ON public.foreign_exchange_rates(updated_by);

-- Leads indexes
CREATE INDEX IF NOT EXISTS idx_leads_created_by ON public.leads(created_by);
CREATE INDEX IF NOT EXISTS idx_leads_updated_by ON public.leads(updated_by);

-- Prospects indexes
CREATE INDEX IF NOT EXISTS idx_prospects_created_by ON public.prospects(created_by);
CREATE INDEX IF NOT EXISTS idx_prospects_updated_by ON public.prospects(updated_by);

-- Purchase items indexes
CREATE INDEX IF NOT EXISTS idx_purchase_items_created_by ON public.purchase_items(created_by);
CREATE INDEX IF NOT EXISTS idx_purchase_items_updated_by ON public.purchase_items(updated_by);

-- Purchase order items indexes
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_bom_id ON public.purchase_order_items(bom_id);

-- Purchase orders indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_by ON public.purchase_orders(created_by);

-- Sales indexes
CREATE INDEX IF NOT EXISTS idx_sales_created_by ON public.sales(created_by);
CREATE INDEX IF NOT EXISTS idx_sales_updated_by ON public.sales(updated_by);

-- Stock movements indexes
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_by ON public.stock_movements(created_by);

-- Tickets indexes
CREATE INDEX IF NOT EXISTS idx_tickets_closed_by ON public.tickets(closed_by);
CREATE INDEX IF NOT EXISTS idx_tickets_raised_by ON public.tickets(raised_by);