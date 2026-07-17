-- ============================================================================
-- Migration: Add Standard System Fields to Marketing Hub Tables
-- ============================================================================
-- This migration standardizes system fields across all core database tables
-- to behave consistently (similar to Airtable system fields).
--
-- Standard fields added:
--   - created_at TIMESTAMP WITH TIME ZONE (default: now())
--   - updated_at TIMESTAMP WITH TIME ZONE
--   - created_by UUID (references auth.users.id)
--   - updated_by UUID (references auth.users.id)
--   - status TEXT (default: 'draft')
--   - is_archived BOOLEAN (default: false)
--   - archived_at TIMESTAMP WITH TIME ZONE (nullable)
--
-- This migration is idempotent and safe to re-run.
-- ============================================================================

-- ============================================================================
-- 1. CREATE REUSABLE TRIGGER FUNCTION
-- ============================================================================
-- This function handles both INSERT and UPDATE operations:
--   - On INSERT: sets created_at, updated_at, created_by, updated_by
--   - On UPDATE: updates updated_at and updated_by (preserves created_* fields)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_system_fields()
RETURNS TRIGGER AS $$
DECLARE
  is_system_status_table boolean;
  supports_archival boolean;
BEGIN
  -- Tables that have their own status fields (not system status):
  -- automations: status for automation state ('active', 'paused')
  -- automation_runs: status for run state ('pending', 'running', 'completed', 'failed', 'stopped')
  -- automation_logs: level field instead of status
  -- entity_activity_log: log table, no status or archival needed
  is_system_status_table := NOT (TG_TABLE_NAME IN ('automations', 'automation_runs', 'automation_logs', 'entity_activity_log'));
  supports_archival := NOT (TG_TABLE_NAME = 'entity_activity_log');
  
  IF TG_OP = 'INSERT' THEN
    -- Set timestamps
    IF NEW.created_at IS NULL THEN
      NEW.created_at := now();
    END IF;
    IF NEW.updated_at IS NULL THEN
      NEW.updated_at := now();
    END IF;
    
    -- Set user tracking fields
    IF NEW.created_by IS NULL THEN
      NEW.created_by := auth.uid();
    END IF;
    IF NEW.updated_by IS NULL THEN
      NEW.updated_by := auth.uid();
    END IF;
    
    -- Set default status if not provided (only for tables with system status)
    IF is_system_status_table AND NEW.status IS NULL THEN
      NEW.status := 'draft';
    END IF;
    
    -- Set default is_archived if not provided (only for tables that support archival)
    IF supports_archival AND NEW.is_archived IS NULL THEN
      NEW.is_archived := false;
    END IF;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Always update updated_at and updated_by on UPDATE
    NEW.updated_at := now();
    NEW.updated_by := auth.uid();
    
    -- Preserve created_at and created_by (never overwrite on UPDATE)
    NEW.created_at := OLD.created_at;
    NEW.created_by := OLD.created_by;
    
    -- Handle archived_at: set when is_archived changes from false to true
    -- Only for tables that support archival
    IF supports_archival THEN
      IF OLD.is_archived = false AND NEW.is_archived = true AND NEW.archived_at IS NULL THEN
        NEW.archived_at := now();
      ELSIF OLD.is_archived = true AND NEW.is_archived = false THEN
        NEW.archived_at := NULL;
      END IF;
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. ADD MISSING SYSTEM FIELDS TO CORE TABLES
-- ============================================================================
-- For each table, we check if columns exist before adding them.
-- Only add missing fields to avoid breaking existing data.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Workspaces
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.workspaces 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.workspaces 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.workspaces 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.workspaces 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Profiles
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.profiles 
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.profiles 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.profiles 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.profiles 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.profiles 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- User Roles
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.user_roles 
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.user_roles 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.user_roles 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.user_roles 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.user_roles 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Workspace Settings
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'workspace_settings' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.workspace_settings 
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'workspace_settings' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.workspace_settings 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'workspace_settings' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.workspace_settings 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'workspace_settings' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.workspace_settings 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'workspace_settings' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.workspace_settings 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tables' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.tables 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tables' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.tables 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tables' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.tables 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tables' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.tables 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Table Fields
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'table_fields' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.table_fields 
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'table_fields' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.table_fields 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'table_fields' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.table_fields 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'table_fields' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.table_fields 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'table_fields' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.table_fields 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Table Rows
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'table_rows' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.table_rows 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'table_rows' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.table_rows 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'table_rows' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.table_rows 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Interface Groups
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_groups' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.interface_groups 
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_groups' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.interface_groups 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_groups' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.interface_groups 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_groups' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.interface_groups 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_groups' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.interface_groups 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Views
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'views' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.views 
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'views' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.views 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'views' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.views 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'views' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.views 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'views' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.views 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Grid View Settings
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'grid_view_settings' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.grid_view_settings 
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'grid_view_settings' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.grid_view_settings 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'grid_view_settings' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.grid_view_settings 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'grid_view_settings' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.grid_view_settings 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'grid_view_settings' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.grid_view_settings 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- View Fields
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add created_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_fields' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.view_fields 
      ADD COLUMN created_at timestamp with time zone DEFAULT now();
  END IF;
  
  -- Add updated_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_fields' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.view_fields 
      ADD COLUMN updated_at timestamp with time zone DEFAULT now();
  END IF;
  
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_fields' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.view_fields 
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_fields' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.view_fields 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_fields' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.view_fields 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_fields' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.view_fields 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_fields' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.view_fields 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- View Filters
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add created_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_filters' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.view_filters 
      ADD COLUMN created_at timestamp with time zone DEFAULT now();
  END IF;
  
  -- Add updated_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_filters' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.view_filters 
      ADD COLUMN updated_at timestamp with time zone DEFAULT now();
  END IF;
  
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_filters' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.view_filters 
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_filters' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.view_filters 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_filters' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.view_filters 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_filters' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.view_filters 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_filters' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.view_filters 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- View Sorts
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add created_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_sorts' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.view_sorts 
      ADD COLUMN created_at timestamp with time zone DEFAULT now();
  END IF;
  
  -- Add updated_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_sorts' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.view_sorts 
      ADD COLUMN updated_at timestamp with time zone DEFAULT now();
  END IF;
  
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_sorts' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.view_sorts 
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_sorts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.view_sorts 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_sorts' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.view_sorts 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_sorts' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.view_sorts 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_sorts' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.view_sorts 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- View Tabs
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add created_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_tabs' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.view_tabs 
      ADD COLUMN created_at timestamp with time zone DEFAULT now();
  END IF;
  
  -- Add updated_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_tabs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.view_tabs 
      ADD COLUMN updated_at timestamp with time zone DEFAULT now();
  END IF;
  
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_tabs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.view_tabs 
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_tabs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.view_tabs 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_tabs' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.view_tabs 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_tabs' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.view_tabs 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_tabs' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.view_tabs 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- View Blocks
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_blocks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.view_blocks 
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_blocks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.view_blocks 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_blocks' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.view_blocks 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_blocks' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.view_blocks 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'view_blocks' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.view_blocks 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Interface Categories
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_categories' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.interface_categories 
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_categories' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.interface_categories 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_categories' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.interface_categories 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_categories' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.interface_categories 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_categories' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.interface_categories 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Interfaces
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interfaces' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.interfaces 
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interfaces' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.interfaces 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interfaces' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.interfaces 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interfaces' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.interfaces 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interfaces' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.interfaces 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Interface Pages
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_pages' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.interface_pages 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_pages' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.interface_pages 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_pages' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.interface_pages 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_pages' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.interface_pages 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Interface Views
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add updated_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_views' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.interface_views 
      ADD COLUMN updated_at timestamp with time zone DEFAULT now();
  END IF;
  
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_views' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.interface_views 
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_views' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.interface_views 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_views' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.interface_views 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_views' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.interface_views 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_views' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.interface_views 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Interface Permissions
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add updated_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_permissions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.interface_permissions 
      ADD COLUMN updated_at timestamp with time zone DEFAULT now();
  END IF;
  
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_permissions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.interface_permissions 
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_permissions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.interface_permissions 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_permissions' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.interface_permissions 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_permissions' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.interface_permissions 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'interface_permissions' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.interface_permissions 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Page Type Templates
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'page_type_templates' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.page_type_templates 
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'page_type_templates' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.page_type_templates 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'page_type_templates' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.page_type_templates 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'page_type_templates' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.page_type_templates 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'page_type_templates' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.page_type_templates 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Sidebar Categories
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'sidebar_categories' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.sidebar_categories 
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'sidebar_categories' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.sidebar_categories 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'sidebar_categories' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.sidebar_categories 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'sidebar_categories' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.sidebar_categories 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'sidebar_categories' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.sidebar_categories 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Sidebar Items
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'sidebar_items' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.sidebar_items 
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'sidebar_items' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.sidebar_items 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'sidebar_items' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.sidebar_items 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'sidebar_items' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.sidebar_items 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'sidebar_items' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.sidebar_items 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Automations
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'automations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.automations 
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'automations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.automations 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Note: automations already has a status field, but it's for automation status
  -- We'll add a system status field with a different approach - skip status for automations
  -- as it conflicts with the existing automation status field
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'automations' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.automations 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'automations' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.automations 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Automation Runs
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add updated_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'automation_runs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.automation_runs 
      ADD COLUMN updated_at timestamp with time zone DEFAULT now();
  END IF;
  
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'automation_runs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.automation_runs 
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'automation_runs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.automation_runs 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Note: automation_runs already has a status field for run status
  -- Skip adding system status field to avoid conflict
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'automation_runs' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.automation_runs 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'automation_runs' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.automation_runs 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Automation Logs
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add updated_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'automation_logs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.automation_logs 
      ADD COLUMN updated_at timestamp with time zone DEFAULT now();
  END IF;
  
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'automation_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.automation_logs 
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'automation_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.automation_logs 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Note: automation_logs has a level field, skip adding status to avoid confusion
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'automation_logs' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.automation_logs 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'automation_logs' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.automation_logs 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Entity Version Config
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'entity_version_config' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.entity_version_config 
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'entity_version_config' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.entity_version_config 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'entity_version_config' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.entity_version_config 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'entity_version_config' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.entity_version_config 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'entity_version_config' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.entity_version_config 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Entity Versions
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add updated_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'entity_versions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.entity_versions 
      ADD COLUMN updated_at timestamp with time zone DEFAULT now();
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'entity_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.entity_versions 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'entity_versions' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.entity_versions 
      ADD COLUMN status text DEFAULT 'draft';
  END IF;
  
  -- Add is_archived if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'entity_versions' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.entity_versions 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  -- Add archived_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'entity_versions' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.entity_versions 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Entity Activity Log
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Add updated_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'entity_activity_log' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.entity_activity_log 
      ADD COLUMN updated_at timestamp with time zone DEFAULT now();
  END IF;
  
  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'entity_activity_log' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.entity_activity_log 
      ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add is_archived and archived_at for trigger compatibility
  -- Note: The trigger will not set these values for log tables (supports_archival = false)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'entity_activity_log' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.entity_activity_log 
      ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'entity_activity_log' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.entity_activity_log 
      ADD COLUMN archived_at timestamp with time zone;
  END IF;
  
  -- Note: entity_activity_log is a log table, so status is not added
  -- The trigger will not set is_archived/archived_at for this table
END $$;

-- ============================================================================
-- 3. ATTACH TRIGGERS TO EACH TABLE
-- ============================================================================
-- Drop existing triggers if they exist, then create new ones.
-- This ensures idempotency.
-- ============================================================================

-- Workspaces
DROP TRIGGER IF EXISTS trigger_handle_system_fields_workspaces ON public.workspaces;
CREATE TRIGGER trigger_handle_system_fields_workspaces
  BEFORE INSERT OR UPDATE ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- Profiles
DROP TRIGGER IF EXISTS trigger_handle_system_fields_profiles ON public.profiles;
CREATE TRIGGER trigger_handle_system_fields_profiles
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- User Roles
DROP TRIGGER IF EXISTS trigger_handle_system_fields_user_roles ON public.user_roles;
CREATE TRIGGER trigger_handle_system_fields_user_roles
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- Workspace Settings
DROP TRIGGER IF EXISTS trigger_handle_system_fields_workspace_settings ON public.workspace_settings;
CREATE TRIGGER trigger_handle_system_fields_workspace_settings
  BEFORE INSERT OR UPDATE ON public.workspace_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- Tables
DROP TRIGGER IF EXISTS trigger_handle_system_fields_tables ON public.tables;
CREATE TRIGGER trigger_handle_system_fields_tables
  BEFORE INSERT OR UPDATE ON public.tables
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- Table Fields
DROP TRIGGER IF EXISTS trigger_handle_system_fields_table_fields ON public.table_fields;
CREATE TRIGGER trigger_handle_system_fields_table_fields
  BEFORE INSERT OR UPDATE ON public.table_fields
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- Table Rows
DROP TRIGGER IF EXISTS trigger_handle_system_fields_table_rows ON public.table_rows;
CREATE TRIGGER trigger_handle_system_fields_table_rows
  BEFORE INSERT OR UPDATE ON public.table_rows
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- Interface Groups
DROP TRIGGER IF EXISTS trigger_handle_system_fields_interface_groups ON public.interface_groups;
CREATE TRIGGER trigger_handle_system_fields_interface_groups
  BEFORE INSERT OR UPDATE ON public.interface_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- Views
DROP TRIGGER IF EXISTS trigger_handle_system_fields_views ON public.views;
CREATE TRIGGER trigger_handle_system_fields_views
  BEFORE INSERT OR UPDATE ON public.views
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- Grid View Settings
DROP TRIGGER IF EXISTS trigger_handle_system_fields_grid_view_settings ON public.grid_view_settings;
CREATE TRIGGER trigger_handle_system_fields_grid_view_settings
  BEFORE INSERT OR UPDATE ON public.grid_view_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- View Fields
DROP TRIGGER IF EXISTS trigger_handle_system_fields_view_fields ON public.view_fields;
CREATE TRIGGER trigger_handle_system_fields_view_fields
  BEFORE INSERT OR UPDATE ON public.view_fields
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- View Filters
DROP TRIGGER IF EXISTS trigger_handle_system_fields_view_filters ON public.view_filters;
CREATE TRIGGER trigger_handle_system_fields_view_filters
  BEFORE INSERT OR UPDATE ON public.view_filters
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- View Sorts
DROP TRIGGER IF EXISTS trigger_handle_system_fields_view_sorts ON public.view_sorts;
CREATE TRIGGER trigger_handle_system_fields_view_sorts
  BEFORE INSERT OR UPDATE ON public.view_sorts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- View Tabs
DROP TRIGGER IF EXISTS trigger_handle_system_fields_view_tabs ON public.view_tabs;
CREATE TRIGGER trigger_handle_system_fields_view_tabs
  BEFORE INSERT OR UPDATE ON public.view_tabs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- View Blocks
DROP TRIGGER IF EXISTS trigger_handle_system_fields_view_blocks ON public.view_blocks;
CREATE TRIGGER trigger_handle_system_fields_view_blocks
  BEFORE INSERT OR UPDATE ON public.view_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- Interface Categories
DROP TRIGGER IF EXISTS trigger_handle_system_fields_interface_categories ON public.interface_categories;
CREATE TRIGGER trigger_handle_system_fields_interface_categories
  BEFORE INSERT OR UPDATE ON public.interface_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- Interfaces
DROP TRIGGER IF EXISTS trigger_handle_system_fields_interfaces ON public.interfaces;
CREATE TRIGGER trigger_handle_system_fields_interfaces
  BEFORE INSERT OR UPDATE ON public.interfaces
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- Interface Pages
DROP TRIGGER IF EXISTS trigger_handle_system_fields_interface_pages ON public.interface_pages;
CREATE TRIGGER trigger_handle_system_fields_interface_pages
  BEFORE INSERT OR UPDATE ON public.interface_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- Interface Views
DROP TRIGGER IF EXISTS trigger_handle_system_fields_interface_views ON public.interface_views;
CREATE TRIGGER trigger_handle_system_fields_interface_views
  BEFORE INSERT OR UPDATE ON public.interface_views
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- Interface Permissions
DROP TRIGGER IF EXISTS trigger_handle_system_fields_interface_permissions ON public.interface_permissions;
CREATE TRIGGER trigger_handle_system_fields_interface_permissions
  BEFORE INSERT OR UPDATE ON public.interface_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- Page Type Templates
DROP TRIGGER IF EXISTS trigger_handle_system_fields_page_type_templates ON public.page_type_templates;
CREATE TRIGGER trigger_handle_system_fields_page_type_templates
  BEFORE INSERT OR UPDATE ON public.page_type_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- Sidebar Categories
DROP TRIGGER IF EXISTS trigger_handle_system_fields_sidebar_categories ON public.sidebar_categories;
CREATE TRIGGER trigger_handle_system_fields_sidebar_categories
  BEFORE INSERT OR UPDATE ON public.sidebar_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- Sidebar Items
DROP TRIGGER IF EXISTS trigger_handle_system_fields_sidebar_items ON public.sidebar_items;
CREATE TRIGGER trigger_handle_system_fields_sidebar_items
  BEFORE INSERT OR UPDATE ON public.sidebar_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- Automations
DROP TRIGGER IF EXISTS trigger_handle_system_fields_automations ON public.automations;
CREATE TRIGGER trigger_handle_system_fields_automations
  BEFORE INSERT OR UPDATE ON public.automations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- Automation Runs
DROP TRIGGER IF EXISTS trigger_handle_system_fields_automation_runs ON public.automation_runs;
CREATE TRIGGER trigger_handle_system_fields_automation_runs
  BEFORE INSERT OR UPDATE ON public.automation_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- Automation Logs
DROP TRIGGER IF EXISTS trigger_handle_system_fields_automation_logs ON public.automation_logs;
CREATE TRIGGER trigger_handle_system_fields_automation_logs
  BEFORE INSERT OR UPDATE ON public.automation_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- Entity Version Config
DROP TRIGGER IF EXISTS trigger_handle_system_fields_entity_version_config ON public.entity_version_config;
CREATE TRIGGER trigger_handle_system_fields_entity_version_config
  BEFORE INSERT OR UPDATE ON public.entity_version_config
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- Entity Versions
DROP TRIGGER IF EXISTS trigger_handle_system_fields_entity_versions ON public.entity_versions;
CREATE TRIGGER trigger_handle_system_fields_entity_versions
  BEFORE INSERT OR UPDATE ON public.entity_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- Entity Activity Log
DROP TRIGGER IF EXISTS trigger_handle_system_fields_entity_activity_log ON public.entity_activity_log;
CREATE TRIGGER trigger_handle_system_fields_entity_activity_log
  BEFORE INSERT OR UPDATE ON public.entity_activity_log
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_fields();

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

