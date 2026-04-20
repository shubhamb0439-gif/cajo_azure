/*
  # Add Activity Logging for System Requests

  1. New Functions
    - `log_system_request_created()` - Logs when a new bug report or feature request is created
    - `log_system_request_status_changed()` - Logs when an admin updates a request status

  2. Changes
    - Create triggers on system_requests table to automatically log activities
    - Logs include request type, location, and status information

  3. Activity Log Actions
    - "Bug Report Created" - When a user creates a bug report
    - "Feature Request Created" - When a user creates a feature request
    - "Request Status Updated" - When an admin changes a request status
*/

-- Function to log when a system request is created
CREATE OR REPLACE FUNCTION public.log_system_request_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.activity_logs (user_id, action, details)
  VALUES (
    NEW.created_by,
    CASE
      WHEN NEW.type = 'bug' THEN 'Bug Report Created'
      WHEN NEW.type = 'feature' THEN 'Feature Request Created'
      ELSE 'System Request Created'
    END,
    jsonb_build_object(
      'request_id', NEW.id,
      'type', NEW.type,
      'location', NEW.location,
      'status', NEW.status,
      'description_preview', substring(NEW.description, 1, 100)
    )
  );
  RETURN NEW;
END;
$$;

-- Function to log when request status is updated
CREATE OR REPLACE FUNCTION public.log_system_request_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_logs (user_id, action, details)
    VALUES (
      NEW.status_changed_by,
      'Request Status Updated',
      jsonb_build_object(
        'request_id', NEW.id,
        'type', NEW.type,
        'location', NEW.location,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'description_preview', substring(NEW.description, 1, 100)
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for new requests
DROP TRIGGER IF EXISTS log_system_request_created_trigger ON public.system_requests;
CREATE TRIGGER log_system_request_created_trigger
  AFTER INSERT ON public.system_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.log_system_request_created();

-- Create trigger for status updates
DROP TRIGGER IF EXISTS log_system_request_status_changed_trigger ON public.system_requests;
CREATE TRIGGER log_system_request_status_changed_trigger
  AFTER UPDATE ON public.system_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.log_system_request_status_changed();