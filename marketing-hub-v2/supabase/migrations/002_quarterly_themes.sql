-- Quarterly themes hierarchy (Theme → main → offshoot)

create table if not exists public.quarterly_themes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  quarter text not null check (quarter in ('Q1', 'Q2', 'Q3', 'Q4')),
  year int not null,
  status text not null default 'upcoming'
    check (status in ('previous', 'active', 'upcoming')),
  summary text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.theme_main_content (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references public.quarterly_themes (id) on delete cascade,
  title text not null,
  channel text default '',
  owner text default '',
  status text not null default 'idea'
    check (status in ('idea', 'draft', 'review', 'scheduled', 'published')),
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.theme_offshoots (
  id uuid primary key default gen_random_uuid(),
  main_content_id uuid not null references public.theme_main_content (id) on delete cascade,
  title text not null,
  channel text default '',
  owner text default '',
  status text not null default 'idea'
    check (status in ('idea', 'draft', 'review', 'scheduled', 'published')),
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quarterly_themes enable row level security;
alter table public.theme_main_content enable row level security;
alter table public.theme_offshoots enable row level security;

drop policy if exists "staff_all_themes" on public.quarterly_themes;
drop policy if exists "staff_all_theme_mains" on public.theme_main_content;
drop policy if exists "staff_all_theme_offshoots" on public.theme_offshoots;

create policy "staff_all_themes" on public.quarterly_themes
  for all to authenticated using (true) with check (true);
create policy "staff_all_theme_mains" on public.theme_main_content
  for all to authenticated using (true) with check (true);
create policy "staff_all_theme_offshoots" on public.theme_offshoots
  for all to authenticated using (true) with check (true);
