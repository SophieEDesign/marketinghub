-- Migration: Fix allocated_to foreign key constraint for table_tasks_1768655456178
-- This fixes the foreign key constraint to properly reference auth.users and handles invalid values
--
-- IMPORTANT: If "allocated_to" is configured as a link_to_table field in table_fields:
--   - It should NOT be a link_to_table field pointing to a "users" table
--   - Instead, it should be a regular UUID field that directly references auth.users(id)
--   - OR you need to create a users table/view in public.tables for the link_to_table to work
--   - The LookupFieldPicker component expects linked_table_id to point to a table in public.tables
--
-- If the field is incorrectly configured as link_to_table, you may need to:
--   1. Change the field type from 'link_to_table' to a regular field type (or create a custom user picker)
--   2. OR create a users table/view that the link_to_table can reference

-- Create a SECURITY DEFINER function to handle the constraint fix
-- This is needed to access auth.users which requires elevated privileges
CREATE OR REPLACE FUNCTION public.fix_allocated_to_foreign_key()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    constraint_exists boolean;
    constraint_ref_table text;
    constraint_ref_schema text;
    needs_recreate boolean := false;
BEGIN
    -- Check if constraint exists using pg_constraint (more reliable)
    SELECT EXISTS (
        SELECT 1 
        FROM pg_constraint pc
        JOIN pg_class pt ON pc.conrelid = pt.oid
        JOIN pg_namespace pn ON pt.relnamespace = pn.oid
        WHERE pc.conname = 'table_tasks_allocated_to_fkey'
            AND pn.nspname = 'public'
            AND pt.relname = 'table_tasks_1768655456178'
    ) INTO constraint_exists;

    -- If constraint exists, check what it references
    IF constraint_exists THEN
        SELECT 
            pn_ref.nspname,
            pt_ref.relname
        INTO 
            constraint_ref_schema,
            constraint_ref_table
        FROM pg_constraint pc
        JOIN pg_class pt ON pc.conrelid = pt.oid
        JOIN pg_namespace pn ON pt.relnamespace = pn.oid
        JOIN pg_class pt_ref ON pc.confrelid = pt_ref.oid
        JOIN pg_namespace pn_ref ON pt_ref.relnamespace = pn_ref.oid
        WHERE pc.conname = 'table_tasks_allocated_to_fkey'
            AND pn.nspname = 'public'
            AND pt.relname = 'table_tasks_1768655456178'
        LIMIT 1;

        -- If it references the wrong table, mark for recreation
        IF constraint_ref_schema IS NULL OR constraint_ref_table IS NULL OR 
           constraint_ref_schema != 'auth' OR constraint_ref_table != 'users' THEN
            RAISE NOTICE 'Constraint exists but references %.% (should be auth.users). Will recreate.', 
                COALESCE(constraint_ref_schema, 'NULL'), 
                COALESCE(constraint_ref_table, 'NULL');
            needs_recreate := true;
        ELSE
            RAISE NOTICE 'Constraint already exists and correctly references auth.users';
        END IF;
    END IF;

    -- Clean up any invalid allocated_to values (set to NULL if user doesn't exist)
    -- Do this BEFORE dropping the constraint to avoid constraint violations
    RAISE NOTICE 'Cleaning up invalid allocated_to values...';
    UPDATE public.table_tasks_1768655456178
    SET allocated_to = NULL
    WHERE allocated_to IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM auth.users u 
        WHERE u.id = table_tasks_1768655456178.allocated_to
    );

    -- Drop and recreate if needed, or create if it doesn't exist
    IF needs_recreate THEN
        RAISE NOTICE 'Dropping existing constraint...';
        ALTER TABLE public.table_tasks_1768655456178
        DROP CONSTRAINT IF EXISTS table_tasks_allocated_to_fkey;
        
        RAISE NOTICE 'Adding foreign key constraint to auth.users...';
        ALTER TABLE public.table_tasks_1768655456178
        ADD CONSTRAINT table_tasks_allocated_to_fkey
        FOREIGN KEY (allocated_to) 
        REFERENCES auth.users(id)
        ON DELETE SET NULL;
        
        RAISE NOTICE 'Successfully recreated foreign key constraint';
    ELSIF NOT constraint_exists THEN
        RAISE NOTICE 'Adding foreign key constraint to auth.users...';
        ALTER TABLE public.table_tasks_1768655456178
        ADD CONSTRAINT table_tasks_allocated_to_fkey
        FOREIGN KEY (allocated_to) 
        REFERENCES auth.users(id)
        ON DELETE SET NULL;
        
        RAISE NOTICE 'Successfully added foreign key constraint';
    END IF;
END;
$$;

-- Execute the function
SELECT public.fix_allocated_to_foreign_key();

-- Drop the temporary function
DROP FUNCTION IF EXISTS public.fix_allocated_to_foreign_key();

-- ============================================================================
-- Diagnostic: Check if allocated_to field is incorrectly configured
-- ============================================================================
-- This checks if the allocated_to field is configured as link_to_table
-- which would cause issues since there's no users table in public.tables
DO $$
DECLARE
    field_type text;
    linked_table_id text;
    table_id_val uuid;
BEGIN
    -- Find the table_id for table_tasks_1768655456178
    SELECT id INTO table_id_val
    FROM public.tables
    WHERE supabase_table = 'table_tasks_1768655456178'
    LIMIT 1;

    IF table_id_val IS NOT NULL THEN
        -- Check the allocated_to field configuration
        SELECT type, options->>'linked_table_id' INTO field_type, linked_table_id
        FROM public.table_fields
        WHERE table_id = table_id_val
        AND name = 'allocated_to'
        LIMIT 1;

        IF field_type = 'link_to_table' THEN
            RAISE WARNING 'WARNING: allocated_to field is configured as link_to_table (linked_table_id: %). This may cause issues because:
  1. LookupFieldPicker expects linked_table_id to point to a table in public.tables
  2. There is no users table in public.tables (users are in auth.users)
  3. The UI will try to query a non-existent table, causing errors
  
  Solutions:
  - Option 1: Change the field type to a regular field and use a custom user picker
  - Option 2: Create a users table/view in public.tables that the link_to_table can reference
  - Option 3: Modify the UI to handle user fields specially (query auth.users/profiles instead)', 
                COALESCE(linked_table_id, 'NULL');
        END IF;
    END IF;
END $$;

-- Create a function to validate allocated_to before insert/update
-- Uses SECURITY DEFINER to access auth.users
-- Automatically sets to NULL if user doesn't exist (graceful degradation)
CREATE OR REPLACE FUNCTION public.validate_allocated_to()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- If allocated_to is set, verify it exists in auth.users
    -- If not, automatically set to NULL instead of raising an error
    -- This provides better UX when users are deleted or invalid IDs are passed
    IF NEW.allocated_to IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM auth.users WHERE id = NEW.allocated_to
        ) THEN
            -- Log a warning but don't fail - set to NULL instead
            RAISE WARNING 'Invalid allocated_to value: user with id % does not exist in auth.users. Setting to NULL.', NEW.allocated_to;
            NEW.allocated_to := NULL;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS validate_allocated_to_trigger ON public.table_tasks_1768655456178;

-- Create trigger to validate allocated_to
CREATE TRIGGER validate_allocated_to_trigger
    BEFORE INSERT OR UPDATE OF allocated_to
    ON public.table_tasks_1768655456178
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_allocated_to();

-- ============================================================================
-- Ensure RLS policies allow authenticated users to update the table
-- This fixes 403 errors when trying to update linked record cells
-- ============================================================================

-- Ensure RLS is enabled (should already be enabled, but check anyway)
ALTER TABLE public.table_tasks_1768655456178 ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.table_tasks_1768655456178 TO authenticated;

-- Drop any existing conflicting policies
DROP POLICY IF EXISTS "Authenticated users can access data" ON public.table_tasks_1768655456178;

-- Create a permissive policy that allows all operations for authenticated users
-- Using (true) is more reliable than auth.role() checks in some contexts
CREATE POLICY "Authenticated users can access data"
    ON public.table_tasks_1768655456178
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
