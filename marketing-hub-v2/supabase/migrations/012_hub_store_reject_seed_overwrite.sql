-- Prevent demo seed from wiping a real Core Data snapshot in hub_store.
CREATE OR REPLACE FUNCTION public.hub_store_reject_destructive_seed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_contacts int;
  new_contacts int;
  new_first text;
BEGIN
  old_contacts := COALESCE(jsonb_array_length(OLD.payload->'contacts'), 0);
  new_contacts := COALESCE(jsonb_array_length(NEW.payload->'contacts'), 0);
  new_first := NEW.payload->'contacts'->0->>'id';

  IF old_contacts >= 20
     AND new_contacts < 10
     AND COALESCE(new_first, '') LIKE '%_seed_%' THEN
    RAISE EXCEPTION
      'Refusing to overwrite hub_store (%) contacts with seed data (%)',
      old_contacts, new_contacts
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hub_store_reject_destructive_seed ON public.hub_store;

CREATE TRIGGER hub_store_reject_destructive_seed
BEFORE UPDATE ON public.hub_store
FOR EACH ROW
EXECUTE FUNCTION public.hub_store_reject_destructive_seed();
