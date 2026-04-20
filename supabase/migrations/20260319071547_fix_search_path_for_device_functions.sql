/*
  # Fix Search Path for Device-Related Functions

  ## Overview
  Sets explicit search_path for database functions to prevent search path hijacking attacks.

  ## Changes
  1. Security Enhancements
    - Set search_path for `auto_create_offline_ticket()` function
    - Set search_path for `update_device_uptime()` function
    - Both functions now explicitly use `public, pg_catalog` schema resolution

  ## Why This Matters
  Without an explicit search_path, functions are vulnerable to search path hijacking where:
  - Malicious users could create shadow tables/functions in other schemas
  - Functions might accidentally reference malicious versions instead of real tables
  - Could lead to data theft, manipulation, or privilege escalation

  ## Impact
  - No functional changes to existing behavior
  - Functions will continue to work exactly as before
  - Only adds additional security protection
  - Completely backwards compatible

  ## Security
  - Prevents search path manipulation attacks
  - Ensures functions only look in trusted schemas (public, pg_catalog)
*/

-- Set search_path for auto_create_offline_ticket function
ALTER FUNCTION public.auto_create_offline_ticket() 
  SET search_path = public, pg_catalog;

-- Set search_path for update_device_uptime function
ALTER FUNCTION public.update_device_uptime() 
  SET search_path = public, pg_catalog;
