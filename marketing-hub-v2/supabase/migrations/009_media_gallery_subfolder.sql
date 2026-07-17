-- Gallery subfolder for Media Links Resources (Marketing Hub).
-- Physical table: table_media_1768074185692
-- Groups images under Folder = Gallery.

alter table public.table_media_1768074185692
  add column if not exists subfolder text;

insert into public.table_fields (id, table_id, name, type, options, created_at, updated_at)
select
  gen_random_uuid(),
  '54277ab2-2f59-48bc-805a-b149a79f079a'::uuid,
  'subfolder',
  'text',
  jsonb_build_object(
    'label', 'Gallery subfolder',
    'description', 'Optional folder under Gallery to group images (e.g. Yacht loads, Events).'
  ),
  now(),
  now()
where not exists (
  select 1
  from public.table_fields
  where table_id = '54277ab2-2f59-48bc-805a-b149a79f079a'
    and name = 'subfolder'
);
