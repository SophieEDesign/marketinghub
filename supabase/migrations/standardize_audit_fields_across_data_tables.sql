-- ============================================================================
-- Migration: Standardize Audit System Fields Across All Data Tables
-- ============================================================================
-- Goal:
--   Enforce Airtable-style, system-managed audit fields across ALL per-table
--   Supabase tables referenced by public.tables.supabase_table (existing + new).
--
-- Required fields (non-optional, non-editable by users):
--   - created_at timestamptz
--   - created_by uuid (auth.users.id)
--   - updated_at timestamptz
--   - updated_by uuid (auth.users.id)
--
-- Behavior:
--   - INSERT: created_* and updated_* set automatically (ignore client input)
--   - UPDATE: updated_* set automatically; created_* preserved (ignore client input)
--
-- Also:
--   - Ensure field metadata exists in public.table_fields for these columns
--     and cannot be deleted/edited by users.
--   - Ensure view_fields include system fields but hidden by default.
--
-- Notes:
--   - This migration is idempotent and safe to re-run.
--   - Uses fallback actor id when auth.uid() is null (e.g. service role).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Actor resolution helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fallback_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT COALESCE(
    (SELECT p.user_id FROM public.profiles p WHERE p.role = 'admin' ORDER BY p.created_at ASC NULLS LAST LIMIT 1),
    (SELECT u.id FROM auth.users u ORDER BY u.created_at ASC NULLS LAST LIMIT 1)
  );
$$;

GRANT EXECUTE ON FUNCTION public.fallback_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fallback_user_id() TO anon;

CREATE OR REPLACE FUNCTION public.current_actor_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT COALESCE(auth.uid(), public.fallback_user_id());
$$;

GRANT EXECUTE ON FUNCTION public.current_actor_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_actor_id() TO anon;

-- ---------------------------------------------------------------------------
-- 2) Trigger that enforces audit field behavior (non-UI-driven)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_audit_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  actor uuid;
BEGIN
  actor := public.current_actor_id();

  IF TG_OP = 'INSERT' THEN
    -- Always overwrite client-provided values (system-managed)
    NEW.created_at := now();
    NEW.updated_at := now();
    NEW.created_by := actor;
    NEW.updated_by := actor;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Preserve created_*; always update updated_*
    NEW.created_at := OLD.created_at;
    NEW.created_by := OLD.created_by;
    NEW.updated_at := now();
    NEW.updated_by := actor;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_audit_fields() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_audit_fields() TO anon;

-- ---------------------------------------------------------------------------
-- 3) Ensure audit columns + trigger exist on a given table
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_audit_fields_for_table(p_schema text, p_table text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  full_table text;
BEGIN
  full_table := format('%I.%I', p_schema, p_table);

  -- Add missing columns
  EXECUTE format('ALTER TABLE %s ADD COLUMN IF NOT EXISTS created_at timestamptz;', full_table);
  EXECUTE format('ALTER TABLE %s ADD COLUMN IF NOT EXISTS updated_at timestamptz;', full_table);
  EXECUTE format('ALTER TABLE %s ADD COLUMN IF NOT EXISTS created_by uuid;', full_table);
  EXECUTE format('ALTER TABLE %s ADD COLUMN IF NOT EXISTS updated_by uuid;', full_table);

  -- Defaults (best-effort; trigger still enforces)
  EXECUTE format('ALTER TABLE %s ALTER COLUMN created_at SET DEFAULT now();', full_table);
  EXECUTE format('ALTER TABLE %s ALTER COLUMN updated_at SET DEFAULT now();', full_table);
  EXECUTE format('ALTER TABLE %s ALTER COLUMN created_by SET DEFAULT public.current_actor_id();', full_table);
  EXECUTE format('ALTER TABLE %s ALTER COLUMN updated_by SET DEFAULT public.current_actor_id();', full_table);

  -- Backfill legacy rows (earliest known timestamp "if possible": use existing created_at/updated_at)
  EXECUTE format('UPDATE %s SET created_at = COALESCE(created_at, updated_at, now()) WHERE created_at IS NULL;', full_table);
  EXECUTE format('UPDATE %s SET updated_at = COALESCE(updated_at, created_at, now()) WHERE updated_at IS NULL;', full_table);
  EXECUTE format('UPDATE %s SET created_by = COALESCE(created_by, public.current_actor_id()) WHERE created_by IS NULL;', full_table);
  EXECUTE format('UPDATE %s SET updated_by = COALESCE(updated_by, public.current_actor_id()) WHERE updated_by IS NULL;', full_table);

  -- Not optional
  EXECUTE format('ALTER TABLE %s ALTER COLUMN created_at SET NOT NULL;', full_table);
  EXECUTE format('ALTER TABLE %s ALTER COLUMN updated_at SET NOT NULL;', full_table);
  EXECUTE format('ALTER TABLE %s ALTER COLUMN created_by SET NOT NULL;', full_table);
  EXECUTE format('ALTER TABLE %s ALTER COLUMN updated_by SET NOT NULL;', full_table);

  -- Foreign keys (best effort; ignore if already present)
  BEGIN
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (created_by) REFERENCES auth.users(id);', full_table, p_table || '_created_by_fkey');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  BEGIN
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (updated_by) REFERENCES auth.users(id);', full_table, p_table || '_updated_by_fkey');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Trigger
  EXECUTE format('DROP TRIGGER IF EXISTS trigger_handle_audit_fields ON %s;', full_table);
  EXECUTE format(
    'CREATE TRIGGER trigger_handle_audit_fields BEFORE INSERT OR UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION public.handle_audit_fields();',
    full_table
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_audit_fields_for_table(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_audit_fields_for_table(text, text) TO anon;

-- ---------------------------------------------------------------------------
-- 4) Apply enforcement to ALL per-table data tables referenced in public.tables
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT t.supabase_table
    FROM public.tables t
    WHERE t.supabase_table IS NOT NULL AND btrim(t.supabase_table) <> ''
  LOOP
    BEGIN
      PERFORM public.ensure_audit_fields_for_table('public', r.supabase_table);
    EXCEPTION WHEN undefined_table THEN
      -- Table metadata exists but physical table is missing; skip (other audits handle missing tables).
      NULL;
    END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5) Ensure system fields exist in table_fields metadata and are immutable
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t record;
  max_order integer;
BEGIN
  FOR t IN SELECT id FROM public.tables LOOP
    SELECT COALESCE(MAX(order_index), MAX(position), 0) INTO max_order
    FROM public.table_fields
    WHERE table_id = t.id;

    -- created_at
    INSERT INTO public.table_fields (table_id, name, type, position, order_index, group_name, required, options)
    VALUES (
      t.id, 'created_at', 'date', max_order + 1, max_order + 1, 'Activity', true,
      jsonb_build_object('read_only', true, 'system', true, 'hidden_by_default', true)
    )
    ON CONFLICT (table_id, name) DO UPDATE
      SET required = true,
          group_name = 'Activity',
          options = COALESCE(public.table_fields.options, '{}'::jsonb)
            || jsonb_build_object('read_only', true, 'system', true, 'hidden_by_default', true);

    -- created_by
    INSERT INTO public.table_fields (table_id, name, type, position, order_index, group_name, required, options)
    VALUES (
      t.id, 'created_by', 'text', max_order + 2, max_order + 2, 'Activity', true,
      jsonb_build_object('read_only', true, 'system', true, 'hidden_by_default', true, 'format', 'user')
    )
    ON CONFLICT (table_id, name) DO UPDATE
      SET required = true,
          group_name = 'Activity',
          options = COALESCE(public.table_fields.options, '{}'::jsonb)
            || jsonb_build_object('read_only', true, 'system', true, 'hidden_by_default', true, 'format', 'user');

    -- updated_at
    INSERT INTO public.table_fields (table_id, name, type, position, order_index, group_name, required, options)
    VALUES (
      t.id, 'updated_at', 'date', max_order + 3, max_order + 3, 'Activity', true,
      jsonb_build_object('read_only', true, 'system', true, 'hidden_by_default', true)
    )
    ON CONFLICT (table_id, name) DO UPDATE
      SET required = true,
          group_name = 'Activity',
          options = COALESCE(public.table_fields.options, '{}'::jsonb)
            || jsonb_build_object('read_only', true, 'system', true, 'hidden_by_default', true);

    -- updated_by
    INSERT INTO public.table_fields (table_id, name, type, position, order_index, group_name, required, options)
    VALUES (
      t.id, 'updated_by', 'text', max_order + 4, max_order + 4, 'Activity', true,
      jsonb_build_object('read_only', true, 'system', true, 'hidden_by_default', true, 'format', 'user')
    )
    ON CONFLICT (table_id, name) DO UPDATE
      SET required = true,
          group_name = 'Activity',
          options = COALESCE(public.table_fields.options, '{}'::jsonb)
            || jsonb_build_object('read_only', true, 'system', true, 'hidden_by_default', true, 'format', 'user');
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_system_field_mutations()
RETURNS TRIGGER
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

-- ---------------------------------------------------------------------------
-- 6) Ensure view_fields includes system fields but hidden by default
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v record;
  f text;
BEGIN
  FOR v IN SELECT id, table_id FROM public.views WHERE table_id IS NOT NULL LOOP
    FOREACH f IN ARRAY ARRAY['created_at','created_by','updated_at','updated_by']
    LOOP
      -- view_fields has no (view_id, field_name) unique constraint in some environments,
      -- so make this explicitly idempotent.
      IF NOT EXISTS (
        SELECT 1 FROM public.view_fields vf
        WHERE vf.view_id = v.id AND vf.field_name = f
      ) THEN
        INSERT INTO public.view_fields (view_id, field_name, visible, position)
        VALUES (v.id, f, false, 9990);
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 7) Ensure dynamic table creation RPCs create audit fields + trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_dynamic_table(table_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS public.%I (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      created_by uuid NOT NULL DEFAULT public.current_actor_id(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by uuid NOT NULL DEFAULT public.current_actor_id()
    );
  ', table_name);

  PERFORM public.ensure_audit_fields_for_table('public', table_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_dynamic_table(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_dynamic_table(text) TO anon;

CREATE OR REPLACE FUNCTION public.add_column_to_table(
  table_name text,
  column_name text,
  column_type text DEFAULT 'text'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Prevent adding columns that collide with system fields
  IF lower(column_name) IN ('created_at','created_by','updated_at','updated_by') THEN
    RAISE EXCEPTION 'Column name "%" is reserved for system audit fields.', column_name;
  END IF;

  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I %s;',
    table_name, column_name, column_type);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_column_to_table(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_column_to_table(text, text, text) TO anon;

CREATE OR REPLACE FUNCTION public.create_table_with_columns(
  table_name text,
  columns jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  col jsonb;
BEGIN
  PERFORM public.create_dynamic_table(table_name);

  FOR col IN SELECT * FROM jsonb_array_elements(columns)
  LOOP
    PERFORM public.add_column_to_table(
      table_name,
      col->>'name',
      col->>'type'
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_table_with_columns(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_table_with_columns(text, jsonb) TO anon;

-- ---------------------------------------------------------------------------
-- 8) Update get_table_columns to include system fields (except id)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_table_columns(table_name text)
RETURNS TABLE(column_name text, data_type text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.column_name::text,
    c.data_type::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = get_table_columns.table_name
    AND c.column_name <> 'id'
  ORDER BY c.ordinal_position;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_table_columns(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_columns(text) TO anon;

