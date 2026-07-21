-- Make Auth user deletion reliable:
-- 1) clear_auth_user_restrict_refs must not silently no-op, must handle NOT NULL
--    audit columns by reassigning, and must resolve auth.users without search_path issues.
-- 2) Soften automation_runs audit FKs (the failure seen in production deletes).

CREATE OR REPLACE FUNCTION public.clear_auth_user_restrict_refs(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  replacement_user_id uuid;
  auth_users_oid oid;
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'clear_auth_user_restrict_refs: target_user_id is required';
  END IF;

  SELECT c.oid
  INTO auth_users_oid
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'auth'
    AND c.relname = 'users';

  IF auth_users_oid IS NULL THEN
    RAISE EXCEPTION 'clear_auth_user_restrict_refs: auth.users not found';
  END IF;

  -- Prefer another admin for NOT NULL audit reassignment; else any other user.
  SELECT p.user_id
  INTO replacement_user_id
  FROM public.profiles p
  WHERE p.user_id <> target_user_id
    AND lower(coalesce(p.role, '')) = 'admin'
    AND coalesce(p.is_archived, false) = false
  ORDER BY p.created_at NULLS LAST
  LIMIT 1;

  IF replacement_user_id IS NULL THEN
    SELECT u.id
    INTO replacement_user_id
    FROM auth.users u
    WHERE u.id <> target_user_id
    ORDER BY u.created_at NULLS LAST
    LIMIT 1;
  END IF;

  FOR r IN
    SELECT
      c.conrelid::regclass AS tbl,
      n.nspname AS schemaname,
      a.attname AS col,
      a.attnotnull AS not_null
    FROM pg_constraint c
    JOIN pg_class cls ON cls.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cls.relnamespace
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY (c.conkey)
     AND NOT a.attisdropped
     AND a.attnum > 0
    WHERE c.contype = 'f'
      AND c.confrelid = auth_users_oid
      AND c.confdeltype IN ('a', 'r') -- NO ACTION / RESTRICT
      AND n.nspname <> 'auth'
  LOOP
    IF r.not_null THEN
      IF replacement_user_id IS NULL THEN
        RAISE EXCEPTION
          'Cannot delete user: %.%.% is NOT NULL and no other user exists to reassign references',
          r.schemaname,
          r.tbl,
          r.col;
      END IF;
      EXECUTE format(
        'UPDATE %s SET %I = $2 WHERE %I = $1',
        r.tbl,
        r.col,
        r.col
      )
      USING target_user_id, replacement_user_id;
    ELSE
      EXECUTE format(
        'UPDATE %s SET %I = NULL WHERE %I = $1',
        r.tbl,
        r.col,
        r.col
      )
      USING target_user_id;
    END IF;
  END LOOP;

  -- Soft-unlink contacts (already ON DELETE SET NULL, but clear early).
  UPDATE public.contacts
  SET user_id = NULL
  WHERE user_id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_auth_user_restrict_refs(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_auth_user_restrict_refs(uuid) TO service_role;

-- Production delete failed on these FKs; SET NULL on user delete is safe for audit cols.
ALTER TABLE public.automation_runs
  DROP CONSTRAINT IF EXISTS automation_runs_created_by_fkey,
  DROP CONSTRAINT IF EXISTS automation_runs_updated_by_fkey;

ALTER TABLE public.automation_runs
  ADD CONSTRAINT automation_runs_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD CONSTRAINT automation_runs_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES auth.users (id) ON DELETE SET NULL;

DROP FUNCTION IF EXISTS public._test_clear_debug(uuid);
