-- Allow external hub access role alongside admin/member
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['admin'::text, 'member'::text, 'external'::text]));

COMMENT ON COLUMN public.profiles.role IS 'Hub access: admin (full), member (staff), external (limited/media)';
