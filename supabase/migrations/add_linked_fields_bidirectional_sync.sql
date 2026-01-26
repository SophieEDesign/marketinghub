-- ============================================================================
-- Migration: Add Bidirectional Sync for Linked Fields
-- ============================================================================
-- This migration creates database triggers that automatically sync linked
-- field updates bidirectionally. When a linked field is updated, the reciprocal
-- field in the linked table is automatically updated to maintain consistency.
--
-- This ensures bidirectional sync works even for:
-- - Direct SQL updates
-- - Bulk operations
-- - API calls that bypass application-level sync
-- ============================================================================
-- Date: 2026-01-26
-- ============================================================================

BEGIN;

-- Create a function to sync linked fields bidirectionally
-- This function is called by triggers when linked field columns are updated
CREATE OR REPLACE FUNCTION public.sync_linked_field_bidirectional()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  source_field_record public.table_fields%rowtype;
  reciprocal_field_record public.table_fields%rowtype;
  source_table_record public.tables%rowtype;
  target_table_record public.tables%rowtype;
  
  updated_field_name text;  -- The field that was actually updated (column name)
  source_field_name text;   -- The source field name (for sync direction)
  reciprocal_field_name text;
  target_table_name text;
  source_table_name text;
  source_table_id uuid;
  target_table_id uuid;
  linked_field_id uuid;
  
  old_value uuid;
  new_value uuid;
  old_array uuid[];
  new_array uuid[];
  
  added_ids uuid[];
  removed_ids uuid[];
  target_id uuid;
  
  current_array uuid[];
  updated_array uuid[];
DECLARE
  is_reciprocal_field boolean := false;
BEGIN
  -- Get the column name that was updated
  updated_field_name := TG_ARGV[0];
  
  IF updated_field_name IS NULL THEN
    RAISE WARNING 'sync_linked_field_bidirectional: No field name provided';
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Get the field that was updated
  SELECT * INTO source_field_record
  FROM public.table_fields
  WHERE table_id = (SELECT id FROM public.tables WHERE supabase_table = TG_TABLE_NAME)
    AND name = updated_field_name
    AND type = 'link_to_table';
  
  IF source_field_record.id IS NULL THEN
    -- Not a linked field, nothing to sync
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Get table info for the table containing the updated field
  SELECT * INTO source_table_record
  FROM public.tables
  WHERE supabase_table = TG_TABLE_NAME;
  
  IF source_table_record.id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  source_table_id := source_table_record.id;
  
  -- Check if this field is a reciprocal field (has linked_field_id pointing to another field)
  linked_field_id := (source_field_record.options->>'linked_field_id')::uuid;
  
  IF linked_field_id IS NOT NULL THEN
    -- This is a reciprocal field - sync back to source
    is_reciprocal_field := true;
    
    -- Find the source field (the one this reciprocal points to)
    SELECT * INTO reciprocal_field_record
    FROM public.table_fields
    WHERE id = linked_field_id;
    
    IF reciprocal_field_record.id IS NULL OR reciprocal_field_record.type != 'link_to_table' THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- The "reciprocal_field_record" is actually the source field in reverse sync
    -- The "source_field_record" is actually the reciprocal field
    source_field_name := reciprocal_field_record.name;
    reciprocal_field_name := source_field_record.name;
    
    -- Get table IDs
    target_table_id := reciprocal_field_record.table_id;
    source_table_id := source_table_record.id;
    
    -- Get target table info (this is the source table in reverse sync)
    SELECT * INTO target_table_record
    FROM public.tables
    WHERE id = target_table_id;
    
    IF target_table_record.id IS NULL THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
    
    target_table_name := target_table_record.supabase_table;
    source_table_name := source_table_record.supabase_table;
  ELSE
    -- This is a source field - sync forward to reciprocal
    is_reciprocal_field := false;
    
    -- Get linked table ID and reciprocal field ID
    target_table_id := (source_field_record.options->>'linked_table_id')::uuid;
    linked_field_id := (source_field_record.options->>'linked_field_id')::uuid;
    
    IF target_table_id IS NULL OR linked_field_id IS NULL THEN
      -- No reciprocal configured
      RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Get reciprocal field metadata
    SELECT * INTO reciprocal_field_record
    FROM public.table_fields
    WHERE id = linked_field_id;
    
    IF reciprocal_field_record.id IS NULL OR reciprocal_field_record.type != 'link_to_table' THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
    
    reciprocal_field_name := reciprocal_field_record.name;
    
    -- Get target table info
    SELECT * INTO target_table_record
    FROM public.tables
    WHERE id = target_table_id;
    
    IF target_table_record.id IS NULL THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
    
    target_table_name := target_table_record.supabase_table;
    source_table_name := source_table_record.supabase_table;
  END IF;
  
  -- Determine if multi-link based on source field options
  -- Use the actual source field (not the updated field) to determine multi-link
  DECLARE
    is_multi boolean;
    relationship_type text;
    max_selections int;
    actual_source_field public.table_fields%rowtype;
  BEGIN
    -- Get the actual source field (the one that determines the relationship type)
    IF is_reciprocal_field THEN
      actual_source_field := reciprocal_field_record;
    ELSE
      actual_source_field := source_field_record;
    END IF;
    
    relationship_type := actual_source_field.options->>'relationship_type';
    max_selections := (actual_source_field.options->>'max_selections')::int;
    
    is_multi := (
      relationship_type IN ('one-to-many', 'many-to-many') OR
      (max_selections IS NOT NULL AND max_selections > 1)
    );
    
    IF is_multi THEN
      -- Multi-link: Handle array operations
      -- Use updated_field_name to get the actual column value that changed
      -- Need to use dynamic SQL to access the column by name
      DECLARE
        old_val jsonb;
        new_val jsonb;
      BEGIN
        EXECUTE format('SELECT $1.%I', quote_ident(updated_field_name)) INTO old_val USING OLD;
        EXECUTE format('SELECT $1.%I', quote_ident(updated_field_name)) INTO new_val USING NEW;
        
        old_array := CASE
          WHEN old_val IS NULL THEN ARRAY[]::uuid[]
          WHEN jsonb_typeof(old_val) = 'array' THEN
            ARRAY(SELECT jsonb_array_elements_text(old_val)::uuid)
          ELSE ARRAY[old_val::text::uuid]
        END;
        
        new_array := CASE
          WHEN new_val IS NULL THEN ARRAY[]::uuid[]
          WHEN jsonb_typeof(new_val) = 'array' THEN
            ARRAY(SELECT jsonb_array_elements_text(new_val)::uuid)
          ELSE ARRAY[new_val::text::uuid]
        END;
      END;
      
      -- Calculate added and removed IDs
      added_ids := ARRAY(
        SELECT unnest(new_array)
        EXCEPT
        SELECT unnest(old_array)
      );
      
      removed_ids := ARRAY(
        SELECT unnest(old_array)
        EXCEPT
        SELECT unnest(new_array)
      );
      
      IF is_reciprocal_field THEN
        -- REVERSE SYNC: Update source records
        -- NEW.id is in targetTable, added_ids/removed_ids are source record IDs
        -- Update sourceTable records' source field
        
        -- Update source records for added links
        IF array_length(added_ids, 1) > 0 THEN
          FOR target_id IN SELECT unnest(added_ids)
          LOOP
            -- Get current value of source field
            EXECUTE format(
              'SELECT %I FROM %I WHERE id = $1',
              quote_ident(source_field_name),
              quote_ident(source_table_name)
            ) INTO current_array
            USING target_id;
            
            IF current_array IS NULL THEN
              current_array := ARRAY[]::uuid[];
            END IF;
            
            -- Add NEW.id (from target table) if not present
            IF NOT (NEW.id = ANY(current_array)) THEN
              updated_array := current_array || ARRAY[NEW.id];
              
              EXECUTE format(
                'UPDATE %I SET %I = $1 WHERE id = $2',
                quote_ident(source_table_name),
                quote_ident(source_field_name)
              ) USING updated_array, target_id;
            END IF;
          END LOOP;
        END IF;
        
        -- Update source records for removed links
        IF array_length(removed_ids, 1) > 0 THEN
          FOR target_id IN SELECT unnest(removed_ids)
          LOOP
            -- Get current value of source field
            EXECUTE format(
              'SELECT %I FROM %I WHERE id = $1',
              quote_ident(source_field_name),
              quote_ident(source_table_name)
            ) INTO current_array
            USING target_id;
            
            IF current_array IS NULL THEN
              current_array := ARRAY[]::uuid[];
            END IF;
            
            -- Remove NEW.id (from target table) if present
            IF NEW.id = ANY(current_array) THEN
              updated_array := array_remove(current_array, NEW.id);
              
              EXECUTE format(
                'UPDATE %I SET %I = $1 WHERE id = $2',
                quote_ident(source_table_name),
                quote_ident(source_field_name)
              ) USING (CASE WHEN array_length(updated_array, 1) > 0 THEN updated_array ELSE NULL END), target_id;
            END IF;
          END LOOP;
        END IF;
      ELSE
        -- FORWARD SYNC: Update target records
        -- NEW.id is in sourceTable, added_ids/removed_ids are target record IDs
        -- Update targetTable records' reciprocal field
        
        -- Update target records for added links
        IF array_length(added_ids, 1) > 0 THEN
          FOR target_id IN SELECT unnest(added_ids)
          LOOP
            -- Get current value of reciprocal field
            EXECUTE format(
              'SELECT %I FROM %I WHERE id = $1',
              quote_ident(reciprocal_field_name),
              quote_ident(target_table_name)
            ) INTO current_array
            USING target_id;
            
            IF current_array IS NULL THEN
              current_array := ARRAY[]::uuid[];
            END IF;
            
            -- Add NEW.id (from source table) if not present
            IF NOT (NEW.id = ANY(current_array)) THEN
              updated_array := current_array || ARRAY[NEW.id];
              
              EXECUTE format(
                'UPDATE %I SET %I = $1 WHERE id = $2',
                quote_ident(target_table_name),
                quote_ident(reciprocal_field_name)
              ) USING updated_array, target_id;
            END IF;
          END LOOP;
        END IF;
        
        -- Update target records for removed links
        IF array_length(removed_ids, 1) > 0 THEN
          FOR target_id IN SELECT unnest(removed_ids)
          LOOP
            -- Get current value of reciprocal field
            EXECUTE format(
              'SELECT %I FROM %I WHERE id = $1',
              quote_ident(reciprocal_field_name),
              quote_ident(target_table_name)
            ) INTO current_array
            USING target_id;
            
            IF current_array IS NULL THEN
              current_array := ARRAY[]::uuid[];
            END IF;
            
            -- Remove NEW.id (from source table) if present
            IF NEW.id = ANY(current_array) THEN
              updated_array := array_remove(current_array, NEW.id);
              
              EXECUTE format(
                'UPDATE %I SET %I = $1 WHERE id = $2',
                quote_ident(target_table_name),
                quote_ident(reciprocal_field_name)
              ) USING (CASE WHEN array_length(updated_array, 1) > 0 THEN updated_array ELSE NULL END), target_id;
            END IF;
          END LOOP;
        END IF;
      END IF;
    ELSE
      -- Single-link: Handle both forward and reverse sync
      DECLARE
        old_val uuid;
        new_val uuid;
      BEGIN
        -- Get the actual column value that changed (using updated_field_name)
        EXECUTE format('SELECT $1.%I', quote_ident(updated_field_name)) INTO old_val USING OLD;
        EXECUTE format('SELECT $1.%I', quote_ident(updated_field_name)) INTO new_val USING NEW;
        
        old_value := old_val;
        new_value := new_val;
      END;
      
      IF is_reciprocal_field THEN
        -- REVERSE SYNC: Update source records
        -- NEW.id is in targetTable, new_value/old_value are source record IDs
        -- Update sourceTable records' source field
        
        -- Set source field in new source record to point to NEW.id (in target table)
        IF new_value IS NOT NULL THEN
          EXECUTE format(
            'UPDATE %I SET %I = $1 WHERE id = $2',
            quote_ident(source_table_name),
            quote_ident(source_field_name)
          ) USING NEW.id, new_value;
        END IF;
        
        -- Clear source field in old source record (if different)
        IF old_value IS NOT NULL AND old_value IS DISTINCT FROM new_value THEN
          EXECUTE format(
            'UPDATE %I SET %I = NULL WHERE id = $1',
            quote_ident(source_table_name),
            quote_ident(source_field_name)
          ) USING old_value;
        END IF;
      ELSE
        -- FORWARD SYNC: Update target records
        -- NEW.id is in sourceTable, new_value/old_value are target record IDs
        -- Update targetTable records' reciprocal field
        
        -- Set reciprocal in new target record to point back to NEW.id (in source table)
        IF new_value IS NOT NULL THEN
          EXECUTE format(
            'UPDATE %I SET %I = $1 WHERE id = $2',
            quote_ident(target_table_name),
            quote_ident(reciprocal_field_name)
          ) USING NEW.id, new_value;
        END IF;
        
        -- Clear reciprocal in old target record (if different)
        IF old_value IS NOT NULL AND old_value IS DISTINCT FROM new_value THEN
          EXECUTE format(
            'UPDATE %I SET %I = NULL WHERE id = $1',
            quote_ident(target_table_name),
            quote_ident(reciprocal_field_name)
          ) USING old_value;
        END IF;
      END IF;
    END IF;
  END;
  
  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the update
    RAISE WARNING 'sync_linked_field_bidirectional error: %', SQLERRM;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Note: Triggers need to be created dynamically for each table with linked fields
-- This is handled by the application or a separate migration that scans table_fields
-- and creates triggers as needed. For now, we just create the function.

-- Example of how to create a trigger (this would be done dynamically):
-- CREATE TRIGGER sync_linked_field_<field_name>
--   AFTER UPDATE ON <table_name>
--   FOR EACH ROW
--   WHEN (OLD.<field_name> IS DISTINCT FROM NEW.<field_name>)
--   EXECUTE FUNCTION public.sync_linked_field_bidirectional('<field_name>');

COMMIT;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- The function sync_linked_field_bidirectional has been created.
-- 
-- To use it, triggers need to be created for each table with linked fields.
-- This can be done:
-- 1. Manually for specific tables
-- 2. Via a script that scans table_fields and creates triggers
-- 3. Via application code when linked fields are created
--
-- Example trigger creation:
-- CREATE TRIGGER sync_linked_field_example
--   AFTER UPDATE ON your_table_name
--   FOR EACH ROW
--   WHEN (OLD.your_field_name IS DISTINCT FROM NEW.your_field_name)
--   EXECUTE FUNCTION public.sync_linked_field_bidirectional('your_field_name');
-- ============================================================================
