/*
  ============================================================
  AZURE SQL MIGRATION 002 — Seed Initial Data
  ============================================================
  Seeds essential reference data required for the application
  to function correctly on first run.

  Includes:
  - EUR exchange rate
  - Default dropdown types and values (lead sources, statuses,
    industries, priorities)
  - Default device issue types
  - Default help categories (articles should be seeded
    separately or via the admin UI)
  ============================================================
*/

-- ─── FOREIGN EXCHANGE RATES ──────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM foreign_exchange_rates WHERE currency_code = 'EUR')
INSERT INTO foreign_exchange_rates (currency_code, currency_name, inr_per_unit)
VALUES ('EUR', 'Euro', 106.00);
GO

-- ─── DROPDOWN TYPES ──────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dropdown_types WHERE name = 'lead_source')
INSERT INTO dropdown_types (name) VALUES ('lead_source');

IF NOT EXISTS (SELECT 1 FROM dropdown_types WHERE name = 'lead_status')
INSERT INTO dropdown_types (name) VALUES ('lead_status');

IF NOT EXISTS (SELECT 1 FROM dropdown_types WHERE name = 'lead_industry')
INSERT INTO dropdown_types (name) VALUES ('lead_industry');

IF NOT EXISTS (SELECT 1 FROM dropdown_types WHERE name = 'lead_priority')
INSERT INTO dropdown_types (name) VALUES ('lead_priority');
GO

-- ─── LEAD SOURCE VALUES ───────────────────────────────────────────────────────
DECLARE @lead_source_id UNIQUEIDENTIFIER;
SELECT @lead_source_id = id FROM dropdown_types WHERE name = 'lead_source';

IF @lead_source_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dropdown_values WHERE dropdown_type_id = @lead_source_id)
BEGIN
    INSERT INTO dropdown_values (dropdown_type_id, value, sort_order) VALUES
    (@lead_source_id, 'Website',        1),
    (@lead_source_id, 'Referral',       2),
    (@lead_source_id, 'Cold Call',      3),
    (@lead_source_id, 'Trade Show',     4),
    (@lead_source_id, 'Social Media',   5),
    (@lead_source_id, 'Email Campaign', 6),
    (@lead_source_id, 'Other',          7);
END
GO

-- ─── LEAD STATUS VALUES ───────────────────────────────────────────────────────
DECLARE @lead_status_id UNIQUEIDENTIFIER;
SELECT @lead_status_id = id FROM dropdown_types WHERE name = 'lead_status';

IF @lead_status_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dropdown_values WHERE dropdown_type_id = @lead_status_id)
BEGIN
    INSERT INTO dropdown_values (dropdown_type_id, value, sort_order) VALUES
    (@lead_status_id, 'New',         1),
    (@lead_status_id, 'Contacted',   2),
    (@lead_status_id, 'Qualified',   3),
    (@lead_status_id, 'Proposal',    4),
    (@lead_status_id, 'Negotiation', 5),
    (@lead_status_id, 'Won',         6),
    (@lead_status_id, 'Lost',        7);
END
GO

-- ─── LEAD INDUSTRY VALUES ────────────────────────────────────────────────────
DECLARE @lead_industry_id UNIQUEIDENTIFIER;
SELECT @lead_industry_id = id FROM dropdown_types WHERE name = 'lead_industry';

IF @lead_industry_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dropdown_values WHERE dropdown_type_id = @lead_industry_id)
BEGIN
    INSERT INTO dropdown_values (dropdown_type_id, value, sort_order) VALUES
    (@lead_industry_id, 'Technology',      1),
    (@lead_industry_id, 'Manufacturing',   2),
    (@lead_industry_id, 'Healthcare',      3),
    (@lead_industry_id, 'Finance',         4),
    (@lead_industry_id, 'Retail',          5),
    (@lead_industry_id, 'Education',       6),
    (@lead_industry_id, 'Construction',    7),
    (@lead_industry_id, 'Agriculture',     8),
    (@lead_industry_id, 'Transportation',  9),
    (@lead_industry_id, 'Other',          10);
END
GO

-- ─── LEAD PRIORITY VALUES ────────────────────────────────────────────────────
DECLARE @lead_priority_id UNIQUEIDENTIFIER;
SELECT @lead_priority_id = id FROM dropdown_types WHERE name = 'lead_priority';

IF @lead_priority_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dropdown_values WHERE dropdown_type_id = @lead_priority_id)
BEGIN
    INSERT INTO dropdown_values (dropdown_type_id, value, sort_order) VALUES
    (@lead_priority_id, 'Low',      1),
    (@lead_priority_id, 'Medium',   2),
    (@lead_priority_id, 'High',     3),
    (@lead_priority_id, 'Critical', 4);
END
GO

-- ─── DEVICE ISSUE TYPES ──────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM device_issue_types)
INSERT INTO device_issue_types (name) VALUES
    ('Hardware Failure'),
    ('Software Bug'),
    ('Connectivity Issue'),
    ('Performance Degradation'),
    ('Power Issue'),
    ('Sensor Malfunction'),
    ('Configuration Error'),
    ('Firmware Update Required'),
    ('Physical Damage'),
    ('Other');
GO

-- ─── HELP CATEGORIES ─────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM help_categories)
INSERT INTO help_categories (name, description, icon, sort_order) VALUES
    ('Getting Started',    'Learn the basics of the Cajo ERP system',              'BookOpen',     1),
    ('Inventory',          'Managing inventory items and stock levels',             'Package',      2),
    ('Purchases',          'Creating and managing purchase orders and receipts',    'ShoppingCart', 3),
    ('Sales & Deliveries', 'Processing sales orders and managing deliveries',       'TrendingUp',   4),
    ('Manufacturing',      'BOM management and assembly operations',                'Wrench',       5),
    ('Customers & Leads',  'Managing customers, leads, and prospects',              'Users',        6),
    ('Support & Devices',  'Device management and support ticket workflows',        'Headphones',   7),
    ('Settings & Admin',   'User management, system settings, and administration',  'Settings',     8);
GO

PRINT 'Migration 002 completed successfully — initial data seeded.';
GO
