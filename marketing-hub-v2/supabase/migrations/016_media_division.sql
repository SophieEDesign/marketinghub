-- Division tagging for Media Links Resources (Marketing Hub Library).
-- Physical table: table_media_1768074185692

alter table public.table_media_1768074185692
  add column if not exists division text;

update public.table_media_1768074185692
set division = 'All'
where deleted_at is null
  and (division is null or trim(division) = '');

insert into public.table_fields (id, table_id, name, type, options, created_at, updated_at)
select
  gen_random_uuid(),
  '54277ab2-2f59-48bc-805a-b149a79f079a'::uuid,
  'division',
  'text',
  jsonb_build_object(
    'label', 'Division',
    'description', 'Business division: All, Racing, Commercial, Leisure, Forwarding, CMT'
  ),
  now(),
  now()
where not exists (
  select 1
  from public.table_fields
  where table_id = '54277ab2-2f59-48bc-805a-b149a79f079a'
    and name = 'division'
);
