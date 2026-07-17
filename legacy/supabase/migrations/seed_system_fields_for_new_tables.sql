-- ============================================================================
-- Migration: Seed system fields in table_fields for new tables
-- ============================================================================
-- Problem: System fields (created_at, created_by, updated_at, updated_by) are
-- only backfilled for tables that existed when standardize_audit_fields ran.
-- New tables never get these rows in table_fields, so they "drop off" in the UI.
--
-- Solution:
--   - Function that ensures the four system field rows exist in table_fields
--     for a given table_id (idempotent).
--   - AFTER INSERT trigger on public.tables so every new table gets them.
--   - One-time backfill for any existing table missing system field metadata.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Function: ensure_system_fields_for_table(table_id uuid)
-- ---------------------------------------------------------------------------
-- Inserts the four system field metadata rows if missing; updates options
-- if they exist (keeps group_name, required, options in sync with standard).
-- Uses max(order_index)+1..+4 so system fields come after any existing fields.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_system_fields_for_table(p_table_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_order integer;
BEGIN
  SELECT COALESCE(MAX(order_index), MAX(position), 0) INTO max_order
  FROM public.table_fields
  WHERE table_id = p_table_id;

  -- created_at
  INSERT INTO public.table_fields (table_id, name, type, position, order_index, group_name, required, options)
  VALUES (
    p_table_id, 'created_at', 'date', max_order + 1, max_order + 1, 'Activity', true,
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
    p_table_id, 'created_by', 'text', max_order + 2, max_order + 2, 'Activity', true,
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
    p_table_id, 'updated_at', 'date', max_order + 3, max_order + 3, 'Activity', true,
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
    p_table_id, 'updated_by', 'text', max_order + 4, max_order + 4, 'Activity', true,
    jsonb_build_object('read_only', true, 'system', true, 'hidden_by_default', true, 'format', 'user')
  )
  ON CONFLICT (table_id, name) DO UPDATE
    SET required = true,
        group_name = 'Activity',
        options = COALESCE(public.table_fields.options, '{}'::jsonb)
          || jsonb_build_object('read_only', true, 'system', true, 'hidden_by_default', true, 'format', 'user');
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_system_fields_for_table(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_system_fields_for_table(uuid) TO anon;

-- ---------------------------------------------------------------------------
-- 2) Trigger: after insert on public.tables, seed system fields in table_fields
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trigger_seed_system_fields_for_new_table()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_system_fields_for_table(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_seed_system_fields_for_new_table ON public.tables;
CREATE TRIGGER trigger_seed_system_fields_for_new_table
  AFTER INSERT ON public.tables
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_seed_system_fields_for_new_table();

-- ---------------------------------------------------------------------------
-- 3) Backfill: ensure every existing table has system field metadata
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT id FROM public.tables LOOP
    PERFORM public.ensure_system_fields_for_table(t.id);
  END LOOP;
END $$;
