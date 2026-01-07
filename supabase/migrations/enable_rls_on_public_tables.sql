-- Migration: Enable RLS on Public Tables
-- This migration addresses Supabase linter warnings about RLS being disabled on public tables
-- Based on Supabase Performance Security Lints report

-- ============================================================================
-- Enable RLS on tables (if not already enabled)
-- ============================================================================

-- 1. Enable RLS on automations table
-- Note: This table already has policies but RLS was not enabled
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'automations'
  ) THEN
    ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 2. Enable RLS on tables table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'tables'
  ) THEN
    ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 3. Enable RLS on views table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'views'
  ) THEN
    ALTER TABLE public.views ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 4. Enable RLS on view_fields table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'view_fields'
  ) THEN
    ALTER TABLE public.view_fields ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 5. Enable RLS on view_sorts table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'view_sorts'
  ) THEN
    ALTER TABLE public.view_sorts ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 6. Enable RLS on view_filters table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'view_filters'
  ) THEN
    ALTER TABLE public.view_filters ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 7. Enable RLS on view_tabs table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'view_tabs'
  ) THEN
    ALTER TABLE public.view_tabs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 8. Enable RLS on view_blocks table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'view_blocks'
  ) THEN
    ALTER TABLE public.view_blocks ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 9. Enable RLS on automation_runs table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'automation_runs'
  ) THEN
    ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================================================
-- Verify RLS is enabled (for debugging)
-- ============================================================================
-- You can check RLS status with:
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('automations', 'tables', 'views', 'view_fields', 'view_sorts', 'view_filters', 'view_tabs', 'view_blocks', 'automation_runs');

COMMENT ON TABLE public.automations IS 'RLS enabled - policies already exist';
COMMENT ON TABLE public.tables IS 'RLS enabled - ensure policies exist';
COMMENT ON TABLE public.views IS 'RLS enabled - ensure policies exist';
COMMENT ON TABLE public.view_fields IS 'RLS enabled - ensure policies exist';
COMMENT ON TABLE public.view_sorts IS 'RLS enabled - ensure policies exist';
COMMENT ON TABLE public.view_filters IS 'RLS enabled - ensure policies exist';
COMMENT ON TABLE public.view_tabs IS 'RLS enabled - ensure policies exist';
COMMENT ON TABLE public.view_blocks IS 'RLS enabled - ensure policies exist';
COMMENT ON TABLE public.automation_runs IS 'RLS enabled - ensure policies exist';

