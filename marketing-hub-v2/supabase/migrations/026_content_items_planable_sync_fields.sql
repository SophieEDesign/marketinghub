-- Planable link + sync metadata on content_items (matches hub store / export-hub).

alter table public.content_items
  add column if not exists planable_post_id text default '',
  add column if not exists planable_group_id text default '',
  add column if not exists planable_page_ids text[] default '{}',
  add column if not exists last_synced_at timestamptz,
  add column if not exists sync_source text default '';

comment on column public.content_items.planable_post_id is
  'Primary Planable post id (Facebook page when multi-network group).';
comment on column public.content_items.planable_group_id is
  'Planable cross-post groupId — one Hub card for multi-channel posts.';
comment on column public.content_items.planable_page_ids is
  'Planable page ids linked to this piece.';
comment on column public.content_items.last_synced_at is
  'Last successful Planable sync timestamp.';
comment on column public.content_items.sync_source is
  'Who last wrote syncable fields: hub | planable | empty.';
