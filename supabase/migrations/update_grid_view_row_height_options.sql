ALTER TABLE grid_view_settings
  DROP CONSTRAINT IF EXISTS grid_view_settings_row_height_check;

ALTER TABLE grid_view_settings
  ALTER COLUMN row_height SET DEFAULT 'standard';

ALTER TABLE grid_view_settings
  ADD CONSTRAINT grid_view_settings_row_height_check
  CHECK (
    row_height IN (
      'compact',
      'standard',
      'large',
      'extra_large',
      'short',
      'medium',
      'tall',
      'comfortable'
    )
  );
