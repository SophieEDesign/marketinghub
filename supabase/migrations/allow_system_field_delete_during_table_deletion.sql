-- Allow deleting system audit field metadata during full table deletion
--
-- Background:
-- `public.table_fields` has a trigger that prevents deleting system audit fields
-- (created_at, created_by, updated_at, updated_by). That is correct for normal field
-- operations, but it breaks `DELETE FROM public.tables` because the FK cascade
-- tries to delete those `table_fields` rows.
--
-- Fix:
-- Allow DELETE when the session sets `app.allow_system_field_delete = on`.

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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_system_field_mutations ON public.table_fields;
CREATE TRIGGER trigger_prevent_system_field_mutations
  BEFORE UPDATE OR DELETE ON public.table_fields
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_system_field_mutations();

