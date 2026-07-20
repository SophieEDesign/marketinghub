-- Allow Auth user deletion when rows still reference them via
-- created_by / updated_by (NO ACTION / RESTRICT FKs).

CREATE OR REPLACE FUNCTION public.clear_auth_user_restrict_refs(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF target_user_id IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT
      c.conrelid::regclass AS tbl,
      a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND c.confdeltype IN ('a', 'r') -- NO ACTION / RESTRICT
      AND c.conrelid::regclass::text NOT LIKE 'auth.%'
  LOOP
    EXECUTE format(
      'UPDATE %s SET %I = NULL WHERE %I = $1',
      r.tbl,
      r.col,
      r.col
    )
    USING target_user_id;
  END LOOP;

  -- Soft-unlink contacts (already ON DELETE SET NULL, but clear early).
  UPDATE public.contacts
  SET user_id = NULL
  WHERE user_id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_auth_user_restrict_refs(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_auth_user_restrict_refs(uuid) TO service_role;
