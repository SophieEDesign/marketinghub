-- Marketing Hub v2 schema — applied to project Marketing Hub (hwtycgvclhckglmuwnmw).
-- Creates greenfield tables alongside existing Core Data (`table_events`, etc.).
-- Skips `profiles` and `event_attendance` (already present with different shapes).

create extension if not exists "pgcrypto";

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  location text default '',
  event_type text default 'Event',
  notes text default '',
  link_url text default '',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  channel text default '',
  content_type text default 'Social',
  owner text default '',
  due_date date,
  status text not null default 'idea'
    check (status in ('idea', 'draft', 'review', 'scheduled', 'published')),
  planable_url text default '',
  asset_url text default '',
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sponsorships (
  id uuid primary key default gen_random_uuid(),
  partner text not null,
  package_name text default '',
  starts_at date,
  ends_at date,
  value text default '',
  status text not null default 'prospect'
    check (status in ('prospect', 'negotiating', 'confirmed', 'active', 'complete', 'declined')),
  deliverables text default '',
  owner text default '',
  onedrive_url text default '',
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organisation text default '',
  role text default '',
  email text default '',
  phone text default '',
  tags text[] default '{}',
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resource_links (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  url text not null,
  category text default 'General',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events enable row level security;
alter table public.content_items enable row level security;
alter table public.sponsorships enable row level security;
alter table public.contacts enable row level security;
alter table public.resource_links enable row level security;

drop policy if exists "staff_all_events" on public.events;
drop policy if exists "staff_all_content" on public.content_items;
drop policy if exists "staff_all_sponsorships" on public.sponsorships;
drop policy if exists "staff_all_contacts" on public.contacts;
drop policy if exists "staff_all_resources" on public.resource_links;

create policy "staff_all_events" on public.events
  for all to authenticated using (true) with check (true);
create policy "staff_all_content" on public.content_items
  for all to authenticated using (true) with check (true);
create policy "staff_all_sponsorships" on public.sponsorships
  for all to authenticated using (true) with check (true);
create policy "staff_all_contacts" on public.contacts
  for all to authenticated using (true) with check (true);
create policy "staff_all_resources" on public.resource_links
  for all to authenticated using (true) with check (true);
