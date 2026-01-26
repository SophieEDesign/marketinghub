-- ============================================================================
-- Migration: Repair Existing Linked Fields for Bidirectional Sync
-- ============================================================================
-- This migration ensures all existing linked fields have proper bidirectional
-- relationships set up and backfills existing data to be consistent on both sides.
--
-- What it does:
-- 1. Finds all link_to_table fields that may be missing reciprocals
-- 2. Creates missing reciprocal fields in target tables
-- 3. Ensures both sides have proper linked_field_id references
-- 4. Backfills existing data bidirectionally (syncs data from source to reciprocal)
-- 5. Ensures view_fields exist so columns show in views
--
-- This is a one-time migration to prepare existing data for bidirectional sync.
-- Future updates will be handled by application-level sync and database triggers.
-- ============================================================================
-- Date: 2026-01-26
-- ============================================================================

BEGIN;

-- Create a function to repair linked fields bidirectionally
CREATE OR REPLACE FUNCTION public.repair_existing_linked_fields_bidirectional(
  dry_run boolean DEFAULT false,
  no_backfill boolean DEFAULT false,
  limit_count integer DEFAULT NULL
)
RETURNS TABLE (
  processed integer,
  created_reciprocals integer,
  repaired_pairs integer,
  view_fields_inserted integer,
  backfill_row_updates bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
  f record;
  source_tbl public.tables%rowtype;
  target_tbl public.tables%rowtype;
  reciprocal public.table_fields%rowtype;
  
  target_table_id uuid;
  linked_field_id uuid;
  
  source_table_sql text;
  target_table_sql text;
  
  reciprocal_label text;
  base_name text;
  candidate_name text;
  suffix int;
  name_exists boolean;
  
  next_position int;
  next_order_index int;
  
  source_options jsonb;
  reciprocal_options jsonb;
  
  source_needs_update boolean;
  reciprocal_needs_update boolean;
  
  target_is_multi boolean;
  source_is_multi boolean;
  
  backfill_sql text;
  updated_rows bigint;
  inserted_rows int;
  
  processed_count integer := 0;
  created_reciprocals_count integer := 0;
  repaired_pairs_count integer := 0;
  view_fields_inserted_count integer := 0;
  backfill_row_updates_count bigint := 0;
  
  source_col text;
  reciprocal_col text;
  page_size integer := 1000;
  from_offset integer;
  batch_count integer;
BEGIN
  RAISE NOTICE 'Repair linked fields for bidirectional sync (dry_run=%, backfill=%)', dry_run, (not no_backfill);
  
  FOR f IN
    SELECT id, table_id, name, label, type, position, order_index, options, created_at
    FROM public.table_fields
    WHERE type = 'link_to_table'
    ORDER BY created_at ASC
  LOOP
    processed_count := processed_count + 1;
    
    IF limit_count IS NOT NULL AND processed_count > limit_count THEN
      EXIT;
    END IF;
    
    source_options := coalesce(f.options, '{}'::jsonb);
    
    -- Skip if no linked_table_id
    IF (source_options ->> 'linked_table_id') IS NULL THEN
      CONTINUE;
    END IF;
    
    BEGIN
      target_table_id := (source_options ->> 'linked_table_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping field %: invalid linked_table_id', f.id;
      CONTINUE;
    END;
    
    -- Skip self-links
    IF target_table_id = f.table_id THEN
      CONTINUE;
    END IF;
    
    -- Get source table
    SELECT * INTO source_tbl FROM public.tables WHERE id = f.table_id;
    IF source_tbl.id IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Get target table
    SELECT * INTO target_tbl FROM public.tables WHERE id = target_table_id;
    IF target_tbl.id IS NULL THEN
      RAISE NOTICE 'Skipping field %: target table not found', f.id;
      CONTINUE;
    END IF;
    
    -- Prepare SQL identifiers
    IF position('.' in source_tbl.supabase_table) > 0 THEN
      source_table_sql := quote_ident(split_part(source_tbl.supabase_table, '.', 1)) || '.' || quote_ident(split_part(source_tbl.supabase_table, '.', 2));
    ELSE
      source_table_sql := quote_ident(source_tbl.supabase_table);
    END IF;
    
    IF position('.' in target_tbl.supabase_table) > 0 THEN
      target_table_sql := quote_ident(split_part(target_tbl.supabase_table, '.', 1)) || '.' || quote_ident(split_part(target_tbl.supabase_table, '.', 2));
    ELSE
      target_table_sql := quote_ident(target_tbl.supabase_table);
    END IF;
    
    -- Try to find existing reciprocal via linked_field_id
    reciprocal := NULL;
    linked_field_id := NULL;
    
    IF source_options ? 'linked_field_id' THEN
      BEGIN
        linked_field_id := (source_options ->> 'linked_field_id')::uuid;
      EXCEPTION WHEN OTHERS THEN
        linked_field_id := NULL;
      END;
      
      IF linked_field_id IS NOT NULL THEN
        SELECT * INTO reciprocal
        FROM public.table_fields
        WHERE id = linked_field_id
        LIMIT 1;
        
        IF reciprocal.id IS NOT NULL AND reciprocal.type IS DISTINCT FROM 'link_to_table' THEN
          reciprocal := NULL;
        END IF;
      END IF;
    END IF;
    
    -- If no reciprocal found, try to find existing one in target table
    IF reciprocal.id IS NULL THEN
      SELECT * INTO reciprocal
      FROM public.table_fields
      WHERE table_id = target_tbl.id
        AND type = 'link_to_table'
        AND coalesce(options, '{}'::jsonb) @> jsonb_build_object('linked_table_id', source_tbl.id::text)
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;
    
    -- If still no reciprocal, create one
    IF reciprocal.id IS NULL THEN
      reciprocal_label := coalesce(nullif(btrim(source_tbl.name), ''), nullif(btrim(f.label), ''), 'Linked records');
      
      base_name := regexp_replace(lower(btrim(reciprocal_label)), '[^a-z0-9_]+', '_', 'g');
      IF base_name = '' OR length(base_name) = 0 THEN
        base_name := 'linked_records';
      END IF;
      base_name := substring(base_name from 1 for 63);
      
      candidate_name := base_name;
      suffix := 0;
      
      LOOP
        SELECT EXISTS(
          SELECT 1 FROM public.table_fields
          WHERE table_id = target_tbl.id
            AND lower(name) = lower(candidate_name)
        ) INTO name_exists;
        
        EXIT WHEN NOT name_exists;
        
        suffix := suffix + 1;
        candidate_name := substring((base_name || '_' || suffix) from 1 for 63);
        
        IF suffix > 50 THEN
          RAISE EXCEPTION 'Failed to find unique reciprocal field name for table %', target_tbl.id;
        END IF;
      END LOOP;
      
      -- Get next position and order_index
      SELECT coalesce(max(position), -1) + 1, coalesce(max(order_index), -1) + 1
      INTO next_position, next_order_index
      FROM public.table_fields
      WHERE table_id = target_tbl.id;
      
      -- Determine if multi-link based on source field
      source_is_multi := (
        (source_options ->> 'relationship_type') IN ('one-to-many', 'many-to-many')
        OR (
          CASE
            WHEN (source_options ? 'max_selections')
              AND (source_options ->> 'max_selections') ~ '^[0-9]+$'
            THEN (source_options ->> 'max_selections')::int
            ELSE NULL
          END
        ) > 1
      );
      
      target_is_multi := source_is_multi;
      
      reciprocal_options := jsonb_build_object(
        'linked_table_id', source_tbl.id::text,
        'linked_field_id', f.id::text
      );
      
      IF NOT dry_run THEN
        INSERT INTO public.table_fields (
          table_id, name, label, type, position, order_index,
          required, default_value, options
        )
        VALUES (
          target_tbl.id, candidate_name, reciprocal_label, 'link_to_table',
          next_position, next_order_index, false, null, reciprocal_options
        )
        RETURNING * INTO reciprocal;
        
        created_reciprocals_count := created_reciprocals_count + 1;
        
        -- Create physical column
        EXECUTE format(
          'ALTER TABLE %s ADD COLUMN IF NOT EXISTS %I %s',
          target_table_sql,
          candidate_name,
          CASE WHEN target_is_multi THEN 'uuid[]' ELSE 'uuid' END
        );
      ELSE
        RAISE NOTICE 'Would create reciprocal field: table=% col=% label=%', target_tbl.supabase_table, candidate_name, reciprocal_label;
      END IF;
    END IF;
    
    -- Ensure both sides point to each other
    IF reciprocal.id IS NOT NULL THEN
      source_needs_update := (source_options ->> 'linked_field_id') IS DISTINCT FROM reciprocal.id::text;
      
      reciprocal_options := coalesce(reciprocal.options, '{}'::jsonb)
        || jsonb_build_object('linked_table_id', source_tbl.id::text, 'linked_field_id', f.id::text);
      
      reciprocal_needs_update :=
        (coalesce(reciprocal.options, '{}'::jsonb) ->> 'linked_field_id') IS DISTINCT FROM f.id::text
        OR (coalesce(reciprocal.options, '{}'::jsonb) ->> 'linked_table_id') IS DISTINCT FROM source_tbl.id::text;
      
      IF source_needs_update OR reciprocal_needs_update THEN
        repaired_pairs_count := repaired_pairs_count + 1;
      END IF;
      
      IF NOT dry_run THEN
        IF source_needs_update THEN
          UPDATE public.table_fields
          SET options = (coalesce(source_options, '{}'::jsonb) || jsonb_build_object('linked_field_id', reciprocal.id::text)),
              updated_at = now()
          WHERE id = f.id;
        END IF;
        
        IF reciprocal_needs_update THEN
          UPDATE public.table_fields
          SET options = reciprocal_options,
              updated_at = now()
          WHERE id = reciprocal.id;
        END IF;
        
        -- Ensure physical column exists for reciprocal
        target_is_multi := (
          (coalesce(reciprocal.options, '{}'::jsonb) ->> 'relationship_type') IN ('one-to-many', 'many-to-many')
          OR (
            CASE
              WHEN (coalesce(reciprocal.options, '{}'::jsonb) ? 'max_selections')
                AND (coalesce(reciprocal.options, '{}'::jsonb) ->> 'max_selections') ~ '^[0-9]+$'
              THEN (coalesce(reciprocal.options, '{}'::jsonb) ->> 'max_selections')::int
              ELSE NULL
            END
          ) > 1
        );
        
        EXECUTE format(
          'ALTER TABLE %s ADD COLUMN IF NOT EXISTS %I %s',
          target_table_sql,
          reciprocal.name,
          CASE WHEN target_is_multi THEN 'uuid[]' ELSE 'uuid' END
        );
      END IF;
    END IF;
    
    -- Ensure view_fields exist
    IF NOT dry_run AND f.id IS NOT NULL THEN
      INSERT INTO public.view_fields (view_id, field_name, visible, position)
      SELECT v.id, f.name, true, f.position
      FROM public.views v
      WHERE v.table_id = f.table_id
        AND NOT EXISTS (
          SELECT 1 FROM public.view_fields vf
          WHERE vf.view_id = v.id AND vf.field_name = f.name
        )
      ON CONFLICT DO NOTHING;
      
      GET DIAGNOSTICS inserted_rows = ROW_COUNT;
      view_fields_inserted_count := view_fields_inserted_count + inserted_rows;
      
      IF reciprocal.id IS NOT NULL THEN
        INSERT INTO public.view_fields (view_id, field_name, visible, position)
        SELECT v.id, reciprocal.name, true, reciprocal.position
        FROM public.views v
        WHERE v.table_id = reciprocal.table_id
          AND NOT EXISTS (
            SELECT 1 FROM public.view_fields vf
            WHERE vf.view_id = v.id AND vf.field_name = reciprocal.name
          )
        ON CONFLICT DO NOTHING;
        
        GET DIAGNOSTICS inserted_rows = ROW_COUNT;
        view_fields_inserted_count := view_fields_inserted_count + inserted_rows;
      END IF;
    END IF;
    
    -- Backfill data bidirectionally
    IF NOT dry_run AND NOT no_backfill AND reciprocal.id IS NOT NULL THEN
      source_col := f.name;
      reciprocal_col := reciprocal.name;
      
      source_is_multi := (
        (coalesce(f.options, '{}'::jsonb) ->> 'relationship_type') IN ('one-to-many', 'many-to-many')
        OR (
          CASE
            WHEN (coalesce(f.options, '{}'::jsonb) ? 'max_selections')
              AND (coalesce(f.options, '{}'::jsonb) ->> 'max_selections') ~ '^[0-9]+$'
            THEN (coalesce(f.options, '{}'::jsonb) ->> 'max_selections')::int
            ELSE NULL
          END
        ) > 1
      );
      
      target_is_multi := (
        (coalesce(reciprocal.options, '{}'::jsonb) ->> 'relationship_type') IN ('one-to-many', 'many-to-many')
        OR (
          CASE
            WHEN (coalesce(reciprocal.options, '{}'::jsonb) ? 'max_selections')
              AND (coalesce(reciprocal.options, '{}'::jsonb) ->> 'max_selections') ~ '^[0-9]+$'
            THEN (coalesce(reciprocal.options, '{}'::jsonb) ->> 'max_selections')::int
            ELSE NULL
          END
        ) > 1
      );
      
      -- Process in batches
      from_offset := 0;
      LOOP
        IF source_is_multi THEN
          -- Multi-link: For each source record, add its ID to target records' arrays
          EXECUTE format(
            'WITH source_records AS (
              SELECT id, %I as linked_ids
              FROM %s
              WHERE %I IS NOT NULL
              LIMIT %s OFFSET %s
            )
            UPDATE %s target
            SET %I = CASE
              WHEN target.%I IS NULL THEN ARRAY[sr.id]
              WHEN sr.id = ANY(target.%I) THEN target.%I
              ELSE target.%I || ARRAY[sr.id]
            END
            FROM source_records sr
            WHERE sr.linked_ids IS NOT NULL
              AND (
                CASE
                  WHEN array_length(sr.linked_ids, 1) IS NULL THEN false
                  ELSE target.id = ANY(sr.linked_ids)
                END
              )',
            quote_ident(source_col),
            source_table_sql,
            quote_ident(source_col),
            page_size,
            from_offset,
            target_table_sql,
            quote_ident(reciprocal_col),
            quote_ident(reciprocal_col),
            quote_ident(reciprocal_col),
            quote_ident(reciprocal_col)
          );
        ELSE
          -- Single-link: Set reciprocal to point back to source record
          EXECUTE format(
            'UPDATE %s target
            SET %I = source_rec.id
            FROM (
              SELECT id, %I as linked_id
              FROM %s
              WHERE %I IS NOT NULL
              LIMIT %s OFFSET %s
            ) source_rec
            WHERE target.id = source_rec.linked_id',
            target_table_sql,
            quote_ident(reciprocal_col),
            quote_ident(source_col),
            source_table_sql,
            quote_ident(source_col),
            page_size,
            from_offset
          );
        END IF;
        
        GET DIAGNOSTICS batch_count = ROW_COUNT;
        backfill_row_updates_count := backfill_row_updates_count + batch_count;
        
        IF batch_count < page_size THEN
          EXIT;
        END IF;
        
        from_offset := from_offset + page_size;
      END LOOP;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT
    processed_count,
    created_reciprocals_count,
    repaired_pairs_count,
    view_fields_inserted_count,
    backfill_row_updates_count;
END;
$$;

-- Run the repair function (dry run first for safety)
-- Uncomment the line below to actually apply changes:
-- SELECT * FROM public.repair_existing_linked_fields_bidirectional(dry_run => false, no_backfill => false);

-- For now, just create the function. Run it manually via:
-- SELECT * FROM public.repair_existing_linked_fields_bidirectional(dry_run => true);  -- Test first
-- SELECT * FROM public.repair_existing_linked_fields_bidirectional(dry_run => false);   -- Apply changes

COMMIT;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- The function repair_existing_linked_fields_bidirectional has been created.
-- 
-- To use it:
-- 1. Test first (dry run):
--    SELECT * FROM public.repair_existing_linked_fields_bidirectional(dry_run => true);
--
-- 2. Apply changes:
--    SELECT * FROM public.repair_existing_linked_fields_bidirectional(dry_run => false);
--
-- 3. Skip backfill (if you only want to fix metadata):
--    SELECT * FROM public.repair_existing_linked_fields_bidirectional(dry_run => false, no_backfill => true);
--
-- 4. Limit processing (for testing):
--    SELECT * FROM public.repair_existing_linked_fields_bidirectional(dry_run => false, limit_count => 10);
-- ============================================================================
