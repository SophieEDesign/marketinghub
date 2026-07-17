-- Durable JSON hub store (replaces ephemeral /tmp store.json on Vercel).
-- Service role reads/writes; authenticated users have no direct access.

create table if not exists public.hub_store (
  id text primary key default 'default',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.hub_store is
  'Marketing Hub v2 durable store snapshot. App uses service role only.';

alter table public.hub_store enable row level security;

-- No policies for authenticated/anon — access is service-role only.
drop policy if exists "hub_store_deny_all" on public.hub_store;

-- Tighten greenfield v2 tables: require admin/member profile (not any authenticated).
-- External users and bare authenticated accounts lose blanket write access via Data API.

create or replace function public.is_hub_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and coalesce(p.is_archived, false) = false
      and p.role in ('admin', 'member')
  );
$$;

revoke all on function public.is_hub_staff() from public;
grant execute on function public.is_hub_staff() to authenticated;

drop policy if exists "staff_all_events" on public.events;
drop policy if exists "staff_all_content" on public.content_items;
drop policy if exists "staff_all_sponsorships" on public.sponsorships;
drop policy if exists "staff_all_contacts" on public.contacts;
drop policy if exists "staff_all_resources" on public.resource_links;

create policy "hub_staff_events" on public.events
  for all to authenticated
  using (public.is_hub_staff())
  with check (public.is_hub_staff());

create policy "hub_staff_content" on public.content_items
  for all to authenticated
  using (public.is_hub_staff())
  with check (public.is_hub_staff());

create policy "hub_staff_sponsorships" on public.sponsorships
  for all to authenticated
  using (public.is_hub_staff())
  with check (public.is_hub_staff());

create policy "hub_staff_contacts" on public.contacts
  for all to authenticated
  using (public.is_hub_staff())
  with check (public.is_hub_staff());

create policy "hub_staff_resources" on public.resource_links
  for all to authenticated
  using (public.is_hub_staff())
  with check (public.is_hub_staff());
