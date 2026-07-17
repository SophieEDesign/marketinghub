# Block Defaults Standard

## Overview

This document defines the standard for block defaults and inheritance. All block creation should follow this standard.

## Block Defaults Source

Block defaults are defined in `BLOCK_REGISTRY` (`lib/interface/registry.ts`). This is the **single source of truth** for block defaults.

## Using the Block Defaults API

### Getting Block Defaults

```typescript
import { getBlockDefaults } from '@/lib/core-data/block-defaults'

const defaults = getBlockDefaults('grid')
// Returns: { title: 'Table View', table_id: '' }
```

### Creating Block with Defaults

```typescript
import { createBlockWithDefaults } from '@/lib/core-data/block-defaults'

const config = createBlockWithDefaults('grid', {
  table_id: 'some-table-id',
  // Other overrides
})
```

### Inheriting Settings

```typescript
import { inheritBlockSettings } from '@/lib/core-data/block-defaults'

// Automatically inherits field groupings and section settings
const config = await inheritBlockSettings('list', tableId, baseConfig)
```

## Block Creation Flow

1. **Get defaults** from registry
2. **Apply user overrides** (if any)
3. **Inherit from table** (if `table_id` is set):
   - Field groupings
   - Section settings
   - Default field visibility
4. **Normalize** config
5. **Save** to database

## Inheritance Rules

### Automatic Inheritance

When creating a block with a `table_id`, the system automatically:

1. Gets all sections for the table
2. Gets all fields for the table
3. Groups fields by section
4. Applies section defaults (collapsed, visible, etc.)
5. For list blocks: Auto-applies title field from first section

### Manual Overrides

Users can override inherited settings:
- Field selections
- Section visibility
- Appearance settings

## Block Type Settings

Each block type declares which settings apply:

```typescript
applicableSettings: {
  fields: boolean      // Can select fields
  filters: boolean     // Can set filters
  sorts: boolean       // Can set sorts
  grouping: boolean    // Can group by field
  appearance: boolean  // Can customize appearance
  permissions: boolean // Can set permissions
  conditionalFormatting: boolean // Can use conditional formatting
}
```

## Best Practices

1. **Use registry defaults**: Always use `getBlockDefaults()` or `createBlockWithDefaults()`
2. **Inherit when possible**: Use `inheritBlockSettings()` for data blocks
3. **Don't hardcode defaults**: Never hardcode default values in components
4. **Validate configs**: Use `normalizeBlockConfig()` before saving

## Migration Guide

### Before
```typescript
// Hardcoded defaults
const block = await createBlock(pageId, 'grid', x, y, w, h, {
  title: 'Table View',
  table_id: '',
})
```

### After
```typescript
// Use standardized defaults
import { createBlockWithDefaults, inheritBlockSettings } from '@/lib/core-data/block-defaults'

let config = createBlockWithDefaults('grid', { table_id: 'some-id' })
config = await inheritBlockSettings('grid', 'some-id', config)

const block = await createBlock(pageId, 'grid', x, y, w, h, config)
```
