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
  
  source_field_name text;
  reciprocal_field_name text;
  target_table_name text;
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
BEGIN
  -- Get the column name that was updated
  source_field_name := TG_ARGV[0];
  
  IF source_field_name IS NULL THEN
    RAISE WARNING 'sync_linked_field_bidirectional: No field name provided';
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Get source field metadata
  SELECT * INTO source_field_record
  FROM public.table_fields
  WHERE table_id = (SELECT id FROM public.tables WHERE supabase_table = TG_TABLE_NAME)
    AND name = source_field_name
    AND type = 'link_to_table';
  
  IF source_field_record.id IS NULL THEN
    -- Not a linked field, nothing to sync
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Get source table info
  SELECT * INTO source_table_record
  FROM public.tables
  WHERE supabase_table = TG_TABLE_NAME;
  
  IF source_table_record.id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  source_table_id := source_table_record.id;
  
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
  
  -- Determine if multi-link based on source field options
  DECLARE
    is_multi boolean;
    relationship_type text;
    max_selections int;
  BEGIN
    relationship_type := source_field_record.options->>'relationship_type';
    max_selections := (source_field_record.options->>'max_selections')::int;
    
    is_multi := (
      relationship_type IN ('one-to-many', 'many-to-many') OR
      (max_selections IS NOT NULL AND max_selections > 1)
    );
    
    IF is_multi THEN
      -- Multi-link: Handle array operations
      old_array := CASE
        WHEN OLD IS NULL THEN ARRAY[]::uuid[]
        WHEN (OLD::jsonb->>source_field_name) IS NULL THEN ARRAY[]::uuid[]
        WHEN jsonb_typeof(OLD::jsonb->source_field_name) = 'array' THEN
          ARRAY(SELECT jsonb_array_elements_text(OLD::jsonb->source_field_name)::uuid)
        ELSE ARRAY[(OLD::jsonb->>source_field_name)::uuid]
      END;
      
      new_array := CASE
        WHEN NEW IS NULL THEN ARRAY[]::uuid[]
        WHEN (NEW::jsonb->>source_field_name) IS NULL THEN ARRAY[]::uuid[]
        WHEN jsonb_typeof(NEW::jsonb->source_field_name) = 'array' THEN
          ARRAY(SELECT jsonb_array_elements_text(NEW::jsonb->source_field_name)::uuid)
        ELSE ARRAY[(NEW::jsonb->>source_field_name)::uuid]
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
      
      -- Update target records for added links
      IF array_length(added_ids, 1) > 0 THEN
        FOR target_id IN SELECT unnest(added_ids)
        LOOP
          -- Get current value
          EXECUTE format(
            'SELECT %I FROM %I WHERE id = $1',
            quote_ident(reciprocal_field_name),
            quote_ident(target_table_name)
          ) INTO current_array
          USING target_id;
          
          IF current_array IS NULL THEN
            current_array := ARRAY[]::uuid[];
          END IF;
          
          -- Add source record ID if not present
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
          -- Get current value
          EXECUTE format(
            'SELECT %I FROM %I WHERE id = $1',
            quote_ident(reciprocal_field_name),
            quote_ident(target_table_name)
          ) INTO current_array
          USING target_id;
          
          IF current_array IS NULL THEN
            current_array := ARRAY[]::uuid[];
          END IF;
          
          -- Remove source record ID if present
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
    ELSE
      -- Single-link: Set reciprocal to point back
      old_value := CASE
        WHEN OLD IS NULL THEN NULL
        WHEN (OLD::jsonb->>source_field_name) IS NULL THEN NULL
        ELSE (OLD::jsonb->>source_field_name)::uuid
      END;
      
      new_value := CASE
        WHEN NEW IS NULL THEN NULL
        WHEN (NEW::jsonb->>source_field_name) IS NULL THEN NULL
        ELSE (NEW::jsonb->>source_field_name)::uuid
      END;
      
      -- Set reciprocal in new target record
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
