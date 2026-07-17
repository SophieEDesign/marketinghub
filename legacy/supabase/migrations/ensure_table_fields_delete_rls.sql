-- Migration: Ensure table_fields DELETE RLS policy exists
-- This migration ensures that authenticated users can delete table_fields
-- even if the policy was dropped or never created

-- Enable RLS if not already enabled
ALTER TABLE IF EXISTS public.table_fields ENABLE ROW LEVEL SECURITY;

-- Ensure DELETE policy exists for authenticated users
DROP POLICY IF EXISTS "Allow authenticated users to delete table_fields" ON public.table_fields;
CREATE POLICY "Allow authenticated users to delete table_fields"
  ON public.table_fields
  FOR DELETE
  TO authenticated
  USING (true);

-- Grant DELETE privilege if not already granted
GRANT DELETE ON TABLE public.table_fields TO authenticated;
