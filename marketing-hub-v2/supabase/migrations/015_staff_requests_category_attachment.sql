-- Asset type category + file attachment on staff requests
alter table public.staff_requests
  add column if not exists category text default '';

alter table public.staff_requests
  add column if not exists attachment_url text default '';

update public.staff_requests
set category = coalesce(category, '')
where category is null;

update public.staff_requests
set attachment_url = coalesce(attachment_url, '')
where attachment_url is null;
