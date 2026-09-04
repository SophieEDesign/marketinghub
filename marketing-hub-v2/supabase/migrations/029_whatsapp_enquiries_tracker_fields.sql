-- Expand WhatsApp table to match Peters_May_WhatsApp_Enquiry_Tracker.xlsx columns.

alter table public.whatsapp_enquiries
  add column if not exists sent_to_office_at timestamptz,
  add column if not exists follow_up_at timestamptz,
  add column if not exists company text not null default '',
  add column if not exists category text not null default '',
  add column if not exists vessel_cargo text not null default '',
  add column if not exists dimensions text not null default '',
  add column if not exists declared_value text not null default '',
  add column if not exists preferred_timeframe text not null default '',
  add column if not exists tracker_status text not null default '',
  add column if not exists email_subject text not null default '',
  add column if not exists source text not null default '';

-- Backfill from created_at / raw_payload (excel import).
update public.whatsapp_enquiries
set
  sent_to_office_at = coalesce(sent_to_office_at, created_at),
  follow_up_at = coalesce(
    follow_up_at,
    case
      when nullif(raw_payload->>'follow_up_date', '') is not null
        then (raw_payload->>'follow_up_date')::timestamptz
      else null
    end
  ),
  company = coalesce(nullif(company, ''), coalesce(raw_payload->>'company', '')),
  category = coalesce(nullif(category, ''), coalesce(raw_payload->>'category', '')),
  vessel_cargo = coalesce(nullif(vessel_cargo, ''), coalesce(raw_payload->>'vessel_cargo', '')),
  dimensions = coalesce(nullif(dimensions, ''), coalesce(raw_payload->>'dimensions', '')),
  declared_value = coalesce(
    nullif(declared_value, ''),
    coalesce(raw_payload->>'declared_value', '')
  ),
  preferred_timeframe = coalesce(
    nullif(preferred_timeframe, ''),
    coalesce(raw_payload->>'preferred_timeframe', '')
  ),
  tracker_status = coalesce(
    nullif(tracker_status, ''),
    coalesce(raw_payload->>'excel_status', '')
  ),
  email_subject = coalesce(
    nullif(email_subject, ''),
    coalesce(raw_payload->>'email_subject', '')
  ),
  source = coalesce(
    nullif(source, ''),
    coalesce(raw_payload->>'tracker_source', raw_payload->>'source', '')
  )
where true;

create index if not exists whatsapp_enquiries_tracker_status_idx
  on public.whatsapp_enquiries (tracker_status);

create index if not exists whatsapp_enquiries_follow_up_at_idx
  on public.whatsapp_enquiries (follow_up_at);

comment on table public.whatsapp_enquiries is
  'WhatsApp enquiry tracker (spreadsheet parity). Shown with web enquiries in one Hub tab.';
