/*
  # Create System Requests Table

  1. New Tables
    - `system_requests`
      - `id` (uuid, primary key)
      - `type` (text) - "bug" or "feature"
      - `location` (text) - where in the system
      - `description` (text) - detailed description
      - `status` (text) - workflow status
      - `created_by` (uuid, references users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `status_changed_at` (timestamptz) - tracks when status was last changed
      - `status_changed_by` (uuid, references users) - who changed the status

  2. Security
    - Enable RLS on `system_requests` table
    - Authenticated users can insert their own requests
    - All authenticated users can view all requests
    - Only admins can update request status
    - Only admins can delete requests

  3. Indexes
    - created_by for filtering by user
    - status for filtering by status
    - type for filtering by type
    - created_at for sorting
*/

-- Create system_requests table
CREATE TABLE IF NOT EXISTS public.system_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('bug', 'feature')),
  location text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Received', 'Under Review', 'Rejected', 'Accepted', 'Under Development', 'Deployed')),
  created_by uuid REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  status_changed_at timestamptz DEFAULT now(),
  status_changed_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_system_requests_created_by ON public.system_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_system_requests_status ON public.system_requests(status);
CREATE INDEX IF NOT EXISTS idx_system_requests_type ON public.system_requests(type);
CREATE INDEX IF NOT EXISTS idx_system_requests_created_at ON public.system_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_requests_status_changed_by ON public.system_requests(status_changed_by);

-- Enable RLS
ALTER TABLE public.system_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can insert requests"
  ON public.system_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
  );

CREATE POLICY "Authenticated users can view all requests"
  ON public.system_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid())
    )
  );

CREATE POLICY "Admins can update requests"
  ON public.system_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid()) AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid()) AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete requests"
  ON public.system_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = (select auth.uid()) AND role = 'admin'
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_system_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  
  -- Update status_changed_at if status has changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS set_system_requests_updated_at ON public.system_requests;
CREATE TRIGGER set_system_requests_updated_at
  BEFORE UPDATE ON public.system_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_system_requests_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_requests;