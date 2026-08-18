-- Hub content pipeline: Approved sends social posts to Planable.

alter table public.content_items drop constraint if exists content_items_status_check;
alter table public.content_items add constraint content_items_status_check
  check (status in ('idea', 'draft', 'review', 'approved', 'scheduled', 'published'));

alter table public.theme_main_content drop constraint if exists theme_main_content_status_check;
alter table public.theme_main_content add constraint theme_main_content_status_check
  check (status in ('idea', 'draft', 'review', 'approved', 'scheduled', 'published'));

alter table public.theme_offshoots drop constraint if exists theme_offshoots_status_check;
alter table public.theme_offshoots add constraint theme_offshoots_status_check
  check (status in ('idea', 'draft', 'review', 'approved', 'scheduled', 'published'));
