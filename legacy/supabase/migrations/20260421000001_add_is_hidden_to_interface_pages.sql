-- Add sidebar visibility flag for interface pages
ALTER TABLE public.interface_pages
ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.interface_pages.is_hidden IS
'If true, page remains accessible by direct URL but is hidden from normal sidebar navigation.';
