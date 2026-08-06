-- Link clothing orders to a Contacts row (optional). When that contact has
-- user_id set, the order can be allocated to the linked hub member.
alter table public.merch_orders
  add column if not exists requested_for_contact_id text;

create index if not exists merch_orders_requested_for_contact_id_idx
  on public.merch_orders (requested_for_contact_id)
  where requested_for_contact_id is not null;
