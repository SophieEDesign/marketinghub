-- Migration: Fix allocated_to foreign key constraint for table_tasks_1768655456178
-- This fixes the foreign key constraint to properly reference the contacts table
-- The allocated_to field is a link_to_table field that links to the contacts table

-- Create a SECURITY DEFINER function to handle the constraint fix
CREATE OR REPLACE FUNCTION public.fix_allocated_to_foreign_key()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    constraint_exists boolean;
    constraint_ref_table text;
    constraint_ref_schema text;
    needs_recreate boolean := false;
    tasks_table_id uuid;
    allocated_to_field_type text;
    linked_table_id_val uuid;
    contacts_table_supabase_name text;
    contacts_table_exists boolean;
BEGIN
    -- Find the table_id for table_tasks_1768655456178
    SELECT id INTO tasks_table_id
    FROM public.tables
    WHERE supabase_table = 'table_tasks_1768655456178'
    LIMIT 1;

    IF tasks_table_id IS NULL THEN
        RAISE NOTICE 'Table table_tasks_1768655456178 not found in public.tables';
        RETURN;
    END IF;

    -- Check the allocated_to field configuration
    SELECT type, (options->>'linked_table_id')::uuid
    INTO allocated_to_field_type, linked_table_id_val
    FROM public.table_fields
    WHERE table_id = tasks_table_id
    AND name = 'allocated_to'
    LIMIT 1;

    -- If it's a link_to_table field, find the contacts table
    IF allocated_to_field_type = 'link_to_table' AND linked_table_id_val IS NOT NULL THEN
        SELECT supabase_table, EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = supabase_table
        )
        INTO contacts_table_supabase_name, contacts_table_exists
        FROM public.tables
        WHERE id = linked_table_id_val
        LIMIT 1;

        IF contacts_table_supabase_name IS NULL THEN
            RAISE WARNING 'Linked table for allocated_to field not found';
            RETURN;
        END IF;

        IF NOT contacts_table_exists THEN
            RAISE WARNING 'Contacts table % does not exist', contacts_table_supabase_name;
            RETURN;
        END IF;

        RAISE NOTICE 'allocated_to field links to contacts table: %', contacts_table_supabase_name;
    ELSE
        RAISE WARNING 'allocated_to field is not configured as link_to_table or linked_table_id is missing';
        RETURN;
    END IF;

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
           constraint_ref_schema != 'public' OR constraint_ref_table != contacts_table_supabase_name THEN
            RAISE NOTICE 'Constraint exists but references %.% (should be public.%). Will recreate.', 
                COALESCE(constraint_ref_schema, 'NULL'), 
                COALESCE(constraint_ref_table, 'NULL'),
                contacts_table_supabase_name;
            needs_recreate := true;
        ELSE
            RAISE NOTICE 'Constraint already exists and correctly references public.%', contacts_table_supabase_name;
        END IF;
    END IF;

    -- Clean up any invalid allocated_to values (set to NULL if contact doesn't exist)
    -- Do this BEFORE dropping the constraint to avoid constraint violations
    RAISE NOTICE 'Cleaning up invalid allocated_to values...';
    EXECUTE format('
        UPDATE public.table_tasks_1768655456178
        SET allocated_to = NULL
        WHERE allocated_to IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.%I c 
            WHERE c.id = table_tasks_1768655456178.allocated_to
        )', contacts_table_supabase_name);

    -- Drop and recreate if needed, or create if it doesn't exist
    IF needs_recreate THEN
        RAISE NOTICE 'Dropping existing constraint...';
        ALTER TABLE public.table_tasks_1768655456178
        DROP CONSTRAINT IF EXISTS table_tasks_allocated_to_fkey;
        
        RAISE NOTICE 'Adding foreign key constraint to public.%...', contacts_table_supabase_name;
        EXECUTE format('
            ALTER TABLE public.table_tasks_1768655456178
            ADD CONSTRAINT table_tasks_allocated_to_fkey
            FOREIGN KEY (allocated_to) 
            REFERENCES public.%I(id)
            ON DELETE SET NULL', contacts_table_supabase_name);
        
        RAISE NOTICE 'Successfully recreated foreign key constraint';
    ELSIF NOT constraint_exists THEN
        RAISE NOTICE 'Adding foreign key constraint to public.%...', contacts_table_supabase_name;
        EXECUTE format('
            ALTER TABLE public.table_tasks_1768655456178
            ADD CONSTRAINT table_tasks_allocated_to_fkey
            FOREIGN KEY (allocated_to) 
            REFERENCES public.%I(id)
            ON DELETE SET NULL', contacts_table_supabase_name);
        
        RAISE NOTICE 'Successfully added foreign key constraint';
    END IF;
END;
$$;

-- Execute the function
SELECT public.fix_allocated_to_foreign_key();

-- Drop the temporary function
DROP FUNCTION IF EXISTS public.fix_allocated_to_foreign_key();


-- Create a function to validate allocated_to before insert/update
-- Automatically sets to NULL if contact doesn't exist (graceful degradation)
-- This function dynamically checks against the contacts table
CREATE OR REPLACE FUNCTION public.validate_allocated_to()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    tasks_table_id uuid;
    linked_table_id_val uuid;
    contacts_table_supabase_name text;
    contact_exists boolean;
BEGIN
    -- Find the contacts table that allocated_to links to
    SELECT id INTO tasks_table_id
    FROM public.tables
    WHERE supabase_table = 'table_tasks_1768655456178'
    LIMIT 1;

    IF tasks_table_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT (options->>'linked_table_id')::uuid
    INTO linked_table_id_val
    FROM public.table_fields
    WHERE table_id = tasks_table_id
    AND name = 'allocated_to'
    LIMIT 1;

    IF linked_table_id_val IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT supabase_table INTO contacts_table_supabase_name
    FROM public.tables
    WHERE id = linked_table_id_val
    LIMIT 1;

    IF contacts_table_supabase_name IS NULL THEN
        RETURN NEW;
    END IF;

    -- If allocated_to is set, verify it exists in the contacts table
    -- If not, automatically set to NULL instead of raising an error
    IF NEW.allocated_to IS NOT NULL THEN
        EXECUTE format('
            SELECT EXISTS (
                SELECT 1 FROM public.%I WHERE id = $1
            )', contacts_table_supabase_name)
        USING NEW.allocated_to
        INTO contact_exists;
        
        IF NOT contact_exists THEN
            -- Log a warning but don't fail - set to NULL instead
            RAISE WARNING 'Invalid allocated_to value: contact with id % does not exist in %. Setting to NULL.', 
                NEW.allocated_to, contacts_table_supabase_name;
            NEW.allocated_to := NULL;
        END IF;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- If anything goes wrong, just return NEW (don't block the operation)
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
