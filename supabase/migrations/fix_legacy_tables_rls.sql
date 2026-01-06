-- Migration: Fix RLS Policies for Legacy Tables
-- This migration adds RLS policies for legacy tables that were created before RLS was implemented
-- Tables: table_content_1766844903365, table_campaigns_1766847958019, table_contacts_1766847128905, table_sponsorships_1766847842576

-- ============================================================================
-- 1. CONTENT TABLE
-- ============================================================================
DO $$
BEGIN
  -- Enable RLS if table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'table_content_1766844903365'
  ) THEN
    ALTER TABLE public.table_content_1766844903365 ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Authenticated users can view content table" ON public.table_content_1766844903365;
    DROP POLICY IF EXISTS "Authenticated users can insert into content table" ON public.table_content_1766844903365;
    DROP POLICY IF EXISTS "Authenticated users can update content table" ON public.table_content_1766844903365;
    DROP POLICY IF EXISTS "Authenticated users can delete from content table" ON public.table_content_1766844903365;
    
    -- Create policies
    CREATE POLICY "Authenticated users can view content table"
      ON public.table_content_1766844903365 FOR SELECT
      TO authenticated
      USING (true);
    
    CREATE POLICY "Authenticated users can insert into content table"
      ON public.table_content_1766844903365 FOR INSERT
      TO authenticated
      WITH CHECK (true);
    
    CREATE POLICY "Authenticated users can update content table"
      ON public.table_content_1766844903365 FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
    
    CREATE POLICY "Authenticated users can delete from content table"
      ON public.table_content_1766844903365 FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- ============================================================================
-- 2. CAMPAIGNS TABLE
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'table_campaigns_1766847958019'
  ) THEN
    ALTER TABLE public.table_campaigns_1766847958019 ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Authenticated users can view campaigns table" ON public.table_campaigns_1766847958019;
    DROP POLICY IF EXISTS "Authenticated users can insert into campaigns table" ON public.table_campaigns_1766847958019;
    DROP POLICY IF EXISTS "Authenticated users can update campaigns table" ON public.table_campaigns_1766847958019;
    DROP POLICY IF EXISTS "Authenticated users can delete from campaigns table" ON public.table_campaigns_1766847958019;
    
    CREATE POLICY "Authenticated users can view campaigns table"
      ON public.table_campaigns_1766847958019 FOR SELECT
      TO authenticated
      USING (true);
    
    CREATE POLICY "Authenticated users can insert into campaigns table"
      ON public.table_campaigns_1766847958019 FOR INSERT
      TO authenticated
      WITH CHECK (true);
    
    CREATE POLICY "Authenticated users can update campaigns table"
      ON public.table_campaigns_1766847958019 FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
    
    CREATE POLICY "Authenticated users can delete from campaigns table"
      ON public.table_campaigns_1766847958019 FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- ============================================================================
-- 3. CONTACTS TABLE
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'table_contacts_1766847128905'
  ) THEN
    ALTER TABLE public.table_contacts_1766847128905 ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Authenticated users can view contacts table" ON public.table_contacts_1766847128905;
    DROP POLICY IF EXISTS "Authenticated users can insert into contacts table" ON public.table_contacts_1766847128905;
    DROP POLICY IF EXISTS "Authenticated users can update contacts table" ON public.table_contacts_1766847128905;
    DROP POLICY IF EXISTS "Authenticated users can delete from contacts table" ON public.table_contacts_1766847128905;
    
    CREATE POLICY "Authenticated users can view contacts table"
      ON public.table_contacts_1766847128905 FOR SELECT
      TO authenticated
      USING (true);
    
    CREATE POLICY "Authenticated users can insert into contacts table"
      ON public.table_contacts_1766847128905 FOR INSERT
      TO authenticated
      WITH CHECK (true);
    
    CREATE POLICY "Authenticated users can update contacts table"
      ON public.table_contacts_1766847128905 FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
    
    CREATE POLICY "Authenticated users can delete from contacts table"
      ON public.table_contacts_1766847128905 FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- ============================================================================
-- 4. SPONSORSHIPS TABLE
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'table_sponsorships_1766847842576'
  ) THEN
    ALTER TABLE public.table_sponsorships_1766847842576 ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Authenticated users can view sponsorships table" ON public.table_sponsorships_1766847842576;
    DROP POLICY IF EXISTS "Authenticated users can insert into sponsorships table" ON public.table_sponsorships_1766847842576;
    DROP POLICY IF EXISTS "Authenticated users can update sponsorships table" ON public.table_sponsorships_1766847842576;
    DROP POLICY IF EXISTS "Authenticated users can delete from sponsorships table" ON public.table_sponsorships_1766847842576;
    
    CREATE POLICY "Authenticated users can view sponsorships table"
      ON public.table_sponsorships_1766847842576 FOR SELECT
      TO authenticated
      USING (true);
    
    CREATE POLICY "Authenticated users can insert into sponsorships table"
      ON public.table_sponsorships_1766847842576 FOR INSERT
      TO authenticated
      WITH CHECK (true);
    
    CREATE POLICY "Authenticated users can update sponsorships table"
      ON public.table_sponsorships_1766847842576 FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
    
    CREATE POLICY "Authenticated users can delete from sponsorships table"
      ON public.table_sponsorships_1766847842576 FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- ============================================================================
-- 5. BRIEFINGS TABLE (if it exists)
-- ============================================================================
DO $$
DECLARE
  briefings_table_name text;
BEGIN
  SELECT table_name INTO briefings_table_name
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name LIKE 'table_briefings%'
  LIMIT 1;
  
  IF briefings_table_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', briefings_table_name);
    
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can view briefings table" ON public.%I', briefings_table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can insert into briefings table" ON public.%I', briefings_table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can update briefings table" ON public.%I', briefings_table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can delete from briefings table" ON public.%I', briefings_table_name);
    
    EXECUTE format('CREATE POLICY "Authenticated users can view briefings table" ON public.%I FOR SELECT TO authenticated USING (true)', briefings_table_name);
    EXECUTE format('CREATE POLICY "Authenticated users can insert into briefings table" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', briefings_table_name);
    EXECUTE format('CREATE POLICY "Authenticated users can update briefings table" ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', briefings_table_name);
    EXECUTE format('CREATE POLICY "Authenticated users can delete from briefings table" ON public.%I FOR DELETE TO authenticated USING (true)', briefings_table_name);
  END IF;
END $$;

COMMENT ON POLICY "Authenticated users can view content table" ON public.table_content_1766844903365 IS 
  'Allows authenticated users to view all rows in the content table';
COMMENT ON POLICY "Authenticated users can insert into content table" ON public.table_content_1766844903365 IS 
  'Allows authenticated users to insert rows into the content table';
COMMENT ON POLICY "Authenticated users can update content table" ON public.table_content_1766844903365 IS 
  'Allows authenticated users to update rows in the content table';
COMMENT ON POLICY "Authenticated users can delete from content table" ON public.table_content_1766844903365 IS 
  'Allows authenticated users to delete rows from the content table';

