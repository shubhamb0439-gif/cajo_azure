/*
  # Add Device Issue Types for Client Portal

  1. Changes
    - Update dropdown_values constraint to allow 'device_issue_type'
    - Add dropdown values for device issue types that clients can select when reporting device problems
    - These will be used in the CLIENT PORTAL when users scan QR codes to report issues
  
  2. Issue Types Added
    - Hardware Failure
    - Software Error
    - Network Connectivity
    - Performance Issue
    - Power Issue
    - Physical Damage
    - Calibration Needed
    - Routine Maintenance
    - Other
*/

ALTER TABLE dropdown_values DROP CONSTRAINT IF EXISTS dropdown_values_drop_type_check;

ALTER TABLE dropdown_values ADD CONSTRAINT dropdown_values_drop_type_check 
CHECK (drop_type = ANY (ARRAY[
  'vendor_group'::text, 
  'vendor_currency'::text, 
  'item_group'::text, 
  'item_class'::text, 
  'lead_status'::text, 
  'lead_source'::text, 
  'prospect_status'::text, 
  'customer_status'::text,
  'device_issue_type'::text
]));

INSERT INTO dropdown_values (drop_type, drop_value, created_by, created_at) 
SELECT 
  'device_issue_type',
  issue_type,
  (SELECT id FROM users WHERE role = 'admin' LIMIT 1),
  NOW()
FROM (
  VALUES 
    ('Hardware Failure'),
    ('Software Error'),
    ('Network Connectivity'),
    ('Performance Issue'),
    ('Power Issue'),
    ('Physical Damage'),
    ('Calibration Needed'),
    ('Routine Maintenance'),
    ('Other')
) AS issue_types(issue_type)
WHERE NOT EXISTS (
  SELECT 1 FROM dropdown_values 
  WHERE drop_type = 'device_issue_type'
);
