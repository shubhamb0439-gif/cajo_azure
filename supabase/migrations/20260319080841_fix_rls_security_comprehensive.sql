/*
  # Comprehensive RLS Security Fix

  Addresses all 26 security warnings by replacing overly permissive policies
  with proper role/rights/ownership checks.

  ## Security Model
  - read_write + enabled: Full CRUD
  - read_only + enabled: View only  
  - enabled=false: No access
  - Staff (admin/user): Organizational data
  - Clients/Managers: Customer-specific data only
*/

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_user_enabled()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM users WHERE users.auth_user_id = auth.uid() AND users.enabled = true);
END;
$$;

CREATE OR REPLACE FUNCTION public.user_has_write_access()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM users WHERE users.auth_user_id = auth.uid() AND users.enabled = true AND users.user_rights = 'read_write');
END;
$$;

CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM users WHERE users.auth_user_id = auth.uid() AND users.enabled = true AND users.role = 'admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.is_user_staff()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM users WHERE users.auth_user_id = auth.uid() AND users.enabled = true AND users.role IN ('admin', 'user'));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_customer_id()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  RETURN (SELECT customer_id FROM users WHERE users.auth_user_id = auth.uid() AND users.enabled = true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  RETURN (SELECT id FROM users WHERE users.auth_user_id = auth.uid() AND users.enabled = true);
END;
$$;

-- =====================================================
-- DROP OVERLY PERMISSIVE POLICIES
-- =====================================================

-- Activity Logs
DROP POLICY IF EXISTS "Authenticated users can delete activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Authenticated users can view activity logs" ON activity_logs;

-- Assemblies & Related
DROP POLICY IF EXISTS "Authenticated users can delete assemblies" ON assemblies;
DROP POLICY IF EXISTS "Authenticated users can insert assemblies" ON assemblies;
DROP POLICY IF EXISTS "Authenticated users can update assemblies" ON assemblies;
DROP POLICY IF EXISTS "Authenticated users can view assemblies" ON assemblies;

DROP POLICY IF EXISTS "Authenticated users can delete assembly items" ON assembly_items;
DROP POLICY IF EXISTS "Authenticated users can insert assembly items" ON assembly_items;
DROP POLICY IF EXISTS "Authenticated users can update assembly items" ON assembly_items;
DROP POLICY IF EXISTS "Authenticated users can view assembly items" ON assembly_items;

DROP POLICY IF EXISTS "Authenticated users can delete assembly units" ON assembly_units;
DROP POLICY IF EXISTS "Authenticated users can insert assembly units" ON assembly_units;
DROP POLICY IF EXISTS "Authenticated users can update assembly units" ON assembly_units;
DROP POLICY IF EXISTS "Authenticated users can view assembly units" ON assembly_units;

DROP POLICY IF EXISTS "Authenticated users can delete own assembly files" ON assembly_files;
DROP POLICY IF EXISTS "Authenticated users can insert assembly files" ON assembly_files;
DROP POLICY IF EXISTS "Authenticated users can view assembly files" ON assembly_files;

-- BOMs
DROP POLICY IF EXISTS "Authenticated users can delete bom items" ON bom_items;
DROP POLICY IF EXISTS "Authenticated users can insert bom items" ON bom_items;
DROP POLICY IF EXISTS "Authenticated users can update bom items" ON bom_items;
DROP POLICY IF EXISTS "Authenticated users can view bom items" ON bom_items;

DROP POLICY IF EXISTS "Authenticated users can delete boms" ON boms;
DROP POLICY IF EXISTS "Authenticated users can insert boms" ON boms;
DROP POLICY IF EXISTS "Authenticated users can update boms" ON boms;
DROP POLICY IF EXISTS "Authenticated users can view boms" ON boms;

-- Inventory
DROP POLICY IF EXISTS "Authenticated users can delete inventory items" ON inventory_items;
DROP POLICY IF EXISTS "Authenticated users can insert inventory items" ON inventory_items;
DROP POLICY IF EXISTS "Authenticated users can update inventory items" ON inventory_items;
DROP POLICY IF EXISTS "Authenticated users can view inventory items" ON inventory_items;

-- Vendors
DROP POLICY IF EXISTS "Authenticated users can delete vendors" ON vendors;
DROP POLICY IF EXISTS "Authenticated users can insert vendors" ON vendors;
DROP POLICY IF EXISTS "Authenticated users can update vendors" ON vendors;
DROP POLICY IF EXISTS "Authenticated users can view vendors" ON vendors;

-- Purchases
DROP POLICY IF EXISTS "Authenticated users can delete purchases" ON purchases;
DROP POLICY IF EXISTS "Authenticated users can insert purchases" ON purchases;
DROP POLICY IF EXISTS "Authenticated users can update purchases" ON purchases;
DROP POLICY IF EXISTS "Authenticated users can view purchases" ON purchases;

DROP POLICY IF EXISTS "Authenticated users can delete purchase items" ON purchase_items;
DROP POLICY IF EXISTS "Authenticated users can insert purchase items" ON purchase_items;
DROP POLICY IF EXISTS "Authenticated users can update purchase items" ON purchase_items;
DROP POLICY IF EXISTS "Authenticated users can view purchase items" ON purchase_items;

-- Sales Pipeline
DROP POLICY IF EXISTS "Authenticated users can create leads" ON leads;
DROP POLICY IF EXISTS "Authenticated users can delete leads" ON leads;
DROP POLICY IF EXISTS "Authenticated users can update leads" ON leads;
DROP POLICY IF EXISTS "Authenticated users can view all leads" ON leads;

DROP POLICY IF EXISTS "Authenticated users can delete prospects" ON prospects;
DROP POLICY IF EXISTS "Authenticated users can insert prospects" ON prospects;
DROP POLICY IF EXISTS "Authenticated users can update prospects" ON prospects;
DROP POLICY IF EXISTS "Authenticated users can view all prospects" ON prospects;

DROP POLICY IF EXISTS "Authenticated users can delete customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can view all customers" ON customers;

-- Sales & Deliveries
DROP POLICY IF EXISTS "Authenticated users can create sales" ON sales;
DROP POLICY IF EXISTS "Authenticated users can delete sales" ON sales;
DROP POLICY IF EXISTS "Authenticated users can update sales" ON sales;
DROP POLICY IF EXISTS "Authenticated users can view sales" ON sales;

DROP POLICY IF EXISTS "Authenticated users can create sale items" ON sale_items;
DROP POLICY IF EXISTS "Authenticated users can delete sale items" ON sale_items;
DROP POLICY IF EXISTS "Authenticated users can update sale items" ON sale_items;
DROP POLICY IF EXISTS "Authenticated users can view sale items" ON sale_items;

DROP POLICY IF EXISTS "Authenticated users can create deliveries" ON deliveries;
DROP POLICY IF EXISTS "Authenticated users can delete deliveries" ON deliveries;
DROP POLICY IF EXISTS "Authenticated users can update deliveries" ON deliveries;
DROP POLICY IF EXISTS "Authenticated users can view deliveries" ON deliveries;

DROP POLICY IF EXISTS "Authenticated users can delete delivery items" ON delivery_items;
DROP POLICY IF EXISTS "Authenticated users can insert delivery items" ON delivery_items;
DROP POLICY IF EXISTS "Authenticated users can update delivery items" ON delivery_items;
DROP POLICY IF EXISTS "Authenticated users can view delivery items" ON delivery_items;

-- Purchase Orders
DROP POLICY IF EXISTS "Users can create purchase orders" ON purchase_orders;
DROP POLICY IF EXISTS "Users can delete purchase orders" ON purchase_orders;
DROP POLICY IF EXISTS "Users can update purchase orders" ON purchase_orders;
DROP POLICY IF EXISTS "Users can view purchase orders" ON purchase_orders;

DROP POLICY IF EXISTS "Users can create PO items" ON purchase_order_items;
DROP POLICY IF EXISTS "Users can delete PO items" ON purchase_order_items;
DROP POLICY IF EXISTS "Users can update PO items" ON purchase_order_items;
DROP POLICY IF EXISTS "Users can view PO items" ON purchase_order_items;

-- Stock Movements
DROP POLICY IF EXISTS "Authenticated users can create stock movements" ON stock_movements;
DROP POLICY IF EXISTS "Authenticated users can view stock movements" ON stock_movements;

-- Dropdown Values (keep view, replace others)
DROP POLICY IF EXISTS "Admins can delete dropdown values" ON dropdown_values;
DROP POLICY IF EXISTS "Admins can insert dropdown values" ON dropdown_values;
DROP POLICY IF EXISTS "Admins can update dropdown values" ON dropdown_values;

-- System Requests (keep some, replace others)
DROP POLICY IF EXISTS "Authenticated users can view all requests" ON system_requests;
DROP POLICY IF EXISTS "Authenticated users can insert requests" ON system_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON system_requests;
DROP POLICY IF EXISTS "Admins can delete requests" ON system_requests;

-- =====================================================
-- CREATE SECURE POLICIES
-- =====================================================

-- ACTIVITY LOGS (User-specific or admin)
CREATE POLICY "secure_activity_logs_select" ON activity_logs FOR SELECT TO authenticated
  USING (is_user_enabled() AND (user_id = get_current_user_id() OR is_user_admin()));

-- INVENTORY ITEMS (Staff only, respect write access)
CREATE POLICY "secure_inventory_select" ON inventory_items FOR SELECT TO authenticated
  USING (is_user_staff());

CREATE POLICY "secure_inventory_insert" ON inventory_items FOR INSERT TO authenticated
  WITH CHECK (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_inventory_update" ON inventory_items FOR UPDATE TO authenticated
  USING (is_user_staff() AND user_has_write_access())
  WITH CHECK (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_inventory_delete" ON inventory_items FOR DELETE TO authenticated
  USING (is_user_staff() AND user_has_write_access());

-- VENDORS (Staff only, respect write access)
CREATE POLICY "secure_vendors_select" ON vendors FOR SELECT TO authenticated
  USING (is_user_staff());

CREATE POLICY "secure_vendors_insert" ON vendors FOR INSERT TO authenticated
  WITH CHECK (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_vendors_update" ON vendors FOR UPDATE TO authenticated
  USING (is_user_staff() AND user_has_write_access())
  WITH CHECK (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_vendors_delete" ON vendors FOR DELETE TO authenticated
  USING (is_user_staff() AND user_has_write_access());

-- PURCHASES & PURCHASE ITEMS (Staff only, respect write access)
CREATE POLICY "secure_purchases_select" ON purchases FOR SELECT TO authenticated
  USING (is_user_staff());

CREATE POLICY "secure_purchases_insert" ON purchases FOR INSERT TO authenticated
  WITH CHECK (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_purchases_update" ON purchases FOR UPDATE TO authenticated
  USING (is_user_staff() AND user_has_write_access())
  WITH CHECK (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_purchases_delete" ON purchases FOR DELETE TO authenticated
  USING (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_purchase_items_select" ON purchase_items FOR SELECT TO authenticated
  USING (is_user_staff());

CREATE POLICY "secure_purchase_items_insert" ON purchase_items FOR INSERT TO authenticated
  WITH CHECK (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_purchase_items_update" ON purchase_items FOR UPDATE TO authenticated
  USING (is_user_staff() AND user_has_write_access())
  WITH CHECK (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_purchase_items_delete" ON purchase_items FOR DELETE TO authenticated
  USING (is_user_staff() AND user_has_write_access());

-- BOMs & BOM ITEMS (Staff only, respect write access)
CREATE POLICY "secure_boms_select" ON boms FOR SELECT TO authenticated
  USING (is_user_staff());

CREATE POLICY "secure_boms_insert" ON boms FOR INSERT TO authenticated
  WITH CHECK (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_boms_update" ON boms FOR UPDATE TO authenticated
  USING (is_user_staff() AND user_has_write_access())
  WITH CHECK (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_boms_delete" ON boms FOR DELETE TO authenticated
  USING (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_bom_items_select" ON bom_items FOR SELECT TO authenticated
  USING (is_user_staff());

CREATE POLICY "secure_bom_items_insert" ON bom_items FOR INSERT TO authenticated
  WITH CHECK (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_bom_items_update" ON bom_items FOR UPDATE TO authenticated
  USING (is_user_staff() AND user_has_write_access())
  WITH CHECK (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_bom_items_delete" ON bom_items FOR DELETE TO authenticated
  USING (is_user_staff() AND user_has_write_access());

-- ASSEMBLIES, UNITS & ITEMS (Staff only, respect write access)
CREATE POLICY "secure_assemblies_select" ON assemblies FOR SELECT TO authenticated
  USING (is_user_staff());

CREATE POLICY "secure_assemblies_insert" ON assemblies FOR INSERT TO authenticated
  WITH CHECK (is_user_staff() AND user_has_write_access() AND created_by = get_current_user_id());

CREATE POLICY "secure_assemblies_update" ON assemblies FOR UPDATE TO authenticated
  USING (is_user_staff() AND user_has_write_access())
  WITH CHECK (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_assemblies_delete" ON assemblies FOR DELETE TO authenticated
  USING (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_assembly_units_select" ON assembly_units FOR SELECT TO authenticated
  USING (is_user_staff());

CREATE POLICY "secure_assembly_units_insert" ON assembly_units FOR INSERT TO authenticated
  WITH CHECK (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_assembly_units_update" ON assembly_units FOR UPDATE TO authenticated
  USING (is_user_staff() AND user_has_write_access())
  WITH CHECK (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_assembly_units_delete" ON assembly_units FOR DELETE TO authenticated
  USING (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_assembly_items_select" ON assembly_items FOR SELECT TO authenticated
  USING (is_user_staff());

CREATE POLICY "secure_assembly_items_insert" ON assembly_items FOR INSERT TO authenticated
  WITH CHECK (is_user_staff() AND user_has_write_access() AND created_by = get_current_user_id());

CREATE POLICY "secure_assembly_items_update" ON assembly_items FOR UPDATE TO authenticated
  USING (is_user_staff() AND user_has_write_access())
  WITH CHECK (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_assembly_items_delete" ON assembly_items FOR DELETE TO authenticated
  USING (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_assembly_files_select" ON assembly_files FOR SELECT TO authenticated
  USING (is_user_staff());

CREATE POLICY "secure_assembly_files_insert" ON assembly_files FOR INSERT TO authenticated
  WITH CHECK (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_assembly_files_delete" ON assembly_files FOR DELETE TO authenticated
  USING (is_user_staff() AND user_has_write_access());

-- SALES PIPELINE (Staff only, respect write access)
CREATE POLICY "secure_leads_select" ON leads FOR SELECT TO authenticated
  USING (is_user_staff());

CREATE POLICY "secure_leads_all" ON leads FOR ALL TO authenticated
  USING (is_user_staff() AND user_has_write_access())
  WITH CHECK (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_prospects_select" ON prospects FOR SELECT TO authenticated
  USING (is_user_staff());

CREATE POLICY "secure_prospects_all" ON prospects FOR ALL TO authenticated
  USING (is_user_staff() AND user_has_write_access())
  WITH CHECK (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_customers_select" ON customers FOR SELECT TO authenticated
  USING (is_user_staff());

CREATE POLICY "secure_customers_all" ON customers FOR ALL TO authenticated
  USING (is_user_staff() AND user_has_write_access())
  WITH CHECK (is_user_staff() AND user_has_write_access());

-- SALES & DELIVERIES (Staff only, respect write access)
CREATE POLICY "secure_sales_select" ON sales FOR SELECT TO authenticated
  USING (is_user_staff());

CREATE POLICY "secure_sales_all" ON sales FOR ALL TO authenticated
  USING (is_user_staff() AND user_has_write_access())
  WITH CHECK (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_sale_items_select" ON sale_items FOR SELECT TO authenticated
  USING (is_user_staff());

CREATE POLICY "secure_sale_items_all" ON sale_items FOR ALL TO authenticated
  USING (is_user_staff() AND user_has_write_access())
  WITH CHECK (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_deliveries_select" ON deliveries FOR SELECT TO authenticated
  USING (is_user_staff());

CREATE POLICY "secure_deliveries_all" ON deliveries FOR ALL TO authenticated
  USING (is_user_staff() AND user_has_write_access())
  WITH CHECK (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_delivery_items_select" ON delivery_items FOR SELECT TO authenticated
  USING (is_user_staff());

CREATE POLICY "secure_delivery_items_all" ON delivery_items FOR ALL TO authenticated
  USING (is_user_staff() AND user_has_write_access())
  WITH CHECK (is_user_staff() AND user_has_write_access());

-- PURCHASE ORDERS (Staff only, respect write access)
CREATE POLICY "secure_purchase_orders_select" ON purchase_orders FOR SELECT TO authenticated
  USING (is_user_staff());

CREATE POLICY "secure_purchase_orders_all" ON purchase_orders FOR ALL TO authenticated
  USING (is_user_staff() AND user_has_write_access())
  WITH CHECK (is_user_staff() AND user_has_write_access());

CREATE POLICY "secure_purchase_order_items_select" ON purchase_order_items FOR SELECT TO authenticated
  USING (is_user_staff());

CREATE POLICY "secure_purchase_order_items_all" ON purchase_order_items FOR ALL TO authenticated
  USING (is_user_staff() AND user_has_write_access())
  WITH CHECK (is_user_staff() AND user_has_write_access());

-- STOCK MOVEMENTS (Staff only, respect write access)
CREATE POLICY "secure_stock_movements_select" ON stock_movements FOR SELECT TO authenticated
  USING (is_user_staff());

CREATE POLICY "secure_stock_movements_all" ON stock_movements FOR ALL TO authenticated
  USING (is_user_staff() AND user_has_write_access())
  WITH CHECK (is_user_staff() AND user_has_write_access());

-- DROPDOWN VALUES (Staff with write access can manage)
CREATE POLICY "secure_dropdown_values_all" ON dropdown_values FOR ALL TO authenticated
  USING (is_user_staff() AND user_has_write_access())
  WITH CHECK (is_user_staff() AND user_has_write_access());

-- SYSTEM REQUESTS (Users see own + admins see all)
CREATE POLICY "secure_system_requests_select" ON system_requests FOR SELECT TO authenticated
  USING (is_user_enabled() AND (created_by = get_current_user_id() OR is_user_admin()));

CREATE POLICY "secure_system_requests_insert" ON system_requests FOR INSERT TO authenticated
  WITH CHECK (is_user_enabled() AND created_by = get_current_user_id());

CREATE POLICY "secure_system_requests_update" ON system_requests FOR UPDATE TO authenticated
  USING (is_user_enabled() AND (created_by = get_current_user_id() OR is_user_admin()))
  WITH CHECK (is_user_enabled() AND (created_by = get_current_user_id() OR is_user_admin()));

-- PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_users_customer_id ON users(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_role_rights ON users(role, user_rights) WHERE enabled = true;
