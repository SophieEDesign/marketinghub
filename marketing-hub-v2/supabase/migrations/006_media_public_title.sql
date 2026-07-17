-- Public-facing title for Core Data Media Links Resources (Marketing Hub).
-- Physical table: table_media_1768074185692
-- Field catalogue: public.table_fields (name = public_title)

alter table public.table_media_1768074185692
  add column if not exists public_title text;

insert into public.table_fields (id, table_id, name, type, options, created_at, updated_at)
select
  gen_random_uuid(),
  '54277ab2-2f59-48bc-805a-b149a79f079a'::uuid,
  'public_title',
  'text',
  jsonb_build_object(
    'label', 'Public title',
    'description', 'Shown on the public media gallery. Leave blank to use the internal name.'
  ),
  now(),
  now()
where not exists (
  select 1
  from public.table_fields
  where table_id = '54277ab2-2f59-48bc-805a-b149a79f079a'
    and name = 'public_title'
);
