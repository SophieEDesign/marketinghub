-- One clothing order per person can contain multiple line items (catalogue + manual "Other").
alter table public.merch_orders
  add column if not exists items jsonb not null default '[]'::jsonb;
