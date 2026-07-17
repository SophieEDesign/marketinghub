-- ============================================================================
-- Migration: Schema Audit Plan Implementation
-- Implements recommendations from schema analysis report
-- ============================================================================

-- ============================================================================
-- P0: comment_notifications - Add FK and indexes (if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'comment_notifications') THEN
    -- Add FK comment_id -> record_comments if not present
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = 'comment_notifications'
      AND constraint_name = 'comment_notifications_comment_id_fkey'
    ) THEN
      ALTER TABLE public.comment_notifications
        ADD CONSTRAINT comment_notifications_comment_id_fkey
        FOREIGN KEY (comment_id) REFERENCES public.record_comments(id) ON DELETE CASCADE;
      RAISE NOTICE 'Added comment_notifications.comment_id FK';
    END IF;

    -- Add indexes for comment_id and mentioned_user_id
    CREATE INDEX IF NOT EXISTS idx_comment_notifications_comment_id
      ON public.comment_notifications(comment_id);
    CREATE INDEX IF NOT EXISTS idx_comment_notifications_mentioned_user
      ON public.comment_notifications(mentioned_user_id);

    RAISE NOTICE 'Applied comment_notifications fixes';
  ELSE
    RAISE NOTICE 'comment_notifications table does not exist, skipping';
  END IF;
END $$;

-- ============================================================================
-- P1: view_blocks - Optimize block load query with composite indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_view_blocks_page_archived_order
  ON view_blocks(page_id, is_archived, order_index, position_y, position_x)
  WHERE page_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_view_blocks_view_archived_order
  ON view_blocks(view_id, is_archived, order_index, position_y, position_x)
  WHERE view_id IS NOT NULL;

-- ============================================================================
-- P2: interface_pages - base_table lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_interface_pages_base_table
  ON interface_pages(base_table)
  WHERE base_table IS NOT NULL;

-- ============================================================================
-- P3: content_calendar_all - Document purpose
-- ============================================================================

COMMENT ON TABLE public.content_calendar_all IS
  'Stub/placeholder table for content calendar aggregation. Contains only id, created_at, updated_at. Purpose: reserved for future content calendar unified view or migration.';

-- ============================================================================
-- P3: Legacy tables - Deprecation comments
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'table_briefings_1766847886126') THEN
    COMMENT ON TABLE public.table_briefings_1766847886126 IS
      'DEPRECATED: Legacy briefings table. Prefer table_briefings_1768073365356. Plan migration and removal.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'table_campaigns_1766847958019') THEN
    COMMENT ON TABLE public.table_campaigns_1766847958019 IS
      'DEPRECATED: Legacy campaigns table. Prefer table_campaigns_1768074134170. Plan migration and removal.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'table_contacts_1766847128905') THEN
    COMMENT ON TABLE public.table_contacts_1766847128905 IS
      'DEPRECATED: Legacy contacts table. Prefer table_contact_1768073851531. Plan migration and removal.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'table_sponsorships_1766847842576') THEN
    COMMENT ON TABLE public.table_sponsorships_1766847842576 IS
      'DEPRECATED: Legacy sponsorships table. Prefer table_sponsorships_1768074191424. Plan migration and removal.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'table_content_1767726395418') THEN
    COMMENT ON TABLE public.table_content_1767726395418 IS
      'DEPRECATED: Legacy content table. Prefer table_content_1768242820540. Plan migration and removal.';
  END IF;
END $$;

-- ============================================================================
-- P3: Standardize audit fields on legacy tables
-- Applies ensure_audit_fields_for_table to legacy tables missing created_by/updated_by
-- ============================================================================

DO $$
DECLARE
  legacy_tables text[] := ARRAY[
    'table_briefings_1766847886126',
    'table_campaigns_1766847958019',
    'table_contacts_1766847128905',
    'table_sponsorships_1766847842576',
    'table_content_1767726395418'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY legacy_tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      BEGIN
        PERFORM public.ensure_audit_fields_for_table('public', t);
        RAISE NOTICE 'Applied audit fields to %', t;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Could not apply audit fields to %: %', t, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;
