-- ============================================================================
-- Migration: Schema Audit Plan Implementation
-- Implements remaining items from Schema Audit Report
-- ============================================================================
-- 1. Fix 3rd_party column in legacy table_briefings_1766847886126
-- 2. Add view_blocks CHECK for view_id/page_id mutual exclusivity
-- 3. Resolve interface_groups.workspace_id type (uuid -> text) and add FK
-- ============================================================================

-- ============================================================================
-- 1. Rename invalid column in legacy briefings table
-- ============================================================================
-- fix_schema_integrity_issues only fixes table_briefings_1768073365356.
-- This table (1766847886126) is deprecated but may still exist with invalid column.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'table_briefings_1766847886126'
        AND column_name = '3rd_party_spokesperson_quote_if_applicable'
    ) THEN
        ALTER TABLE public.table_briefings_1766847886126
        RENAME COLUMN "3rd_party_spokesperson_quote_if_applicable" 
        TO third_party_spokesperson_quote_if_applicable;
        
        RAISE NOTICE 'Renamed column 3rd_party_spokesperson_quote_if_applicable in table_briefings_1766847886126';
    END IF;
END $$;

-- ============================================================================
-- 2. Add CHECK constraint: view_blocks must have exactly one of view_id or page_id
-- ============================================================================
-- A block belongs to either a view OR a page, not both and not neither.
-- Fix violating rows: if both set, prefer view_id (clear page_id); if neither, set to first page.

DO $$
DECLARE
    violating_count integer;
BEGIN
    -- Fix rows with both set: prefer view_id, clear page_id
    UPDATE public.view_blocks SET page_id = NULL WHERE view_id IS NOT NULL AND page_id IS NOT NULL;

    -- Fix rows with neither set: assign to first interface page (or skip - would need business rule)
    -- For safety, we only add constraint if no violations remain
    SELECT COUNT(*) INTO violating_count
    FROM public.view_blocks 
    WHERE (view_id IS NULL AND page_id IS NULL) 
       OR (view_id IS NOT NULL AND page_id IS NOT NULL);

    IF violating_count > 0 THEN
        RAISE WARNING 'view_blocks has % rows violating view_id/page_id mutual exclusivity. Fix data before adding constraint.', violating_count;
    ELSIF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'view_blocks_view_or_page_check') THEN
        ALTER TABLE public.view_blocks
        ADD CONSTRAINT view_blocks_view_or_page_check
        CHECK (
            (view_id IS NOT NULL AND page_id IS NULL) OR
            (view_id IS NULL AND page_id IS NOT NULL)
        );
        RAISE NOTICE 'Added view_blocks_view_or_page_check constraint';
    END IF;
END $$;

-- ============================================================================
-- 3. Resolve interface_groups.workspace_id type mismatch
-- ============================================================================
-- workspaces.id is text; interface_groups.workspace_id is uuid. Change to text and add FK.

DO $$
DECLARE
    col_type text;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'interface_groups' AND column_name = 'workspace_id';

    IF col_type = 'uuid' THEN
        -- Drop FK if exists (there shouldn't be one to workspaces)
        ALTER TABLE public.interface_groups DROP CONSTRAINT IF EXISTS interface_groups_workspace_id_fkey;

        -- Drop index before type change (index would be invalidated)
        DROP INDEX IF EXISTS idx_interface_groups_workspace_id;
        DROP INDEX IF EXISTS idx_interface_groups_workspace_order;

        -- Convert: uuid -> text. Map NULL to NULL, non-null to 'default' (workspaces default id)
        ALTER TABLE public.interface_groups
        ALTER COLUMN workspace_id TYPE text
        USING (
            CASE 
                WHEN workspace_id IS NULL THEN NULL
                ELSE 'default'
            END
        );

        -- Add FK to workspaces
        ALTER TABLE public.interface_groups
        ADD CONSTRAINT interface_groups_workspace_id_fkey
        FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;

        -- Recreate indexes
        CREATE INDEX IF NOT EXISTS idx_interface_groups_workspace_id ON public.interface_groups(workspace_id) WHERE workspace_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_interface_groups_workspace_order ON public.interface_groups(workspace_id, order_index) WHERE workspace_id IS NOT NULL;

        RAISE NOTICE 'Converted interface_groups.workspace_id from uuid to text and added FK to workspaces';
    ELSIF col_type = 'character varying' OR col_type = 'text' THEN
        -- Already text, ensure FK exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_schema = 'public' AND table_name = 'interface_groups'
            AND constraint_name = 'interface_groups_workspace_id_fkey'
        ) THEN
            ALTER TABLE public.interface_groups
            ADD CONSTRAINT interface_groups_workspace_id_fkey
            FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;
            RAISE NOTICE 'Added interface_groups.workspace_id FK to workspaces';
        END IF;
    ELSE
        RAISE NOTICE 'interface_groups.workspace_id type is %, skipping conversion', col_type;
    END IF;
END $$;
