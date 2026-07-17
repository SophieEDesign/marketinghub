-- Per-item visibility for Media Links Resources (Marketing Hub).
-- Overrides Gallery folder visibility when set to internal on a public folder.
-- Physical table: table_media_1768074185692

alter table public.table_media_1768074185692
  add column if not exists visibility text;

-- Backfill from folder visibility (Gallery) or public for other hub categories.
update public.table_media_1768074185692
set visibility = case
  when lower(coalesce(hub_category, '')) = 'gallery'
    then coalesce(nullif(trim(subfolder_visibility), ''), 'public')
  else 'public'
end
where deleted_at is null
  and (visibility is null or trim(visibility) = '');

insert into public.table_fields (id, table_id, name, type, options, created_at, updated_at)
select
  gen_random_uuid(),
  '54277ab2-2f59-48bc-805a-b149a79f079a'::uuid,
  'visibility',
  'text',
  jsonb_build_object(
    'label', 'Visibility',
    'description', 'public (external) or internal (staff). For Gallery, overrides folder when internal on a public folder.'
  ),
  now(),
  now()
where not exists (
  select 1
  from public.table_fields
  where table_id = '54277ab2-2f59-48bc-805a-b149a79f079a'
    and name = 'visibility'
);
