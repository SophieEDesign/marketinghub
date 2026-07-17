-- Logo choice on corporate clothing orders
alter table public.merch_orders
  add column if not exists logo text default 'Commercial';

update public.merch_orders
set logo = 'Commercial'
where logo is null or logo = '';
