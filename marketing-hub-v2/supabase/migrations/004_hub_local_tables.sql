-- Hub v2 local store mirror tables.
-- Empty greenfield tables from 001/002 are rebuilt with text IDs matching the hub store
-- (sb_… Core imports + seed ids like mrc_seed_1). Adds awards, tasks, merch, staff requests, reports.

create extension if not exists "pgcrypto";

-- Rebuild empty greenfield tables with hub-compatible shapes
drop table if exists public.theme_offshoots cascade;
drop table if exists public.theme_main_content cascade;
drop table if exists public.quarterly_themes cascade;
drop table if exists public.resource_links cascade;
drop table if exists public.contacts cascade;
drop table if exists public.sponsorships cascade;
drop table if exists public.content_items cascade;
drop table if exists public.events cascade;

create table public.events (
  id text primary key,
  title text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  location text default '',
  event_type text default 'Event',
  division text default '',
  notes text default '',
  link_url text default '',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_items (
  id text primary key,
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

create table public.sponsorships (
  id text primary key,
  kind text not null default 'sponsorship'
    check (kind in ('sponsorship', 'membership')),
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

create table public.contacts (
  id text primary key,
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

create table public.resource_links (
  id text primary key,
  title text not null,
  description text default '',
  url text not null,
  category text default 'General',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quarterly_themes (
  id text primary key,
  title text not null,
  quarter text not null check (quarter in ('Q1', 'Q2', 'Q3', 'Q4')),
  year int not null,
  status text not null default 'upcoming'
    check (status in ('previous', 'active', 'upcoming')),
  summary text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.theme_main_content (
  id text primary key,
  theme_id text not null references public.quarterly_themes (id) on delete cascade,
  title text not null,
  channel text default '',
  owner text default '',
  status text not null default 'idea'
    check (status in ('idea', 'draft', 'review', 'scheduled', 'published')),
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.theme_offshoots (
  id text primary key,
  main_content_id text not null references public.theme_main_content (id) on delete cascade,
  title text not null,
  channel text default '',
  owner text default '',
  status text not null default 'idea'
    check (status in ('idea', 'draft', 'review', 'scheduled', 'published')),
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- New hub-local tables
create table if not exists public.award_entries (
  id text primary key,
  title text not null,
  organisation text default '',
  category text default '',
  year int not null default extract(year from now())::int,
  status text not null default 'watching'
    check (status in ('watching', 'entering', 'submitted', 'shortlisted', 'won', 'not_won')),
  ceremony_at date,
  owner text default '',
  event_id text,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hub_tasks (
  id text primary key,
  title text not null,
  details text default '',
  due_date date,
  category text default '',
  status text not null default 'todo'
    check (status in ('todo', 'doing', 'done')),
  owner text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.merch_orders (
  id text primary key,
  item text not null,
  fit text default '' check (fit in ('male', 'female', '')),
  size text default '',
  quantity int not null default 1,
  colour text default '',
  requested_for text default '',
  office text default '',
  needed_by date,
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'ordered', 'delivered', 'cancelled')),
  notes text default '',
  created_by text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_requests (
  id text primary key,
  kind text not null default 'other'
    check (kind in ('asset', 'social_form', 'other')),
  title text not null,
  details text default '',
  requested_by text default '',
  needed_by date,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_links (
  id text primary key,
  title text not null,
  description text default '',
  url text not null default '',
  category text default '',
  tool text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events enable row level security;
alter table public.content_items enable row level security;
alter table public.sponsorships enable row level security;
alter table public.contacts enable row level security;
alter table public.resource_links enable row level security;
alter table public.quarterly_themes enable row level security;
alter table public.theme_main_content enable row level security;
alter table public.theme_offshoots enable row level security;
alter table public.award_entries enable row level security;
alter table public.hub_tasks enable row level security;
alter table public.merch_orders enable row level security;
alter table public.staff_requests enable row level security;
alter table public.report_links enable row level security;

drop policy if exists "staff_all_events" on public.events;
drop policy if exists "staff_all_content" on public.content_items;
drop policy if exists "staff_all_sponsorships" on public.sponsorships;
drop policy if exists "staff_all_contacts" on public.contacts;
drop policy if exists "staff_all_resources" on public.resource_links;
drop policy if exists "staff_all_themes" on public.quarterly_themes;
drop policy if exists "staff_all_theme_mains" on public.theme_main_content;
drop policy if exists "staff_all_theme_offshoots" on public.theme_offshoots;
drop policy if exists "staff_all_award_entries" on public.award_entries;
drop policy if exists "staff_all_hub_tasks" on public.hub_tasks;
drop policy if exists "staff_all_merch_orders" on public.merch_orders;
drop policy if exists "staff_all_staff_requests" on public.staff_requests;
drop policy if exists "staff_all_report_links" on public.report_links;

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
create policy "staff_all_themes" on public.quarterly_themes
  for all to authenticated using (true) with check (true);
create policy "staff_all_theme_mains" on public.theme_main_content
  for all to authenticated using (true) with check (true);
create policy "staff_all_theme_offshoots" on public.theme_offshoots
  for all to authenticated using (true) with check (true);
create policy "staff_all_award_entries" on public.award_entries
  for all to authenticated using (true) with check (true);
create policy "staff_all_hub_tasks" on public.hub_tasks
  for all to authenticated using (true) with check (true);
create policy "staff_all_merch_orders" on public.merch_orders
  for all to authenticated using (true) with check (true);
create policy "staff_all_staff_requests" on public.staff_requests
  for all to authenticated using (true) with check (true);
create policy "staff_all_report_links" on public.report_links
  for all to authenticated using (true) with check (true);
