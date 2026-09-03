-- Unlisted "anyone with the link" shares for Gallery subfolders.
-- Tokens live here so empty folders can still get a share link; item
-- visibility remains on table_media (cascaded via set_subfolder_visibility).

create table if not exists public.gallery_folder_shares (
  subfolder text primary key,
  share_token text not null unique,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.gallery_folder_shares is
  'Unlisted share links for Gallery subfolders (accessible with token only).';

create index if not exists gallery_folder_shares_token_idx
  on public.gallery_folder_shares (share_token);

alter table public.gallery_folder_shares enable row level security;
