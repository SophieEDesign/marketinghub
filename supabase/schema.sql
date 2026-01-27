-- ============================================================================
-- Marketing Hub Database Schema
-- ============================================================================
-- This schema represents the complete database structure for the Marketing Hub.
-- Tables are organized by dependency order for clarity.
-- 
-- NOTE: This schema uses IF NOT EXISTS to allow safe re-execution.
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.
-- ============================================================================

-- ============================================================================
-- Core Tables (No dependencies)
-- ============================================================================

-- Workspaces: Top-level organization containers
CREATE TABLE IF NOT EXISTS public.workspaces (
  id text NOT NULL DEFAULT 'default'::text,
  name text NOT NULL DEFAULT 'Marketing Hub'::text,
  icon text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT workspaces_pkey PRIMARY KEY (id),
  CONSTRAINT workspaces_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT workspaces_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- Profiles: User profile information
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  role text NOT NULL CHECK (role = ANY (ARRAY['admin'::text, 'member'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT profiles_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT profiles_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- User Roles: Additional role management
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  role text NOT NULL CHECK (role = ANY (ARRAY['admin'::text, 'editor'::text, 'viewer'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT user_roles_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- Workspace Settings: Branding and workspace configuration
CREATE TABLE IF NOT EXISTS public.workspace_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid UNIQUE,
  brand_name text,
  logo_url text,
  primary_color text,
  accent_color text,
  default_interface_id uuid,
  sidebar_color text,
  sidebar_text_color text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT workspace_settings_pkey PRIMARY KEY (id),
  CONSTRAINT workspace_settings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT workspace_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- Index for default_interface_id lookups
CREATE INDEX IF NOT EXISTS idx_workspace_settings_default_interface 
  ON public.workspace_settings(default_interface_id);

-- ============================================================================
-- Table System
-- ============================================================================

-- Tables: Base table definitions
CREATE TABLE IF NOT EXISTS public.tables (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  supabase_table text NOT NULL,
  description text DEFAULT ''::text,
  category text,
  -- Primary field used as the record label (internal DB-safe field name) or 'id'.
  -- NULL means "auto": first non-system field by position/order.
  primary_field_name text,
  access_control text DEFAULT 'authenticated'::text CHECK (access_control = ANY (ARRAY['public'::text, 'authenticated'::text, 'role-based'::text, 'owner'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT tables_pkey PRIMARY KEY (id),
  CONSTRAINT tables_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT tables_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- Table Fields: Field definitions for tables
CREATE TABLE IF NOT EXISTS public.table_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['text'::text, 'long_text'::text, 'number'::text, 'percent'::text, 'currency'::text, 'date'::text, 'single_select'::text, 'multi_select'::text, 'checkbox'::text, 'attachment'::text, 'link_to_table'::text, 'formula'::text, 'lookup'::text, 'url'::text, 'email'::text, 'json'::text])),
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  order_index integer NOT NULL DEFAULT 0 CHECK (order_index >= 0),
  group_name text,
  required boolean DEFAULT false,
  default_value jsonb,
  options jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT table_fields_pkey PRIMARY KEY (id),
  CONSTRAINT table_fields_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id),
  CONSTRAINT table_fields_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT table_fields_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- Table Rows: Dynamic row data stored as JSONB
CREATE TABLE IF NOT EXISTS public.table_rows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT table_rows_pkey PRIMARY KEY (id),
  CONSTRAINT table_rows_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id),
  CONSTRAINT table_rows_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT table_rows_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- ============================================================================
-- View System
-- ============================================================================

-- Interface Groups: Groups for organizing views and pages
CREATE TABLE IF NOT EXISTS public.interface_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid,
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0 CHECK (order_index >= 0),
  collapsed boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  is_admin_only boolean NOT NULL DEFAULT true,
  icon text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT interface_groups_pkey PRIMARY KEY (id),
  CONSTRAINT interface_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT interface_groups_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- Views: Different ways to display table data
CREATE TABLE IF NOT EXISTS public.views (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  table_id uuid,
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['grid'::text, 'kanban'::text, 'calendar'::text, 'form'::text, 'interface'::text, 'gallery'::text, 'timeline'::text, 'horizontal_grouped'::text])),
  description text,
  config jsonb DEFAULT '{}'::jsonb,
  access_level text NOT NULL DEFAULT 'authenticated'::text,
  allowed_roles text[] DEFAULT ARRAY['admin']::text[],
  owner_id uuid,
  public_share_id uuid DEFAULT gen_random_uuid(),
  is_default boolean DEFAULT false,
  group_id uuid,
  order_index integer NOT NULL DEFAULT 0 CHECK (order_index >= 0),
  is_admin_only boolean NOT NULL DEFAULT true,
  default_view uuid,
  hide_view_switcher boolean NOT NULL DEFAULT false,
  page_type text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT views_pkey PRIMARY KEY (id),
  CONSTRAINT views_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id),
  CONSTRAINT views_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.interface_groups(id),
  CONSTRAINT views_default_view_fkey FOREIGN KEY (default_view) REFERENCES public.views(id),
  CONSTRAINT views_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT views_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- Unique indexes for views to prevent duplicate names
-- Prevent duplicate view names within the same table (when table_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_views_table_name 
ON public.views(table_id, name) 
WHERE table_id IS NOT NULL AND NOT is_archived;

-- Prevent duplicate view names within the same group (when group_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_views_group_name 
ON public.views(group_id, name) 
WHERE group_id IS NOT NULL AND NOT is_archived;

-- Grid View Settings: Specific settings for grid views
CREATE TABLE IF NOT EXISTS public.grid_view_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  view_id uuid NOT NULL UNIQUE,
  group_by_field text,
  group_by_rules jsonb DEFAULT NULL,
  column_widths jsonb DEFAULT '{}'::jsonb,
  column_order jsonb DEFAULT '[]'::jsonb,
  column_wrap_text jsonb DEFAULT '{}'::jsonb,
  row_heights jsonb DEFAULT '{}'::jsonb,
  row_height text DEFAULT 'medium'::text CHECK (row_height = ANY (ARRAY['short'::text, 'medium'::text, 'tall'::text])),
  frozen_columns integer DEFAULT 0 CHECK (frozen_columns >= 0),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT grid_view_settings_pkey PRIMARY KEY (id),
  CONSTRAINT grid_view_settings_view_id_fkey FOREIGN KEY (view_id) REFERENCES public.views(id),
  CONSTRAINT grid_view_settings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT grid_view_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- View Fields: Field visibility and ordering in views
CREATE TABLE IF NOT EXISTS public.view_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  view_id uuid,
  field_name text NOT NULL,
  visible boolean DEFAULT true,
  position integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT view_fields_pkey PRIMARY KEY (id),
  CONSTRAINT view_fields_view_id_fkey FOREIGN KEY (view_id) REFERENCES public.views(id),
  CONSTRAINT view_fields_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT view_fields_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- View Filter Groups: Groups of filters with AND/OR logic
CREATE TABLE IF NOT EXISTS public.view_filter_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  view_id uuid NOT NULL,
  condition_type text NOT NULL DEFAULT 'AND'::text CHECK (condition_type = ANY (ARRAY['AND'::text, 'OR'::text])),
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT view_filter_groups_pkey PRIMARY KEY (id),
  CONSTRAINT view_filter_groups_view_id_fkey FOREIGN KEY (view_id) REFERENCES public.views(id)
);

-- View Filters: Filtering rules for views
CREATE TABLE IF NOT EXISTS public.view_filters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  view_id uuid,
  field_name text,
  operator text,
  value text,
  filter_group_id uuid,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT view_filters_pkey PRIMARY KEY (id),
  CONSTRAINT view_filters_view_id_fkey FOREIGN KEY (view_id) REFERENCES public.views(id),
  CONSTRAINT view_filters_filter_group_id_fkey FOREIGN KEY (filter_group_id) REFERENCES public.view_filter_groups(id),
  CONSTRAINT view_filters_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT view_filters_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- View Sorts: Sorting configuration for views
CREATE TABLE IF NOT EXISTS public.view_sorts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  view_id uuid,
  field_name text NOT NULL,
  direction text NOT NULL CHECK (direction = ANY (ARRAY['asc'::text, 'desc'::text])),
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT view_sorts_pkey PRIMARY KEY (id),
  CONSTRAINT view_sorts_view_id_fkey FOREIGN KEY (view_id) REFERENCES public.views(id),
  CONSTRAINT view_sorts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT view_sorts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- Index for ordering sorts within a view
CREATE INDEX IF NOT EXISTS idx_view_sorts_order_index 
ON public.view_sorts(view_id, order_index);

-- View Tabs: Tab organization for views
CREATE TABLE IF NOT EXISTS public.view_tabs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  view_id uuid,
  name text NOT NULL,
  position integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT view_tabs_pkey PRIMARY KEY (id),
  CONSTRAINT view_tabs_view_id_fkey FOREIGN KEY (view_id) REFERENCES public.views(id),
  CONSTRAINT view_tabs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT view_tabs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- View Blocks: Blocks that can be added to views/pages
CREATE TABLE IF NOT EXISTS public.view_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  view_id uuid,
  page_id uuid,
  type text NOT NULL,
  position_x integer NOT NULL DEFAULT 0 CHECK (position_x >= 0),
  position_y integer NOT NULL DEFAULT 0 CHECK (position_y >= 0),
  width integer NOT NULL DEFAULT 4 CHECK (width > 0),
  height integer NOT NULL DEFAULT 4 CHECK (height > 0),
  order_index integer NOT NULL DEFAULT 0,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT view_blocks_pkey PRIMARY KEY (id),
  CONSTRAINT view_blocks_view_id_fkey FOREIGN KEY (view_id) REFERENCES public.views(id),
  CONSTRAINT view_blocks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT view_blocks_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- ============================================================================
-- Interface System
-- ============================================================================

-- Interface Categories: Categories for organizing interfaces
CREATE TABLE IF NOT EXISTS public.interface_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT interface_categories_pkey PRIMARY KEY (id),
  CONSTRAINT interface_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT interface_categories_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- Interfaces: Interface definitions
CREATE TABLE IF NOT EXISTS public.interfaces (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category_id uuid,
  icon text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT interfaces_pkey PRIMARY KEY (id),
  CONSTRAINT interfaces_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.interface_categories(id),
  CONSTRAINT interfaces_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT interfaces_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- Interface Pages: Pages within interfaces
CREATE TABLE IF NOT EXISTS public.interface_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  page_type text NOT NULL CHECK (page_type = ANY (ARRAY['list'::text, 'gallery'::text, 'kanban'::text, 'calendar'::text, 'timeline'::text, 'form'::text, 'dashboard'::text, 'overview'::text, 'record_review'::text, 'content'::text, 'record_view'::text])),
  source_view text,
  base_table text,
  config jsonb DEFAULT '{}'::jsonb,
  group_id uuid CHECK (group_id IS NOT NULL),
  order_index integer DEFAULT 0 CHECK (order_index >= 0),
  saved_view_id uuid,
  dashboard_layout_id uuid,
  form_config_id uuid,
  record_config_id uuid,
  is_admin_only boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT interface_pages_pkey PRIMARY KEY (id),
  CONSTRAINT interface_pages_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.interface_groups(id),
  CONSTRAINT interface_pages_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT interface_pages_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id),
  CONSTRAINT interface_pages_saved_view_id_fkey FOREIGN KEY (saved_view_id) REFERENCES public.views(id)
);

-- Add foreign key constraints that reference interface_pages (after table is created)
DO $$
BEGIN
  -- Add foreign key constraint for workspace_settings.default_interface_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_settings_default_interface_id_fkey'
  ) THEN
    ALTER TABLE public.workspace_settings
    ADD CONSTRAINT workspace_settings_default_interface_id_fkey
    FOREIGN KEY (default_interface_id) REFERENCES public.interface_pages(id);
  END IF;

  -- Add foreign key constraint for view_blocks.page_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'view_blocks_page_id_fkey'
  ) THEN
    ALTER TABLE public.view_blocks
    ADD CONSTRAINT view_blocks_page_id_fkey
    FOREIGN KEY (page_id) REFERENCES public.interface_pages(id);
  END IF;
END $$;

-- Indexes for interface_pages table
CREATE INDEX IF NOT EXISTS idx_interface_pages_group_id ON public.interface_pages(group_id);
CREATE INDEX IF NOT EXISTS idx_interface_pages_group_order ON public.interface_pages(group_id, order_index);
CREATE INDEX IF NOT EXISTS idx_interface_pages_page_type ON public.interface_pages(page_type);
CREATE INDEX IF NOT EXISTS idx_interface_pages_saved_view_id ON public.interface_pages(saved_view_id) WHERE saved_view_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interface_pages_created_by ON public.interface_pages(created_by) WHERE created_by IS NOT NULL;

-- Interface Views: Views associated with interfaces
CREATE TABLE IF NOT EXISTS public.interface_views (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  interface_id uuid NOT NULL,
  view_id uuid NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT interface_views_pkey PRIMARY KEY (id),
  CONSTRAINT interface_views_interface_id_fkey FOREIGN KEY (interface_id) REFERENCES public.interfaces(id),
  CONSTRAINT interface_views_view_id_fkey FOREIGN KEY (view_id) REFERENCES public.views(id),
  CONSTRAINT interface_views_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT interface_views_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- Interface Permissions: Permission settings for interfaces
CREATE TABLE IF NOT EXISTS public.interface_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  interface_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['admin'::text, 'staff'::text, 'member'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT interface_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT interface_permissions_interface_id_fkey FOREIGN KEY (interface_id) REFERENCES public.interfaces(id),
  CONSTRAINT interface_permissions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT interface_permissions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- Page Type Templates: Templates for different page types
CREATE TABLE IF NOT EXISTS public.page_type_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  icon text,
  category text NOT NULL,
  admin_only boolean DEFAULT true,
  default_blocks jsonb DEFAULT '[]'::jsonb,
  allowed_blocks jsonb DEFAULT '[]'::jsonb,
  order_index integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT page_type_templates_pkey PRIMARY KEY (id),
  CONSTRAINT page_type_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT page_type_templates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- ============================================================================
-- Sidebar Navigation
-- ============================================================================

-- Sidebar Categories: Categories for sidebar items
CREATE TABLE IF NOT EXISTS public.sidebar_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT sidebar_categories_pkey PRIMARY KEY (id),
  CONSTRAINT sidebar_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT sidebar_categories_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- Sidebar Items: Individual sidebar navigation items
CREATE TABLE IF NOT EXISTS public.sidebar_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category_id uuid,
  item_type text NOT NULL CHECK (item_type = ANY (ARRAY['table'::text, 'view'::text, 'dashboard'::text, 'link'::text])),
  item_id text NOT NULL,
  label text NOT NULL,
  href text NOT NULL,
  icon text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT sidebar_items_pkey PRIMARY KEY (id),
  CONSTRAINT sidebar_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.sidebar_categories(id),
  CONSTRAINT sidebar_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT sidebar_items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- ============================================================================
-- User Preferences
-- ============================================================================

-- Favorites: User favorites for quick access
CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type = ANY (ARRAY['table'::text, 'page'::text, 'view'::text, 'interface'::text, 'block'::text, 'automation'::text])),
  entity_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT favorites_pkey PRIMARY KEY (id),
  CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Recent Items: Track recently accessed items
CREATE TABLE IF NOT EXISTS public.recent_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type = ANY (ARRAY['table'::text, 'page'::text, 'view'::text, 'interface'::text, 'block'::text, 'automation'::text])),
  entity_id uuid NOT NULL,
  last_opened_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recent_items_pkey PRIMARY KEY (id),
  CONSTRAINT recent_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- ============================================================================
-- Automation System
-- ============================================================================

-- Automations: Automation workflow definitions
CREATE TABLE IF NOT EXISTS public.automations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT ''::text,
  trigger jsonb NOT NULL,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean DEFAULT true,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'paused'::text])),
  trigger_type text,
  trigger_config jsonb DEFAULT '{}'::jsonb,
  table_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT automations_pkey PRIMARY KEY (id),
  CONSTRAINT automations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT automations_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- Automation Runs: Execution history for automations
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text, 'stopped'::text, 'pending'::text])),
  error text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  context jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT automation_runs_pkey PRIMARY KEY (id),
  CONSTRAINT automation_runs_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.automations(id),
  CONSTRAINT automation_runs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT automation_runs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- Automation Logs: Log entries for automation runs
CREATE TABLE IF NOT EXISTS public.automation_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL,
  run_id uuid,
  level text NOT NULL DEFAULT 'info'::text CHECK (level = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text])),
  message text NOT NULL DEFAULT ''::text,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT automation_logs_pkey PRIMARY KEY (id),
  CONSTRAINT automation_logs_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.automations(id),
  CONSTRAINT automation_logs_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.automation_runs(id),
  CONSTRAINT automation_logs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT automation_logs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- ============================================================================
-- Versioning System
-- ============================================================================

-- Entity Version Config: Configuration for versioning entities
CREATE TABLE IF NOT EXISTS public.entity_version_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type = ANY (ARRAY['interface'::text, 'page'::text, 'view'::text, 'block'::text, 'automation'::text])),
  entity_id uuid NOT NULL,
  max_versions integer NOT NULL DEFAULT 25 CHECK (max_versions > 0),
  auto_save_enabled boolean NOT NULL DEFAULT true,
  auto_save_interval_seconds integer NOT NULL DEFAULT 60 CHECK (auto_save_interval_seconds > 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT entity_version_config_pkey PRIMARY KEY (id),
  CONSTRAINT entity_version_config_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT entity_version_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- Entity Versions: Version snapshots of entities
CREATE TABLE IF NOT EXISTS public.entity_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type = ANY (ARRAY['interface'::text, 'page'::text, 'view'::text, 'block'::text, 'automation'::text])),
  entity_id uuid NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  snapshot jsonb NOT NULL,
  reason text NOT NULL CHECK (reason = ANY (ARRAY['manual_save'::text, 'autosave'::text, 'rollback'::text, 'restore'::text])),
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  status text DEFAULT 'draft'::text,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT entity_versions_pkey PRIMARY KEY (id),
  CONSTRAINT entity_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT entity_versions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- Entity Activity Log: Activity tracking for entities
CREATE TABLE IF NOT EXISTS public.entity_activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type = ANY (ARRAY['interface'::text, 'page'::text, 'view'::text, 'block'::text, 'automation'::text])),
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action = ANY (ARRAY['create'::text, 'update'::text, 'delete'::text, 'reorder'::text, 'publish'::text, 'unpublish'::text, 'restore'::text, 'duplicate'::text])),
  related_entity_type text,
  related_entity_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  CONSTRAINT entity_activity_log_pkey PRIMARY KEY (id),
  CONSTRAINT entity_activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT entity_activity_log_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- ============================================================================
-- Content Calendar Tables (Dynamic Tables)
-- ============================================================================

-- Content Calendar All: Base table for content calendar
CREATE TABLE IF NOT EXISTS public.content_calendar_all (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT content_calendar_all_pkey PRIMARY KEY (id)
);

-- Table: Briefings
CREATE TABLE IF NOT EXISTS public.table_briefings_1766847886126 (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  name text,
  business_division text,
  deadline timestamp with time zone,
  type_of_content text,
  story_subject_headline text,
  priority text,
  impact text,
  target_audience text,
  key_messages text[],
  whats_the_story text[],
  peters_may_spokesperson_quote text,
  "3rd_party_spokesperson_quote_if_applicable" text,
  contact_for_approval text,
  email_from_contact_for_approval text,
  contact_details_for_3rd_parties_and_partners text,
  is_permission_approval_required_to_write_publish_the_content_fr boolean,
  approval_process text[],
  is_there_photography_video_content_or_other_collateral_to_suppo text,
  do_we_need_permission_to_use_the_visuals_and_if_so_from_whom text,
  will_you_want_the_content_repurposed_for_example_on_your_social boolean,
  notes text[],
  assignee text,
  status text,
  created text,
  created_by_field text,
  content_calendar text,
  CONSTRAINT table_briefings_1766847886126_pkey PRIMARY KEY (id)
);

-- Table: Campaigns
CREATE TABLE IF NOT EXISTS public.table_campaigns_1766847958019 (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  name text,
  notes text,
  assignee text,
  status text,
  content text,
  sponsorships text,
  content_calendar_from_sponsorships text,
  created text,
  CONSTRAINT table_campaigns_1766847958019_pkey PRIMARY KEY (id)
);

-- Table: Contacts
CREATE TABLE IF NOT EXISTS public.table_contacts_1766847128905 (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  name text,
  first_name text,
  last_name text,
  publication text,
  type text,
  status text,
  email text,
  press_field text,
  phone text,
  mobile text,
  job_title text,
  team text,
  responsible_for text,
  notes text,
  company text,
  location text,
  tasks text,
  social_media_posts text[],
  pr_tracker text[],
  events text,
  website text,
  content_calendar text,
  sponsorships text,
  CONSTRAINT table_contacts_1766847128905_pkey PRIMARY KEY (id)
);

-- Table: Content
CREATE TABLE IF NOT EXISTS public.table_content_1767726395418 (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  content_name text,
  content_type text,
  created text,
  date timestamp with time zone,
  date_to timestamp with time zone,
  date_due timestamp with time zone,
  month text,
  year text,
  category text,
  notes_detail text,
  channels text[],
  content_post_text text,
  twitter text,
  instagram text,
  linkedin text,
  content_folder_canva text,
  images text,
  post_originator_approve text,
  status text,
  schedule text,
  last_modified_by text,
  approved_by text,
  image_approved text,
  campaigns text,
  created_by_field text,
  track text,
  sponsorships text,
  website text,
  logo text,
  contacts text,
  publication_from_contacts text,
  priority text,
  owner text,
  documents text,
  link_to_document text,
  briefings text,
  CONSTRAINT table_content_1767726395418_pkey PRIMARY KEY (id)
);

-- Table: Sponsorships
CREATE TABLE IF NOT EXISTS public.table_sponsorships_1766847842576 (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  name text,
  sponsorship_title text,
  perks text,
  notes text[],
  assignee text,
  status text,
  marketing_resources text[],
  website text,
  documents text[],
  document_from_documents text,
  documents_drive text,
  last_modified text,
  content_calendar text[],
  campaigns text,
  contacts text,
  CONSTRAINT table_sponsorships_1766847842576_pkey PRIMARY KEY (id)
);

-- Table: Briefings (newer version)
CREATE TABLE IF NOT EXISTS public.table_briefings_1768073365356 (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  name text,
  business_division text,
  deadline timestamp with time zone,
  type_of_content text,
  story_subject_headline text,
  priority text,
  impact text,
  target_audience text,
  key_messages text,
  whats_the_story text,
  peters_may_spokesperson_quote text,
  "3rd_party_spokesperson_quote_if_applicable" text,
  contact_for_approval text,
  email_from_contact_for_approval text,
  contact_details_for_3rd_parties_and_partners text,
  is_permission_approval_required_to_write_publish_the_content_fr boolean,
  approval_process text[],
  is_there_photography_video_content_or_other_collateral_to_suppo text,
  do_we_need_permission_to_use_the_visuals_and_if_so_from_whom text,
  will_you_want_the_content_repurposed_for_example_on_your_social boolean,
  notes text[],
  assignee text,
  status text,
  created text,
  created_by_field text,
  content_calendar text,
  CONSTRAINT table_briefings_1768073365356_pkey PRIMARY KEY (id)
);

-- Table: Campaigns (newer version)
CREATE TABLE IF NOT EXISTS public.table_campaigns_1768074134170 (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  name text,
  notes text[],
  assignee text,
  status text,
  content text[],
  sponsorships text,
  content_calendar_from_sponsorships text[],
  created text,
  CONSTRAINT table_campaigns_1768074134170_pkey PRIMARY KEY (id)
);

-- Table: Contact (newer version)
CREATE TABLE IF NOT EXISTS public.table_contact_1768073851531 (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  name text,
  first_name text,
  last_name text,
  publication text,
  type text,
  status text,
  email text,
  press_field text,
  phone text,
  mobile text,
  job_title text,
  team text,
  responsible_for text,
  notes text,
  company text,
  location text,
  tasks text,
  social_media_posts text[],
  pr_tracker text[],
  events text,
  website text,
  content_calendar text,
  sponsorships text,
  CONSTRAINT table_contact_1768073851531_pkey PRIMARY KEY (id)
);

-- Table: Content (newer version)
CREATE TABLE IF NOT EXISTS public.table_content_1768242820540 (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  content_name text,
  content_type text,
  created timestamp with time zone,
  date timestamp with time zone,
  date_to timestamp with time zone,
  date_due timestamp with time zone,
  month text,
  year text,
  category text,
  notes_detail text,
  channels text[],
  content_post_text text,
  twitter text,
  instagram text,
  linkedin text,
  content_folder_canva text,
  images jsonb,
  post_originator_approve uuid,
  status text,
  schedule text,
  last_modified_by text,
  approved_by text,
  image_approved text,
  campaigns text,
  created_by_field text,
  track text,
  sponsorships text,
  website text,
  logo text,
  contacts text,
  publication_from_contacts text,
  priority text,
  owner text,
  documents text,
  link_to_document text,
  briefings text,
  CONSTRAINT table_content_1768242820540_pkey PRIMARY KEY (id)
);

-- Table: Media
CREATE TABLE IF NOT EXISTS public.table_media_1768074185692 (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  name text,
  notes text,
  assignee text,
  status text,
  document text,
  sponsorships text,
  content_calendar text,
  document_link text,
  CONSTRAINT table_media_1768074185692_pkey PRIMARY KEY (id)
);

-- Table: Sponsorships (newer version)
CREATE TABLE IF NOT EXISTS public.table_sponsorships_1768074191424 (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  name text,
  sponsorship_title text,
  perks text,
  notes text,
  assignee text,
  status text,
  marketing_resources text[],
  website text,
  documents text[],
  document_from_documents text,
  documents_drive text,
  last_modified text,
  content_calendar text[],
  campaigns text,
  contacts text,
  CONSTRAINT table_sponsorships_1768074191424_pkey PRIMARY KEY (id)
);

-- Table: Strategy
CREATE TABLE IF NOT EXISTS public.table_strategy_1768299847719 (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  theme text,
  CONSTRAINT table_strategy_1768299847719_pkey PRIMARY KEY (id)
);

-- ============================================================================
-- End of Schema
-- ============================================================================
