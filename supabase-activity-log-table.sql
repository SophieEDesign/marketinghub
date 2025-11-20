-- Create activity_log table for tracking all record changes
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  field_name text,
  old_value jsonb,
  new_value jsonb,
  action text not null,         -- "update", "create", "delete", "automation"
  triggered_by text,            -- "user" | "automation"
  created_at timestamptz default now()
);

-- Create index for faster queries
create index if not exists idx_activity_log_record on activity_log(table_name, record_id);
create index if not exists idx_activity_log_created_at on activity_log(created_at desc);

-- Enable RLS (optional, adjust based on your security needs)
alter table activity_log enable row level security;

-- Policy: Allow all authenticated users to read activity logs
create policy "Allow authenticated users to read activity logs"
  on activity_log for select
  using (true);

-- Policy: Allow system to insert activity logs (adjust based on your auth setup)
create policy "Allow system to insert activity logs"
  on activity_log for insert
  with check (true);

