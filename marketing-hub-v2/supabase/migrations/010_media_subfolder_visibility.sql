-- Gallery subfolder visibility for Media Links Resources (Marketing Hub).
-- Physical table: table_media_1768074185692
-- public = visible on /media + external library; internal = staff only.

alter table public.table_media_1768074185692
  add column if not exists subfolder_visibility text;

-- Existing Gallery rows stay public so current external gallery is unchanged.
update public.table_media_1768074185692
set subfolder_visibility = 'public'
where deleted_at is null
  and lower(coalesce(hub_category, '')) = 'gallery'
  and (subfolder_visibility is null or trim(subfolder_visibility) = '');

insert into public.table_fields (id, table_id, name, type, options, created_at, updated_at)
select
  gen_random_uuid(),
  '54277ab2-2f59-48bc-805a-b149a79f079a'::uuid,
  'subfolder_visibility',
  'text',
  jsonb_build_object(
    'label', 'Gallery folder visibility',
    'description', 'For Gallery subfolders: public (external gallery) or internal (staff only).'
  ),
  now(),
  now()
where not exists (
  select 1
  from public.table_fields
  where table_id = '54277ab2-2f59-48bc-805a-b149a79f079a'
    and name = 'subfolder_visibility'
);
