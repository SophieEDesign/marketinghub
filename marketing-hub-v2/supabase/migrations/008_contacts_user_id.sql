-- Link hub users (auth.users) to contacts so members can edit only their own record.
alter table public.contacts
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create unique index if not exists contacts_user_id_unique
  on public.contacts (user_id)
  where user_id is not null;

comment on column public.contacts.user_id is
  'Optional link to a hub auth user; members edit only their linked contact via My details.';
