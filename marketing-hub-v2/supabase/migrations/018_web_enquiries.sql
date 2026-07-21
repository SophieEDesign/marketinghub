-- Web enquiries from WordPress P&M Quote Builder webhook ingest.

create table if not exists public.web_enquiries (
  id text primary key,
  submission_id text not null unique,
  created_at timestamptz,
  customer_name text default '',
  customer_email text default '',
  customer_phone text default '',
  customer_country text default '',
  final_service_category text default '',
  user_selected_service text default '',
  collection_location text default '',
  delivery_location text default '',
  selected_office text default '',
  office_email text default '',
  needs_manual_review boolean not null default false,
  marketing_emails_consent boolean not null default false,
  routing_reason text default '',
  is_test boolean not null default false,
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'done')),
  make_fields jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists web_enquiries_created_at_idx
  on public.web_enquiries (created_at desc nulls last);

create index if not exists web_enquiries_received_at_idx
  on public.web_enquiries (received_at desc);

create index if not exists web_enquiries_status_idx
  on public.web_enquiries (status);

create index if not exists web_enquiries_is_test_idx
  on public.web_enquiries (is_test);

alter table public.web_enquiries enable row level security;

drop policy if exists "hub_staff_web_enquiries" on public.web_enquiries;

-- Authenticated hub staff can read/update; ingest uses service role (bypasses RLS).
create policy "hub_staff_web_enquiries" on public.web_enquiries
  for all to authenticated
  using (public.is_hub_staff())
  with check (public.is_hub_staff());
