-- Quick fix for record block missing table_id
-- Run this in Supabase SQL Editor to fix the deployment issue immediately
-- This will either fix the block by inferring table_id from the page, or delete it if invalid

-- Fix or delete the specific block that's causing the error
DO $$
DECLARE
  block_id_to_fix UUID := 'fd70c594-68c6-4273-b9cb-3b68155c6f2b';
  page_table_id TEXT;
  page_id_val UUID;
  page_type_val TEXT;
BEGIN
  -- Get the page info for this block
  SELECT 
    vb.page_id,
    ip.base_table,
    ip.page_type
  INTO page_id_val, page_table_id, page_type_val
  FROM view_blocks vb
  LEFT JOIN interface_pages ip ON ip.id = vb.page_id
  WHERE vb.id = block_id_to_fix
    AND vb.page_id IS NOT NULL;
  
  -- If we found the block and can infer table_id, fix it
  IF page_table_id IS NOT NULL AND page_type_val = 'record_review' THEN
    UPDATE view_blocks
    SET config = jsonb_set(
      COALESCE(config, '{}'::jsonb),
      '{table_id}',
      to_jsonb(page_table_id)
    )
    WHERE id = block_id_to_fix;
    
    RAISE NOTICE 'Fixed block % by setting table_id to %', block_id_to_fix, page_table_id;
  ELSE
    -- If we can't infer table_id, delete the invalid block
    DELETE FROM view_blocks
    WHERE id = block_id_to_fix;
    
    RAISE NOTICE 'Deleted invalid record block % (could not infer table_id)', block_id_to_fix;
  END IF;
END $$;
