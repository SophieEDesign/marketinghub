-- ============================================================================
-- Migration: Fix Invalid Lookup Fields
-- ============================================================================
-- This migration identifies and fixes existing lookup fields that don't
-- reference valid linked fields (link_to_table) in the current table.
--
-- In Airtable-style behavior, lookup fields must reference a linked field
-- (link_to_table) in the current table that connects to the lookup table.
-- This establishes the relationship needed to determine which records to look up.
--
-- What it does:
-- 1. Finds all lookup fields (type = 'lookup')
-- 2. For each lookup field, validates that lookup_field_id:
--    - Exists in the current table
--    - Is of type 'link_to_table'
--    - Has linked_table_id that matches the lookup field's lookup_table_id
-- 3. For invalid lookup fields:
--    - If auto_fix = true: Tries to find a valid linked field in the same table
--      that links to the lookup table, and updates the lookup field to use it
--    - If auto_fix = false: Just reports invalid fields without fixing them
--
-- Usage:
--   -- Dry run (report only):
--   SELECT * FROM public.fix_invalid_lookup_fields(dry_run => true, auto_fix => false);
--
--   -- Auto-fix invalid fields:
--   SELECT * FROM public.fix_invalid_lookup_fields(dry_run => false, auto_fix => true);
-- ============================================================================
-- Date: 2026-01-26
-- ============================================================================

BEGIN;

-- Create function to fix invalid lookup fields
CREATE OR REPLACE FUNCTION public.fix_invalid_lookup_fields(
  dry_run boolean DEFAULT true,
  auto_fix boolean DEFAULT false
)
RETURNS TABLE (
  invalid_count integer,
  fixed_count integer,
  invalid_fields jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
  lookup_field_record public.table_fields%rowtype;
  linked_field_record public.table_fields%rowtype;
  lookup_table_record public.tables%rowtype;
  
  lookup_table_id uuid;
  lookup_field_id uuid;
  linked_table_id uuid;
  
  invalid_fields_array jsonb := '[]'::jsonb;
  invalid_count_var integer := 0;
  fixed_count_var integer := 0;
  
  candidate_linked_field public.table_fields%rowtype;
  issue_description text;
BEGIN
  RAISE NOTICE 'Fixing invalid lookup fields (dry_run=%, auto_fix=%)', dry_run, auto_fix;
  
  -- Loop through all lookup fields
  FOR lookup_field_record IN
    SELECT *
    FROM public.table_fields
    WHERE type = 'lookup'
    ORDER BY created_at ASC
  LOOP
    -- Extract lookup configuration
    lookup_table_id := (lookup_field_record.options->>'lookup_table_id')::uuid;
    lookup_field_id := (lookup_field_record.options->>'lookup_field_id')::uuid;
    
    -- Skip if missing required options
    IF lookup_table_id IS NULL OR lookup_field_id IS NULL THEN
      invalid_count_var := invalid_count_var + 1;
      issue_description := 'Missing lookup_table_id or lookup_field_id in options';
      
      invalid_fields_array := invalid_fields_array || jsonb_build_object(
        'field_id', lookup_field_record.id,
        'field_name', lookup_field_record.name,
        'table_id', lookup_field_record.table_id,
        'issue', issue_description,
        'can_auto_fix', false
      );
      CONTINUE;
    END IF;
    
    -- Check if lookup_field_id exists and is in the same table
    SELECT * INTO linked_field_record
    FROM public.table_fields
    WHERE id = lookup_field_id
      AND table_id = lookup_field_record.table_id;
    
    -- Validate the linked field
    IF linked_field_record.id IS NULL THEN
      -- Field doesn't exist or is in wrong table
      invalid_count_var := invalid_count_var + 1;
      issue_description := format('lookup_field_id "%s" does not exist in table "%s"', lookup_field_id, lookup_field_record.table_id);
      
      -- Try to find a valid linked field to auto-fix
      IF auto_fix THEN
        SELECT * INTO candidate_linked_field
        FROM public.table_fields
        WHERE table_id = lookup_field_record.table_id
          AND type = 'link_to_table'
          AND (options->>'linked_table_id')::uuid = lookup_table_id
          AND id != lookup_field_record.id
        ORDER BY created_at ASC
        LIMIT 1;
        
        IF candidate_linked_field.id IS NOT NULL THEN
          -- Found a valid linked field, update the lookup field
          IF NOT dry_run THEN
            UPDATE public.table_fields
            SET options = jsonb_set(
              coalesce(options, '{}'::jsonb),
              '{lookup_field_id}',
              to_jsonb(candidate_linked_field.id::text)
            ),
            updated_at = now()
            WHERE id = lookup_field_record.id;
            
            fixed_count_var := fixed_count_var + 1;
            RAISE NOTICE 'Fixed lookup field %: updated lookup_field_id from % to %', 
              lookup_field_record.name, lookup_field_id, candidate_linked_field.id;
          ELSE
            invalid_fields_array := invalid_fields_array || jsonb_build_object(
              'field_id', lookup_field_record.id,
              'field_name', lookup_field_record.name,
              'table_id', lookup_field_record.table_id,
              'issue', issue_description,
              'can_auto_fix', true,
              'suggested_fix', format('Use linked field "%s" (id: %s)', candidate_linked_field.name, candidate_linked_field.id)
            );
          END IF;
        ELSE
          -- No valid linked field found
          invalid_fields_array := invalid_fields_array || jsonb_build_object(
            'field_id', lookup_field_record.id,
            'field_name', lookup_field_record.name,
            'table_id', lookup_field_record.table_id,
            'issue', issue_description || ' - No valid linked field found to auto-fix',
            'can_auto_fix', false
          );
        END IF;
      ELSE
        invalid_fields_array := invalid_fields_array || jsonb_build_object(
          'field_id', lookup_field_record.id,
          'field_name', lookup_field_record.name,
          'table_id', lookup_field_record.table_id,
          'issue', issue_description,
          'can_auto_fix', true
        );
      END IF;
      
      CONTINUE;
    END IF;
    
    -- Check if it's a linked field type
    IF linked_field_record.type != 'link_to_table' THEN
      invalid_count_var := invalid_count_var + 1;
      issue_description := format('lookup_field_id "%s" is of type "%s", but must be "link_to_table"', 
        lookup_field_id, linked_field_record.type);
      
      -- Try to find a valid linked field to auto-fix
      IF auto_fix THEN
        SELECT * INTO candidate_linked_field
        FROM public.table_fields
        WHERE table_id = lookup_field_record.table_id
          AND type = 'link_to_table'
          AND (options->>'linked_table_id')::uuid = lookup_table_id
          AND id != lookup_field_record.id
        ORDER BY created_at ASC
        LIMIT 1;
        
        IF candidate_linked_field.id IS NOT NULL THEN
          -- Found a valid linked field, update the lookup field
          IF NOT dry_run THEN
            UPDATE public.table_fields
            SET options = jsonb_set(
              coalesce(options, '{}'::jsonb),
              '{lookup_field_id}',
              to_jsonb(candidate_linked_field.id::text)
            ),
            updated_at = now()
            WHERE id = lookup_field_record.id;
            
            fixed_count_var := fixed_count_var + 1;
            RAISE NOTICE 'Fixed lookup field %: updated lookup_field_id from % (type: %) to %', 
              lookup_field_record.name, lookup_field_id, linked_field_record.type, candidate_linked_field.id;
          ELSE
            invalid_fields_array := invalid_fields_array || jsonb_build_object(
              'field_id', lookup_field_record.id,
              'field_name', lookup_field_record.name,
              'table_id', lookup_field_record.table_id,
              'issue', issue_description,
              'can_auto_fix', true,
              'suggested_fix', format('Use linked field "%s" (id: %s)', candidate_linked_field.name, candidate_linked_field.id)
            );
          END IF;
        ELSE
          invalid_fields_array := invalid_fields_array || jsonb_build_object(
            'field_id', lookup_field_record.id,
            'field_name', lookup_field_record.name,
            'table_id', lookup_field_record.table_id,
            'issue', issue_description || ' - No valid linked field found to auto-fix',
            'can_auto_fix', false
          );
        END IF;
      ELSE
        invalid_fields_array := invalid_fields_array || jsonb_build_object(
          'field_id', lookup_field_record.id,
          'field_name', lookup_field_record.name,
          'table_id', lookup_field_record.table_id,
          'issue', issue_description,
          'can_auto_fix', true
        );
      END IF;
      
      CONTINUE;
    END IF;
    
    -- Check if linked field points to the correct lookup table
    linked_table_id := (linked_field_record.options->>'linked_table_id')::uuid;
    
    IF linked_table_id IS NULL OR linked_table_id != lookup_table_id THEN
      invalid_count_var := invalid_count_var + 1;
      issue_description := format('Linked field "%s" points to table "%s", but lookup field expects "%s"', 
        linked_field_record.name, 
        coalesce(linked_table_id::text, 'NULL'), 
        lookup_table_id::text);
      
      -- Try to find a valid linked field to auto-fix
      IF auto_fix THEN
        SELECT * INTO candidate_linked_field
        FROM public.table_fields
        WHERE table_id = lookup_field_record.table_id
          AND type = 'link_to_table'
          AND (options->>'linked_table_id')::uuid = lookup_table_id
          AND id != lookup_field_record.id
        ORDER BY created_at ASC
        LIMIT 1;
        
        IF candidate_linked_field.id IS NOT NULL THEN
          -- Found a valid linked field, update the lookup field
          IF NOT dry_run THEN
            UPDATE public.table_fields
            SET options = jsonb_set(
              coalesce(options, '{}'::jsonb),
              '{lookup_field_id}',
              to_jsonb(candidate_linked_field.id::text)
            ),
            updated_at = now()
            WHERE id = lookup_field_record.id;
            
            fixed_count_var := fixed_count_var + 1;
            RAISE NOTICE 'Fixed lookup field %: updated lookup_field_id from % (wrong table) to %', 
              lookup_field_record.name, lookup_field_id, candidate_linked_field.id;
          ELSE
            invalid_fields_array := invalid_fields_array || jsonb_build_object(
              'field_id', lookup_field_record.id,
              'field_name', lookup_field_record.name,
              'table_id', lookup_field_record.table_id,
              'issue', issue_description,
              'can_auto_fix', true,
              'suggested_fix', format('Use linked field "%s" (id: %s)', candidate_linked_field.name, candidate_linked_field.id)
            );
          END IF;
        ELSE
          invalid_fields_array := invalid_fields_array || jsonb_build_object(
            'field_id', lookup_field_record.id,
            'field_name', lookup_field_record.name,
            'table_id', lookup_field_record.table_id,
            'issue', issue_description || ' - No valid linked field found to auto-fix',
            'can_auto_fix', false
          );
        END IF;
      ELSE
        invalid_fields_array := invalid_fields_array || jsonb_build_object(
          'field_id', lookup_field_record.id,
          'field_name', lookup_field_record.name,
          'table_id', lookup_field_record.table_id,
          'issue', issue_description,
          'can_auto_fix', true
        );
      END IF;
      
      CONTINUE;
    END IF;
    
    -- If we get here, the lookup field is valid
    RAISE NOTICE 'Lookup field % is valid', lookup_field_record.name;
  END LOOP;
  
  -- Return results
  RETURN QUERY SELECT
    invalid_count_var,
    fixed_count_var,
    invalid_fields_array;
END;
$$;

COMMIT;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- The function fix_invalid_lookup_fields has been created.
--
-- To use it:
-- 1. First run a dry run to see what needs fixing:
--    SELECT * FROM public.fix_invalid_lookup_fields(dry_run => true, auto_fix => false);
--
-- 2. If auto_fix is enabled, it will try to automatically fix invalid fields
--    by finding valid linked fields in the same table:
--    SELECT * FROM public.fix_invalid_lookup_fields(dry_run => false, auto_fix => true);
--
-- 3. The function returns:
--    - invalid_count: Number of invalid lookup fields found
--    - fixed_count: Number of fields that were fixed (if auto_fix = true)
--    - invalid_fields: JSON array of invalid field details
-- ============================================================================
