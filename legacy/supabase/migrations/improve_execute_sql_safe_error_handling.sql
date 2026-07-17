-- Migration: Improve execute_sql_safe error handling
-- This adds better error messages for missing tables

-- Drop and recreate execute_sql_safe with better error messages
DROP FUNCTION IF EXISTS public.execute_sql_safe(text);

CREATE OR REPLACE FUNCTION public.execute_sql_safe(sql_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  error_message text;
  error_code text;
  table_name_match text;
BEGIN
  BEGIN
    EXECUTE sql_text;
  EXCEPTION WHEN OTHERS THEN
    -- Capture error details
    GET STACKED DIAGNOSTICS
      error_message = MESSAGE_TEXT,
      error_code = RETURNED_SQLSTATE;
    
    -- Check if it's a "relation does not exist" error (42P01)
    IF error_code = '42P01' THEN
      -- Try to extract table name from error message (format: relation "public.table_name" does not exist)
      table_name_match := substring(error_message from 'relation "([^"]+)"');
      
      -- Raise a more helpful error
      RAISE EXCEPTION 'Table not found: %. The table does not exist in the database. Please verify the table name in Settings or create the table first. Original error: %', 
        COALESCE(table_name_match, 'unknown'), 
        error_message
        USING ERRCODE = '42P01';
    ELSE
      -- Re-raise other errors as-is
      RAISE;
    END IF;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_sql_safe(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_sql_safe(text) TO anon;

