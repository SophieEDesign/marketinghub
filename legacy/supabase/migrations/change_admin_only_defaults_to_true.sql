-- Migration: Change default values for admin_only fields from false to true
-- This makes all new items admin-only by default unless explicitly specified otherwise

-- 1. Change default for interface_groups.is_admin_only
DO $$
BEGIN
  ALTER TABLE public.interface_groups
    ALTER COLUMN is_admin_only SET DEFAULT true;
  
  -- Update comment
  COMMENT ON COLUMN public.interface_groups.is_admin_only IS 'If true, only admins can see and access this interface. If false, all authenticated users can access it. Defaults to true (admin-only).';
END $$;

-- 2. Change default for interface_pages.is_admin_only
DO $$
BEGIN
  ALTER TABLE public.interface_pages
    ALTER COLUMN is_admin_only SET DEFAULT true;
  
  COMMENT ON COLUMN public.interface_pages.is_admin_only IS 'If true, only admins can see and access this page. If false, all authenticated users can access it. Defaults to true (admin-only).';
END $$;

-- 3. Change default for views.is_admin_only
DO $$
BEGIN
  ALTER TABLE public.views
    ALTER COLUMN is_admin_only SET DEFAULT true;
  
  COMMENT ON COLUMN public.views.is_admin_only IS 'If true, only admins can see this interface. If false, all authenticated users can access it. Defaults to true (admin-only).';
END $$;

-- 4. Change default for page_type_templates.admin_only
DO $$
BEGIN
  ALTER TABLE public.page_type_templates
    ALTER COLUMN admin_only SET DEFAULT true;
  
  COMMENT ON COLUMN public.page_type_templates.admin_only IS 'If true, only admins can use this template. Defaults to true (admin-only).';
END $$;
