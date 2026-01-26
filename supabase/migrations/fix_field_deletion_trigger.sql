-- Fix field deletion trigger to properly allow deletion of non-system fields
--
-- Issue:
-- The trigger function `prevent_system_field_mutations()` was returning `NEW` 
-- for all operations, including DELETE. For DELETE operations, PostgreSQL 
-- triggers must return `OLD` to allow deletion or `NULL` to prevent it.
-- Returning `NEW` is invalid for DELETE and was silently preventing field deletions.
--
-- Fix:
-- Update the trigger function to explicitly return `OLD` for DELETE operations
-- on non-system fields, allowing them to be deleted properly.

CREATE OR REPLACE FUNCTION public.prevent_system_field_mutations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  allow_delete boolean :=
    lower(coalesce(current_setting('app.allow_system_field_delete', true), 'off'))
      IN ('on', 'true', '1', 'yes');
BEGIN
  IF OLD.name IN ('created_at', 'created_by', 'updated_at', 'updated_by') THEN
    IF TG_OP = 'DELETE' THEN
      IF allow_delete THEN
        RETURN OLD;
      END IF;
      RAISE EXCEPTION 'System field "%" cannot be deleted.', OLD.name;
    END IF;

    -- UPDATE: allow only order/position/group changes; block destructive edits
    IF NEW.name IS DISTINCT FROM OLD.name
      OR NEW.type IS DISTINCT FROM OLD.type
      OR COALESCE(NEW.required, false) IS DISTINCT FROM COALESCE(OLD.required, false)
      OR NEW.default_value IS DISTINCT FROM OLD.default_value
      OR NEW.options IS DISTINCT FROM OLD.options
    THEN
      RAISE EXCEPTION 'System field "%" cannot be modified (only ordering/grouping changes are allowed).', OLD.name;
    END IF;

    NEW.required := true;
    NEW.group_name := 'Activity';
    NEW.options := COALESCE(OLD.options, '{}'::jsonb)
      || jsonb_build_object('read_only', true, 'system', true, 'hidden_by_default', true);
    IF OLD.name IN ('created_by', 'updated_by') THEN
      NEW.options := NEW.options || jsonb_build_object('format', 'user');
    END IF;
    RETURN NEW;
  END IF;

  -- For DELETE operations on non-system fields, return OLD to allow deletion
  -- For UPDATE operations, return NEW to allow the update
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- The trigger itself doesn't need to be recreated, just the function
-- But we'll ensure it exists with the correct configuration
DROP TRIGGER IF EXISTS trigger_prevent_system_field_mutations ON public.table_fields;
CREATE TRIGGER trigger_prevent_system_field_mutations
  BEFORE UPDATE OR DELETE ON public.table_fields
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_system_field_mutations();
