-- WhatsApp enquiries in their own table (shown with web enquiries in one Hub tab).

create table if not exists public.whatsapp_enquiries (
  id text primary key,
  external_id text not null unique,
  created_at timestamptz,
  customer_name text default '',
  customer_email text default '',
  customer_phone text default '',
  customer_country text default '',
  service text default '',
  collection_location text default '',
  delivery_location text default '',
  selected_office text default '',
  office_email text default '',
  message text default '',
  notes text default '',
  needs_manual_review boolean not null default true,
  is_test boolean not null default false,
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'done')),
  raw_payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_enquiries_created_at_idx
  on public.whatsapp_enquiries (created_at desc nulls last);

create index if not exists whatsapp_enquiries_received_at_idx
  on public.whatsapp_enquiries (received_at desc);

create index if not exists whatsapp_enquiries_status_idx
  on public.whatsapp_enquiries (status);

create index if not exists whatsapp_enquiries_is_test_idx
  on public.whatsapp_enquiries (is_test);

alter table public.whatsapp_enquiries enable row level security;

drop policy if exists "hub_staff_whatsapp_enquiries" on public.whatsapp_enquiries;

-- Authenticated hub staff can read/update; ingest uses service role (bypasses RLS).
create policy "hub_staff_whatsapp_enquiries" on public.whatsapp_enquiries
  for all to authenticated
  using (public.is_hub_staff())
  with check (public.is_hub_staff());

-- Revert shared-table experiment: WhatsApp no longer lives on web_enquiries.
alter table public.web_enquiries drop constraint if exists web_enquiries_channel_check;
drop index if exists public.web_enquiries_channel_idx;
alter table public.web_enquiries drop column if exists channel;
