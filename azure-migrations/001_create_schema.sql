/*
  ============================================================
  AZURE SQL MIGRATION 001 — Create Cajo ERP Schema
  ============================================================
  Converts the Supabase/PostgreSQL schema to Azure SQL (T-SQL).

  Key differences from PostgreSQL:
  - Uses UNIQUEIDENTIFIER + NEWID() instead of uuid + gen_random_uuid()
  - Uses NVARCHAR instead of text
  - Uses BIT instead of boolean
  - Uses DATETIME2 instead of timestamptz
  - Uses NVARCHAR(MAX) for JSON columns (stored as JSON strings)
  - No RLS — access control is handled by the API layer (Azure Functions)
  - Indexes added explicitly for FK columns

  Tables created:
  1.  users
  2.  inventory_items
  3.  boms
  4.  bom_components
  5.  assemblies
  6.  assembly_units
  7.  assembly_components
  8.  vendors
  9.  purchases
  10. purchase_items
  11. purchase_orders
  12. purchase_order_items
  13. customers
  14. leads
  15. dropdown_types
  16. dropdown_values
  17. prospects
  18. sales
  19. sale_items
  20. deliveries
  21. delivery_items
  22. devices
  23. device_issue_types
  24. tickets
  25. ticket_messages
  26. ticket_message_reads
  27. messages
  28. message_reads
  29. activity_logs
  30. help_categories
  31. help_articles
  32. system_requests
  33. foreign_exchange_rates
  34. assembly_files
  ============================================================
*/

-- ─── USERS ───────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'users')
CREATE TABLE users (
    id                   UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    auth_user_id         NVARCHAR(255)     NOT NULL UNIQUE,
    email                NVARCHAR(255)     NOT NULL UNIQUE,
    name                 NVARCHAR(255)     NOT NULL DEFAULT '',
    role                 NVARCHAR(50)      NOT NULL DEFAULT 'user',
    user_rights          NVARCHAR(50)      NOT NULL DEFAULT 'read_write',
    enabled              BIT               NOT NULL DEFAULT 0,
    profile_picture_url  NVARCHAR(1000)    NULL,
    customer_id          UNIQUEIDENTIFIER  NULL,
    created_at           DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at           DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- ─── VENDORS ─────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'vendors')
CREATE TABLE vendors (
    id               UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    name             NVARCHAR(255)     NOT NULL,
    email            NVARCHAR(255)     NULL,
    phone            NVARCHAR(50)      NULL,
    address          NVARCHAR(1000)    NULL,
    contact_name     NVARCHAR(255)     NULL,
    rating           DECIMAL(3,1)      NULL DEFAULT 0,
    rating_count     INT               NOT NULL DEFAULT 0,
    rating_average   DECIMAL(3,1)      NULL DEFAULT 0,
    notes            NVARCHAR(MAX)     NULL,
    created_at       DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at       DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- ─── INVENTORY ITEMS ─────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'inventory_items')
CREATE TABLE inventory_items (
    id                  UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    name                NVARCHAR(255)     NOT NULL,
    description         NVARCHAR(MAX)     NULL,
    sku                 NVARCHAR(100)     NULL UNIQUE,
    category            NVARCHAR(100)     NULL,
    unit                NVARCHAR(50)      NULL DEFAULT 'pcs',
    quantity_in_stock   DECIMAL(18,4)     NOT NULL DEFAULT 0,
    reorder_point       DECIMAL(18,4)     NULL DEFAULT 0,
    unit_cost           DECIMAL(18,4)     NULL DEFAULT 0,
    sales_sold          INT               NOT NULL DEFAULT 0,
    is_finished_product BIT               NOT NULL DEFAULT 0,
    vendor_id           UNIQUEIDENTIFIER  NULL,
    created_at          DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at          DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_inventory_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);
GO
CREATE INDEX IX_inventory_vendor ON inventory_items(vendor_id);
GO

-- ─── BOMS ────────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'boms')
CREATE TABLE boms (
    id                  UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    name                NVARCHAR(255)     NOT NULL,
    description         NVARCHAR(MAX)     NULL,
    finished_product_id UNIQUEIDENTIFIER  NOT NULL,
    output_quantity     DECIMAL(18,4)     NOT NULL DEFAULT 1,
    created_at          DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at          DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_bom_product FOREIGN KEY (finished_product_id) REFERENCES inventory_items(id)
);
GO
CREATE INDEX IX_bom_product ON boms(finished_product_id);
GO

-- ─── BOM COMPONENTS ──────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'bom_components')
CREATE TABLE bom_components (
    id                  UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    bom_id              UNIQUEIDENTIFIER  NOT NULL,
    inventory_item_id   UNIQUEIDENTIFIER  NOT NULL,
    quantity_required   DECIMAL(18,4)     NOT NULL DEFAULT 1,
    created_at          DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_bomc_bom  FOREIGN KEY (bom_id) REFERENCES boms(id) ON DELETE CASCADE,
    CONSTRAINT FK_bomc_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
);
GO
CREATE INDEX IX_bomc_bom  ON bom_components(bom_id);
CREATE INDEX IX_bomc_item ON bom_components(inventory_item_id);
GO

-- ─── ASSEMBLIES ──────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'assemblies')
CREATE TABLE assemblies (
    id          UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    bom_id      UNIQUEIDENTIFIER  NOT NULL,
    quantity    DECIMAL(18,4)     NOT NULL DEFAULT 1,
    po_number   NVARCHAR(100)     NULL,
    created_by  UNIQUEIDENTIFIER  NULL,
    created_at  DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_assembly_bom  FOREIGN KEY (bom_id) REFERENCES boms(id),
    CONSTRAINT FK_assembly_user FOREIGN KEY (created_by) REFERENCES users(id)
);
GO
CREATE INDEX IX_assembly_bom  ON assemblies(bom_id);
CREATE INDEX IX_assembly_user ON assemblies(created_by);
GO

-- ─── ASSEMBLY UNITS ──────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'assembly_units')
CREATE TABLE assembly_units (
    id            UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    assembly_id   UNIQUEIDENTIFIER  NOT NULL,
    serial_number NVARCHAR(100)     NULL,
    unit_cost     DECIMAL(18,4)     NULL DEFAULT 0,
    created_at    DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_aunit_assembly FOREIGN KEY (assembly_id) REFERENCES assemblies(id) ON DELETE CASCADE
);
GO
CREATE INDEX IX_aunit_assembly ON assembly_units(assembly_id);
GO

-- ─── ASSEMBLY COMPONENTS ─────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'assembly_components')
CREATE TABLE assembly_components (
    id                UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    assembly_id       UNIQUEIDENTIFIER  NOT NULL,
    inventory_item_id UNIQUEIDENTIFIER  NOT NULL,
    purchase_item_id  UNIQUEIDENTIFIER  NULL,
    quantity_used     DECIMAL(18,4)     NOT NULL DEFAULT 1,
    serial_number     NVARCHAR(100)     NULL,
    created_at        DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_acomp_assembly FOREIGN KEY (assembly_id) REFERENCES assemblies(id) ON DELETE CASCADE,
    CONSTRAINT FK_acomp_item     FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
);
GO
CREATE INDEX IX_acomp_assembly ON assembly_components(assembly_id);
CREATE INDEX IX_acomp_item     ON assembly_components(inventory_item_id);
GO

-- ─── PURCHASES ───────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'purchases')
CREATE TABLE purchases (
    id           UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    vendor_id    UNIQUEIDENTIFIER  NOT NULL,
    po_reference NVARCHAR(100)     NULL,
    status       NVARCHAR(50)      NOT NULL DEFAULT 'pending',
    notes        NVARCHAR(MAX)     NULL,
    total_amount DECIMAL(18,4)     NULL DEFAULT 0,
    created_by   UNIQUEIDENTIFIER  NULL,
    created_at   DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at   DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_purchase_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
    CONSTRAINT FK_purchase_user   FOREIGN KEY (created_by) REFERENCES users(id)
);
GO
CREATE INDEX IX_purchase_vendor ON purchases(vendor_id);
GO

-- ─── PURCHASE ITEMS ──────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'purchase_items')
CREATE TABLE purchase_items (
    id                  UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    purchase_id         UNIQUEIDENTIFIER  NOT NULL,
    inventory_item_id   UNIQUEIDENTIFIER  NOT NULL,
    quantity_ordered    DECIMAL(18,4)     NOT NULL DEFAULT 0,
    quantity_received   DECIMAL(18,4)     NOT NULL DEFAULT 0,
    remaining_quantity  DECIMAL(18,4)     NOT NULL DEFAULT 0,
    unit_cost           DECIMAL(18,4)     NULL DEFAULT 0,
    vendor_item_code    NVARCHAR(100)     NULL,
    lead_time_days      INT               NULL,
    created_at          DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_pi_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    CONSTRAINT FK_pi_item     FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
);
GO
CREATE INDEX IX_pi_purchase ON purchase_items(purchase_id);
CREATE INDEX IX_pi_item     ON purchase_items(inventory_item_id);
GO

-- ─── PURCHASE ORDERS ─────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'purchase_orders')
CREATE TABLE purchase_orders (
    id             UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    po_number      NVARCHAR(100)     NOT NULL UNIQUE,
    vendor_id      UNIQUEIDENTIFIER  NOT NULL,
    status         NVARCHAR(50)      NOT NULL DEFAULT 'draft',
    expected_date  DATE              NULL,
    notes          NVARCHAR(MAX)     NULL,
    total_amount   DECIMAL(18,4)     NULL DEFAULT 0,
    created_by     UNIQUEIDENTIFIER  NULL,
    created_at     DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at     DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_po_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
    CONSTRAINT FK_po_user   FOREIGN KEY (created_by) REFERENCES users(id)
);
GO
CREATE INDEX IX_po_vendor ON purchase_orders(vendor_id);
GO

-- ─── PURCHASE ORDER ITEMS ─────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'purchase_order_items')
CREATE TABLE purchase_order_items (
    id                UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    purchase_order_id UNIQUEIDENTIFIER  NOT NULL,
    inventory_item_id UNIQUEIDENTIFIER  NOT NULL,
    quantity          DECIMAL(18,4)     NOT NULL DEFAULT 0,
    unit_cost         DECIMAL(18,4)     NULL DEFAULT 0,
    created_at        DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_poi_po   FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    CONSTRAINT FK_poi_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
);
GO
CREATE INDEX IX_poi_po   ON purchase_order_items(purchase_order_id);
CREATE INDEX IX_poi_item ON purchase_order_items(inventory_item_id);
GO

-- ─── CUSTOMERS ───────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'customers')
CREATE TABLE customers (
    id                UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    customer_company  NVARCHAR(255)     NOT NULL,
    contact_name      NVARCHAR(255)     NULL,
    email             NVARCHAR(255)     NULL,
    phone             NVARCHAR(50)      NULL,
    address           NVARCHAR(1000)    NULL,
    notes             NVARCHAR(MAX)     NULL,
    created_at        DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at        DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- ─── ADD FK: USERS -> CUSTOMERS ──────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_NAME = 'FK_users_customer'
)
ALTER TABLE users
    ADD CONSTRAINT FK_users_customer FOREIGN KEY (customer_id) REFERENCES customers(id);
GO
CREATE INDEX IX_users_customer ON users(customer_id);
GO

-- ─── DROPDOWN TYPES & VALUES ──────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'dropdown_types')
CREATE TABLE dropdown_types (
    id         UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    name       NVARCHAR(100)     NOT NULL UNIQUE,
    created_at DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'dropdown_values')
CREATE TABLE dropdown_values (
    id              UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    dropdown_type_id UNIQUEIDENTIFIER NOT NULL,
    value           NVARCHAR(255)     NOT NULL,
    sort_order      INT               NOT NULL DEFAULT 0,
    created_at      DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_dv_type FOREIGN KEY (dropdown_type_id) REFERENCES dropdown_types(id) ON DELETE CASCADE
);
GO
CREATE INDEX IX_dv_type ON dropdown_values(dropdown_type_id);
GO

-- ─── LEADS ───────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'leads')
CREATE TABLE leads (
    id             UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    company_name   NVARCHAR(255)     NOT NULL,
    contact_name   NVARCHAR(255)     NULL,
    email          NVARCHAR(255)     NULL,
    phone          NVARCHAR(50)      NULL,
    source         NVARCHAR(100)     NULL,
    status         NVARCHAR(100)     NOT NULL DEFAULT 'New',
    industry       NVARCHAR(100)     NULL,
    notes          NVARCHAR(MAX)     NULL,
    assigned_to    UNIQUEIDENTIFIER  NULL,
    created_at     DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at     DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_lead_user FOREIGN KEY (assigned_to) REFERENCES users(id)
);
GO
CREATE INDEX IX_lead_user ON leads(assigned_to);
GO

-- ─── PROSPECTS ───────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'prospects')
CREATE TABLE prospects (
    id             UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    company_name   NVARCHAR(255)     NOT NULL,
    contact_name   NVARCHAR(255)     NULL,
    email          NVARCHAR(255)     NULL,
    phone          NVARCHAR(50)      NULL,
    status         NVARCHAR(100)     NOT NULL DEFAULT 'Active',
    notes          NVARCHAR(MAX)     NULL,
    lead_id        UNIQUEIDENTIFIER  NULL,
    assigned_to    UNIQUEIDENTIFIER  NULL,
    created_at     DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at     DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_prospect_lead FOREIGN KEY (lead_id) REFERENCES leads(id),
    CONSTRAINT FK_prospect_user FOREIGN KEY (assigned_to) REFERENCES users(id)
);
GO
CREATE INDEX IX_prospect_lead ON prospects(lead_id);
CREATE INDEX IX_prospect_user ON prospects(assigned_to);
GO

-- ─── SALES ───────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'sales')
CREATE TABLE sales (
    id            UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    customer_id   UNIQUEIDENTIFIER  NOT NULL,
    order_number  NVARCHAR(100)     NULL UNIQUE,
    status        NVARCHAR(50)      NOT NULL DEFAULT 'pending',
    total_amount  DECIMAL(18,4)     NULL DEFAULT 0,
    discount      DECIMAL(18,4)     NULL DEFAULT 0,
    tax           DECIMAL(18,4)     NULL DEFAULT 0,
    notes         NVARCHAR(MAX)     NULL,
    created_by    UNIQUEIDENTIFIER  NULL,
    created_at    DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at    DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_sale_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT FK_sale_user     FOREIGN KEY (created_by) REFERENCES users(id)
);
GO
CREATE INDEX IX_sale_customer ON sales(customer_id);
GO

-- ─── SALE ITEMS ──────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'sale_items')
CREATE TABLE sale_items (
    id                  UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    sale_id             UNIQUEIDENTIFIER  NOT NULL,
    inventory_item_id   UNIQUEIDENTIFIER  NOT NULL,
    assembly_unit_id    UNIQUEIDENTIFIER  NULL,
    quantity            DECIMAL(18,4)     NOT NULL DEFAULT 1,
    unit_price          DECIMAL(18,4)     NULL DEFAULT 0,
    created_at          DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_si_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    CONSTRAINT FK_si_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
);
GO
CREATE INDEX IX_si_sale ON sale_items(sale_id);
CREATE INDEX IX_si_item ON sale_items(inventory_item_id);
GO

-- ─── DELIVERIES ──────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'deliveries')
CREATE TABLE deliveries (
    id              UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    sale_id         UNIQUEIDENTIFIER  NOT NULL,
    status          NVARCHAR(50)      NOT NULL DEFAULT 'pending',
    delivery_date   DATE              NULL,
    tracking_number NVARCHAR(100)     NULL,
    notes           NVARCHAR(MAX)     NULL,
    created_by      UNIQUEIDENTIFIER  NULL,
    created_at      DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_delivery_sale FOREIGN KEY (sale_id) REFERENCES sales(id),
    CONSTRAINT FK_delivery_user FOREIGN KEY (created_by) REFERENCES users(id)
);
GO
CREATE INDEX IX_delivery_sale ON deliveries(sale_id);
GO

-- ─── DELIVERY ITEMS ──────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'delivery_items')
CREATE TABLE delivery_items (
    id                UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    delivery_id       UNIQUEIDENTIFIER  NOT NULL,
    sale_item_id      UNIQUEIDENTIFIER  NOT NULL,
    quantity_delivered DECIMAL(18,4)    NOT NULL DEFAULT 0,
    created_at        DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_di_delivery  FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
    CONSTRAINT FK_di_sale_item FOREIGN KEY (sale_item_id) REFERENCES sale_items(id)
);
GO
CREATE INDEX IX_di_delivery  ON delivery_items(delivery_id);
CREATE INDEX IX_di_sale_item ON delivery_items(sale_item_id);
GO

-- ─── DEVICES ─────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'devices')
CREATE TABLE devices (
    id               UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    name             NVARCHAR(255)     NOT NULL,
    serial_number    NVARCHAR(100)     NULL UNIQUE,
    model            NVARCHAR(255)     NULL,
    customer_id      UNIQUEIDENTIFIER  NULL,
    status           NVARCHAR(50)      NOT NULL DEFAULT 'online',
    last_seen        DATETIME2         NULL,
    uptime_seconds   BIGINT            NULL DEFAULT 0,
    notes            NVARCHAR(MAX)     NULL,
    created_at       DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at       DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_device_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
);
GO
CREATE INDEX IX_device_customer ON devices(customer_id);
GO

-- ─── DEVICE ISSUE TYPES ──────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'device_issue_types')
CREATE TABLE device_issue_types (
    id         UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    name       NVARCHAR(255)     NOT NULL UNIQUE,
    created_at DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- ─── TICKETS ─────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'tickets')
CREATE TABLE tickets (
    id             UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    title          NVARCHAR(500)     NOT NULL,
    description    NVARCHAR(MAX)     NULL,
    status         NVARCHAR(50)      NOT NULL DEFAULT 'open',
    priority       NVARCHAR(50)      NOT NULL DEFAULT 'medium',
    device_id      UNIQUEIDENTIFIER  NULL,
    customer_id    UNIQUEIDENTIFIER  NULL,
    created_by     UNIQUEIDENTIFIER  NULL,
    assigned_to    UNIQUEIDENTIFIER  NULL,
    issue_type_id  UNIQUEIDENTIFIER  NULL,
    closed_at      DATETIME2         NULL,
    created_at     DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at     DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ticket_device       FOREIGN KEY (device_id) REFERENCES devices(id),
    CONSTRAINT FK_ticket_customer     FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT FK_ticket_created_by   FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT FK_ticket_assigned_to  FOREIGN KEY (assigned_to) REFERENCES users(id),
    CONSTRAINT FK_ticket_issue_type   FOREIGN KEY (issue_type_id) REFERENCES device_issue_types(id)
);
GO
CREATE INDEX IX_ticket_device   ON tickets(device_id);
CREATE INDEX IX_ticket_customer ON tickets(customer_id);
GO

-- ─── TICKET MESSAGES ─────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ticket_messages')
CREATE TABLE ticket_messages (
    id         UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    ticket_id  UNIQUEIDENTIFIER  NOT NULL,
    user_id    UNIQUEIDENTIFIER  NOT NULL,
    content    NVARCHAR(MAX)     NOT NULL,
    created_at DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_tm_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    CONSTRAINT FK_tm_user   FOREIGN KEY (user_id) REFERENCES users(id)
);
GO
CREATE INDEX IX_tm_ticket ON ticket_messages(ticket_id);
GO

-- ─── TICKET MESSAGE READS ────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ticket_message_reads')
CREATE TABLE ticket_message_reads (
    id         UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    message_id UNIQUEIDENTIFIER  NOT NULL,
    user_id    UNIQUEIDENTIFIER  NOT NULL,
    read_at    DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_tmr_message FOREIGN KEY (message_id) REFERENCES ticket_messages(id) ON DELETE CASCADE,
    CONSTRAINT FK_tmr_user    FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT UQ_tmr UNIQUE (message_id, user_id)
);
GO

-- ─── MESSAGES ────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'messages')
CREATE TABLE messages (
    id           UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    sender_id    UNIQUEIDENTIFIER  NOT NULL,
    recipient_id UNIQUEIDENTIFIER  NOT NULL,
    content      NVARCHAR(MAX)     NOT NULL,
    media_url    NVARCHAR(1000)    NULL,
    created_at   DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_msg_sender    FOREIGN KEY (sender_id) REFERENCES users(id),
    CONSTRAINT FK_msg_recipient FOREIGN KEY (recipient_id) REFERENCES users(id)
);
GO
CREATE INDEX IX_msg_sender    ON messages(sender_id);
CREATE INDEX IX_msg_recipient ON messages(recipient_id);
GO

-- ─── MESSAGE READS ───────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'message_reads')
CREATE TABLE message_reads (
    id         UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    message_id UNIQUEIDENTIFIER  NOT NULL,
    user_id    UNIQUEIDENTIFIER  NOT NULL,
    read_at    DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_mr_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    CONSTRAINT FK_mr_user    FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT UQ_mr UNIQUE (message_id, user_id)
);
GO

-- ─── ACTIVITY LOGS ───────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'activity_logs')
CREATE TABLE activity_logs (
    id         UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    user_id    UNIQUEIDENTIFIER  NULL,
    action     NVARCHAR(255)     NOT NULL,
    details    NVARCHAR(MAX)     NULL,
    created_at DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_log_user FOREIGN KEY (user_id) REFERENCES users(id)
);
GO
CREATE INDEX IX_log_user   ON activity_logs(user_id);
CREATE INDEX IX_log_action ON activity_logs(action);
GO

-- ─── HELP CATEGORIES ─────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'help_categories')
CREATE TABLE help_categories (
    id          UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    name        NVARCHAR(255)     NOT NULL,
    description NVARCHAR(MAX)     NULL,
    icon        NVARCHAR(50)      NULL,
    sort_order  INT               NOT NULL DEFAULT 0,
    created_at  DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- ─── HELP ARTICLES ───────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'help_articles')
CREATE TABLE help_articles (
    id          UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    category_id UNIQUEIDENTIFIER  NOT NULL,
    title       NVARCHAR(500)     NOT NULL,
    content     NVARCHAR(MAX)     NOT NULL,
    tags        NVARCHAR(MAX)     NULL,
    sort_order  INT               NOT NULL DEFAULT 0,
    created_at  DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at  DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_article_category FOREIGN KEY (category_id) REFERENCES help_categories(id) ON DELETE CASCADE
);
GO
CREATE INDEX IX_article_category ON help_articles(category_id);
GO

-- ─── SYSTEM REQUESTS ─────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'system_requests')
CREATE TABLE system_requests (
    id          UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    user_id     UNIQUEIDENTIFIER  NOT NULL,
    title       NVARCHAR(500)     NOT NULL,
    description NVARCHAR(MAX)     NULL,
    status      NVARCHAR(50)      NOT NULL DEFAULT 'pending',
    priority    NVARCHAR(50)      NOT NULL DEFAULT 'medium',
    admin_notes NVARCHAR(MAX)     NULL,
    created_at  DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at  DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_sr_user FOREIGN KEY (user_id) REFERENCES users(id)
);
GO
CREATE INDEX IX_sr_user ON system_requests(user_id);
GO

-- ─── FOREIGN EXCHANGE RATES ──────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'foreign_exchange_rates')
CREATE TABLE foreign_exchange_rates (
    id            UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    currency_code NVARCHAR(10)      NOT NULL UNIQUE,
    currency_name NVARCHAR(100)     NOT NULL,
    inr_per_unit  DECIMAL(18,4)     NOT NULL DEFAULT 0,
    updated_by    UNIQUEIDENTIFIER  NULL,
    updated_at    DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_fx_user FOREIGN KEY (updated_by) REFERENCES users(id)
);
GO

-- ─── ASSEMBLY FILES ──────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'assembly_files')
CREATE TABLE assembly_files (
    id           UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    assembly_id  UNIQUEIDENTIFIER  NOT NULL,
    file_name    NVARCHAR(500)     NOT NULL,
    file_url     NVARCHAR(1000)    NOT NULL,
    file_size    BIGINT            NULL,
    file_type    NVARCHAR(100)     NULL,
    uploaded_by  UNIQUEIDENTIFIER  NULL,
    created_at   DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_af_assembly FOREIGN KEY (assembly_id) REFERENCES assemblies(id) ON DELETE CASCADE,
    CONSTRAINT FK_af_user     FOREIGN KEY (uploaded_by) REFERENCES users(id)
);
GO
CREATE INDEX IX_af_assembly ON assembly_files(assembly_id);
GO

PRINT 'Migration 001 completed successfully — all tables created.';
GO
