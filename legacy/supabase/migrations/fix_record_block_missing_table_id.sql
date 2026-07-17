-- Fix record blocks missing required table_id
-- This migration fixes blocks that are missing the required table_id config
-- by either inferring it from the page's base_table or deleting invalid blocks

DO $$
DECLARE
  block_record RECORD;
  page_table_id TEXT;
BEGIN
  -- Find all record blocks missing table_id
  FOR block_record IN
    SELECT 
      vb.id as block_id,
      vb.page_id,
      vb.config,
      ip.base_table,
      ip.page_type
    FROM view_blocks vb
    LEFT JOIN interface_pages ip ON ip.id = vb.page_id
    WHERE vb.type = 'record'
      AND (vb.config->>'table_id' IS NULL OR vb.config->>'table_id' = '')
      AND vb.page_id IS NOT NULL
  LOOP
    -- Try to infer table_id from page's base_table (for record_review pages)
    IF block_record.page_type = 'record_review' AND block_record.base_table IS NOT NULL THEN
      -- Update the block config to include table_id from page
      UPDATE view_blocks
      SET config = jsonb_set(
        COALESCE(config, '{}'::jsonb),
        '{table_id}',
        to_jsonb(block_record.base_table)
      )
      WHERE id = block_record.block_id;
      
      RAISE NOTICE 'Fixed block % by setting table_id to % from page base_table', 
        block_record.block_id, block_record.base_table;
    ELSE
      -- If we can't infer table_id, delete the invalid block
      -- This is safer than leaving it in an invalid state
      DELETE FROM view_blocks
      WHERE id = block_record.block_id;
      
      RAISE NOTICE 'Deleted invalid record block % (could not infer table_id)', 
        block_record.block_id;
    END IF;
  END LOOP;
END $$;
