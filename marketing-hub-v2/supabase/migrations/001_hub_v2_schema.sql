-- Marketing Hub v2 schema (run in a dedicated Supabase project, not the baserow-app Core Data DB)
-- Apply when you move off the local JSON store (.data/store.json).

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'staff' check (role in ('admin', 'staff', 'media_guest')),
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text default '',
  event_type text default 'Event',
  notes text default '',
  link_url text default '',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  user_name text not null,
  status text not null check (status in ('going', 'maybe', 'not_going')),
  note text default '',
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  channel text default '',
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

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_attendance enable row level security;
alter table public.content_items enable row level security;
alter table public.sponsorships enable row level security;
alter table public.contacts enable row level security;
alter table public.resource_links enable row level security;

-- Staff can read/write all hub tables (tighten later with role checks)
create policy "staff_all_events" on public.events
  for all to authenticated using (true) with check (true);
create policy "staff_all_attendance" on public.event_attendance
  for all to authenticated using (true) with check (true);
create policy "staff_all_content" on public.content_items
  for all to authenticated using (true) with check (true);
create policy "staff_all_sponsorships" on public.sponsorships
  for all to authenticated using (true) with check (true);
create policy "staff_all_contacts" on public.contacts
  for all to authenticated using (true) with check (true);
create policy "staff_all_resources" on public.resource_links
  for all to authenticated using (true) with check (true);
create policy "staff_read_profiles" on public.profiles
  for select to authenticated using (true);
