-- Migration: Create fully dynamic Airtable-style Interface system
-- This migration creates new tables for interfaces, categories, views, and permissions
-- while maintaining backward compatibility with existing views table

-- ============================================================================
-- 1. INTERFACE CATEGORIES (Sidebar sections)
-- ============================================================================
-- Reuse interface_groups as interface_categories (or create new if preferred)
-- For now, we'll create interface_categories as a new table for clarity
CREATE TABLE IF NOT EXISTS public.interface_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT interface_categories_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_interface_categories_position ON public.interface_categories(position);

-- ============================================================================
-- 2. INTERFACES (Primary Pages - separate from views)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.interfaces (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category_id uuid REFERENCES public.interface_categories(id) ON DELETE SET NULL,
  icon text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT interfaces_pkey PRIMARY KEY (id)
);

-- Ensure only one default interface
CREATE UNIQUE INDEX IF NOT EXISTS interfaces_one_default
  ON public.interfaces(is_default)
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_interfaces_category_id ON public.interfaces(category_id);
CREATE INDEX IF NOT EXISTS idx_interfaces_is_default ON public.interfaces(is_default);

-- ============================================================================
-- 3. INTERFACE VIEWS (Junction table: interfaces ↔ views)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.interface_views (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  interface_id uuid NOT NULL REFERENCES public.interfaces(id) ON DELETE CASCADE,
  view_id uuid NOT NULL REFERENCES public.views(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT interface_views_pkey PRIMARY KEY (id),
  CONSTRAINT interface_views_interface_view_unique UNIQUE (interface_id, view_id)
);

CREATE INDEX IF NOT EXISTS idx_interface_views_interface_id ON public.interface_views(interface_id);
CREATE INDEX IF NOT EXISTS idx_interface_views_view_id ON public.interface_views(view_id);
CREATE INDEX IF NOT EXISTS idx_interface_views_position ON public.interface_views(interface_id, position);

-- ============================================================================
-- 4. INTERFACE PERMISSIONS (Role-based access)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.interface_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  interface_id uuid NOT NULL REFERENCES public.interfaces(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'staff', 'member')),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT interface_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT interface_permissions_interface_role_unique UNIQUE (interface_id, role)
);

CREATE INDEX IF NOT EXISTS idx_interface_permissions_interface_id ON public.interface_permissions(interface_id);
CREATE INDEX IF NOT EXISTS idx_interface_permissions_role ON public.interface_permissions(role);

-- ============================================================================
-- 5. MIGRATE EXISTING DATA
-- ============================================================================
-- Migrate existing interface views (type='interface') to new interfaces table
DO $$
DECLARE
  interface_view RECORD;
  default_category_id uuid;
BEGIN
  -- Create default category if it doesn't exist
  INSERT INTO public.interface_categories (name, icon, position)
  VALUES ('Default', '📄', 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO default_category_id;
  
  -- If no default category was created, get existing one
  IF default_category_id IS NULL THEN
    SELECT id INTO default_category_id FROM public.interface_categories ORDER BY position ASC LIMIT 1;
  END IF;

  -- Migrate each interface view to a new interface
  FOR interface_view IN 
    SELECT v.*, vg.group_id 
    FROM public.views v
    LEFT JOIN public.views vg ON v.group_id = vg.id
    WHERE v.type = 'interface'
  LOOP
    -- Create interface from view
    INSERT INTO public.interfaces (id, name, description, category_id, icon, is_default, created_at, updated_at)
    VALUES (
      interface_view.id,
      interface_view.name,
      NULL, -- description can be added later
      COALESCE(interface_view.group_id, default_category_id),
      NULL, -- icon can be added later
      COALESCE((SELECT is_default FROM public.views WHERE id = interface_view.id), false),
      interface_view.created_at,
      COALESCE(interface_view.updated_at, interface_view.created_at)
    )
    ON CONFLICT (id) DO NOTHING;

    -- Migrate permissions (is_admin_only -> interface_permissions)
    IF interface_view.is_admin_only = true THEN
      INSERT INTO public.interface_permissions (interface_id, role)
      VALUES (interface_view.id, 'admin')
      ON CONFLICT (interface_id, role) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

-- Interface Categories
ALTER TABLE public.interface_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read interface categories" ON public.interface_categories;
DROP POLICY IF EXISTS "Allow authenticated users to manage interface categories" ON public.interface_categories;

CREATE POLICY "Allow authenticated users to read interface categories"
  ON public.interface_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage interface categories"
  ON public.interface_categories FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Interfaces
ALTER TABLE public.interfaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read interfaces" ON public.interfaces;
DROP POLICY IF EXISTS "Allow authenticated users to manage interfaces" ON public.interfaces;

CREATE POLICY "Allow authenticated users to read interfaces"
  ON public.interfaces FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage interfaces"
  ON public.interfaces FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Interface Views
ALTER TABLE public.interface_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read interface views" ON public.interface_views;
DROP POLICY IF EXISTS "Allow authenticated users to manage interface views" ON public.interface_views;

CREATE POLICY "Allow authenticated users to read interface views"
  ON public.interface_views FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage interface views"
  ON public.interface_views FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Interface Permissions
ALTER TABLE public.interface_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read interface permissions" ON public.interface_permissions;
DROP POLICY IF EXISTS "Allow authenticated users to manage interface permissions" ON public.interface_permissions;

CREATE POLICY "Allow authenticated users to read interface permissions"
  ON public.interface_permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage interface permissions"
  ON public.interface_permissions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 7. UPDATE TRIGGERS
-- ============================================================================

-- Update trigger for interface_categories
CREATE OR REPLACE FUNCTION update_interface_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_interface_categories_updated_at ON public.interface_categories;
CREATE TRIGGER update_interface_categories_updated_at
  BEFORE UPDATE ON public.interface_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_interface_categories_updated_at();

-- Update trigger for interfaces
CREATE OR REPLACE FUNCTION update_interfaces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_interfaces_updated_at ON public.interfaces;
CREATE TRIGGER update_interfaces_updated_at
  BEFORE UPDATE ON public.interfaces
  FOR EACH ROW
  EXECUTE FUNCTION update_interfaces_updated_at();

-- ============================================================================
-- 8. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.interface_categories IS 'Categories for organizing interfaces in the sidebar (e.g., Marketing, Social Media, Reporting)';
COMMENT ON TABLE public.interfaces IS 'Primary interface pages that users navigate to (replaces views with type=interface)';
COMMENT ON TABLE public.interface_views IS 'Junction table linking interfaces to views (allows one interface to have multiple views/tabs)';
COMMENT ON TABLE public.interface_permissions IS 'Role-based permissions for interfaces (admin, staff, member)';

COMMENT ON COLUMN public.interfaces.is_default IS 'Marks an interface as the default landing page (only one can be default)';
COMMENT ON COLUMN public.interface_views.position IS 'Order of views within an interface (for tab ordering)';
