-- Admin checklist flag: PR outreach to event organisers.
alter table public.events
  add column if not exists reached_out_for_pr_to_organisers boolean not null default false;
