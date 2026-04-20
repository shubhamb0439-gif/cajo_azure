/*
  # Fix Function Search Paths

  1. Security Improvements
    - Set explicit search_path for all functions to prevent search_path hijacking
    - Add 'SET search_path = public, pg_catalog' to all functions
    - Prevents malicious users from creating shadow functions

  2. Functions Updated
    - generate_sale_number
    - generate_ticket_number
    - set_ticket_number
    - log_device_status_change
    - can_update_exchange_rates
    - get_item_stock_by_vendor
    - update_purchase_orders_updated_at
    - execute_assembly_transaction (all 3 overloads)
    - calculate_po_status
    - mark_late_purchase_orders
    - update_po_status
    - fulfill_delivery
    - set_uploaded_by
    - is_admin
    - is_admin_or_self
*/

-- Set search_path for generate_sale_number
ALTER FUNCTION public.generate_sale_number() SET search_path = public, pg_catalog;

-- Set search_path for generate_ticket_number
ALTER FUNCTION public.generate_ticket_number() SET search_path = public, pg_catalog;

-- Set search_path for set_ticket_number
ALTER FUNCTION public.set_ticket_number() SET search_path = public, pg_catalog;

-- Set search_path for log_device_status_change
ALTER FUNCTION public.log_device_status_change() SET search_path = public, pg_catalog;

-- Set search_path for can_update_exchange_rates
ALTER FUNCTION public.can_update_exchange_rates() SET search_path = public, pg_catalog;

-- Set search_path for get_item_stock_by_vendor
ALTER FUNCTION public.get_item_stock_by_vendor(p_item_id uuid) SET search_path = public, pg_catalog;

-- Set search_path for update_purchase_orders_updated_at
ALTER FUNCTION public.update_purchase_orders_updated_at() SET search_path = public, pg_catalog;

-- Set search_path for calculate_po_status
ALTER FUNCTION public.calculate_po_status(po_id_param uuid) SET search_path = public, pg_catalog;

-- Set search_path for mark_late_purchase_orders
ALTER FUNCTION public.mark_late_purchase_orders() SET search_path = public, pg_catalog;

-- Set search_path for update_po_status
ALTER FUNCTION public.update_po_status() SET search_path = public, pg_catalog;

-- Set search_path for fulfill_delivery
ALTER FUNCTION public.fulfill_delivery(p_delivery_id uuid, p_user_id uuid) SET search_path = public, pg_catalog;

-- Set search_path for set_uploaded_by
ALTER FUNCTION public.set_uploaded_by() SET search_path = public, pg_catalog;

-- Set search_path for is_admin
ALTER FUNCTION public.is_admin() SET search_path = public, pg_catalog;

-- Set search_path for is_admin_or_self
ALTER FUNCTION public.is_admin_or_self(user_auth_id uuid) SET search_path = public, pg_catalog;

-- Set search_path for all execute_assembly_transaction overloads
ALTER FUNCTION public.execute_assembly_transaction(p_bom_id text, p_quantity numeric, p_user_id uuid) SET search_path = public, pg_catalog;

ALTER FUNCTION public.execute_assembly_transaction(p_bom_id uuid, p_assembly_name text, p_quantity numeric, p_user_id uuid, p_bom_item_id uuid) SET search_path = public, pg_catalog;

ALTER FUNCTION public.execute_assembly_transaction(p_bom_id uuid, p_assembly_name text, p_quantity numeric, p_user_id uuid, p_bom_item_id uuid, p_po_number text) SET search_path = public, pg_catalog;