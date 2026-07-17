-- Migration: Create function to dynamically create tables
-- This function allows the application to create Supabase tables on demand

CREATE OR REPLACE FUNCTION create_dynamic_table(table_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create the table with standard columns
  -- Additional columns will be added automatically by Supabase when data is inserted
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
  ', table_name);
  
  -- Enable Row Level Security (optional, adjust as needed)
  -- EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', table_name);
  
  -- Grant permissions (adjust as needed for your RLS policies)
  -- EXECUTE format('GRANT ALL ON %I TO authenticated;', table_name);
  -- EXECUTE format('GRANT ALL ON %I TO anon;', table_name);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_dynamic_table(text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_dynamic_table(text) TO anon;

-- Optional: Create a function to add columns dynamically
CREATE OR REPLACE FUNCTION add_column_to_table(
  table_name text,
  column_name text,
  column_type text DEFAULT 'text'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS %I %s;', 
    table_name, column_name, column_type);
END;
$$;

GRANT EXECUTE ON FUNCTION add_column_to_table(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION add_column_to_table(text, text, text) TO anon;

-- Enhanced function to create table with columns
CREATE OR REPLACE FUNCTION create_table_with_columns(
  table_name text,
  columns jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  col jsonb;
  col_def text;
  col_defs text := '';
BEGIN
  -- Create base table
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
  ', table_name);
  
  -- Add columns
  FOR col IN SELECT * FROM jsonb_array_elements(columns)
  LOOP
    col_def := format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS %I %s;',
      table_name,
      col->>'name',
      col->>'type'
    );
    EXECUTE col_def;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION create_table_with_columns(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION create_table_with_columns(text, jsonb) TO anon;
