-- Admin checklist flags on events (mirror of hub_store EventItem fields).
alter table public.events
  add column if not exists social_media_post_completed boolean not null default false;

alter table public.events
  add column if not exists personal_social_media_graphics_completed boolean not null default false;
