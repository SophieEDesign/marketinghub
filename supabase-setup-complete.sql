-- ============================================
-- COMPLETE SETUP FOR DYNAMIC TABLES
-- Run this in Supabase SQL Editor to enable automatic table creation
-- ============================================

-- Step 1: Create the update_updated_at_column function (if it doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create the create_dynamic_table function
CREATE OR REPLACE FUNCTION create_dynamic_table(
  table_name TEXT,
  table_label TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate table name (prevent SQL injection)
  IF NOT (table_name ~ '^[a-z0-9_]+$') THEN
    RAISE EXCEPTION 'Invalid table name: %', table_name;
  END IF;

  -- Create the table with standard columns
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  ', table_name);

  -- Create index on created_at
  EXECUTE format('
    CREATE INDEX IF NOT EXISTS idx_%I_created_at ON %I(created_at);
  ', table_name, table_name);

  -- Enable RLS
  EXECUTE format('
    ALTER TABLE %I ENABLE ROW LEVEL SECURITY;
  ', table_name);

  -- Create RLS policies
  EXECUTE format('
    DROP POLICY IF EXISTS "Users can view all %I" ON %I;
    CREATE POLICY "Users can view all %I" ON %I FOR SELECT USING (true);
  ', table_name, table_name, table_name, table_name);

  EXECUTE format('
    DROP POLICY IF EXISTS "Users can create %I" ON %I;
    CREATE POLICY "Users can create %I" ON %I FOR INSERT WITH CHECK (true);
  ', table_name, table_name, table_name, table_name);

  EXECUTE format('
    DROP POLICY IF EXISTS "Users can update %I" ON %I;
    CREATE POLICY "Users can update %I" ON %I FOR UPDATE USING (true);
  ', table_name, table_name, table_name, table_name);

  EXECUTE format('
    DROP POLICY IF EXISTS "Users can delete %I" ON %I;
    CREATE POLICY "Users can delete %I" ON %I FOR DELETE USING (true);
  ', table_name, table_name, table_name, table_name);

  -- Create trigger for updated_at
  EXECUTE format('
    DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
    CREATE TRIGGER update_%I_updated_at
      BEFORE UPDATE ON %I
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  ', table_name, table_name, table_name, table_name, table_name);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_dynamic_table(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_dynamic_table(TEXT, TEXT) TO anon;

-- Step 3: Create the add_dynamic_table_column function
CREATE OR REPLACE FUNCTION add_dynamic_table_column(
  table_name TEXT,
  column_name TEXT,
  column_type TEXT,
  column_default TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate table and column names
  IF NOT (table_name ~ '^[a-z0-9_]+$') THEN
    RAISE EXCEPTION 'Invalid table name: %', table_name;
  END IF;
  
  IF NOT (column_name ~ '^[a-z0-9_]+$') THEN
    RAISE EXCEPTION 'Invalid column name: %', column_name;
  END IF;

  -- Map our field types to PostgreSQL types
  DECLARE
    pg_type TEXT;
  BEGIN
    CASE column_type
      WHEN 'text' THEN pg_type := 'TEXT';
      WHEN 'long_text' THEN pg_type := 'TEXT';
      WHEN 'number' THEN pg_type := 'NUMERIC';
      WHEN 'date' THEN pg_type := 'TIMESTAMPTZ';
      WHEN 'boolean' THEN pg_type := 'BOOLEAN';
      WHEN 'single_select' THEN pg_type := 'TEXT';
      WHEN 'multi_select' THEN pg_type := 'TEXT[]';
      WHEN 'url' THEN pg_type := 'TEXT';
      WHEN 'email' THEN pg_type := 'TEXT';
      WHEN 'phone' THEN pg_type := 'TEXT';
      WHEN 'attachment' THEN pg_type := 'TEXT';
      WHEN 'linked_record' THEN pg_type := 'UUID';
      ELSE pg_type := 'TEXT';
    END CASE;

    -- Add the column
    IF column_default IS NOT NULL THEN
      EXECUTE format('
        ALTER TABLE %I ADD COLUMN IF NOT EXISTS %I %s DEFAULT %s;
      ', table_name, column_name, pg_type, column_default);
    ELSE
      EXECUTE format('
        ALTER TABLE %I ADD COLUMN IF NOT EXISTS %I %s;
      ', table_name, column_name, pg_type);
    END IF;
  END;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION add_dynamic_table_column(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION add_dynamic_table_column(TEXT, TEXT, TEXT, TEXT) TO anon;

-- Step 4: Create the content table (if it doesn't exist)
SELECT create_dynamic_table('content', 'Content');

-- ============================================
-- DONE! Now tables will be created automatically when you add them through the UI
-- ============================================
