-- Link theme core pieces to content_items (attachments, due dates, Planable, etc.)
alter table public.theme_main_content
  add column if not exists content_id text references public.content_items (id) on delete set null;

create index if not exists theme_main_content_content_id_idx
  on public.theme_main_content (content_id);
