# Inheritance Model

## Overview

This document describes the inheritance model for settings across fields, sections, and blocks.

## Inheritance Flow

```
Core Data (fields)
    ↓
Section Definitions
    ↓
Block Type Definitions
    ↓
Block Instances
```

## Layer 1: Core Data (Fields)

Fields define the base settings:
- Field type
- Required/optional
- Read-only/editable
- Default value
- Validation rules
- Group assignment (section)

## Layer 2: Section Definitions

Sections inherit from fields and add section-level settings:
- Default collapsed state
- Default visibility
- Section ordering
- Section permissions

## Layer 3: Block Type Definitions

Block types define which settings apply:
- Applicable settings (fields, filters, sorts, etc.)
- Default config
- Excluded settings

## Layer 4: Block Instances

Block instances inherit from all layers:
1. Block type defaults
2. Field groupings from table
3. Section settings
4. User overrides

## Inheritance Rules

### Rule 1: Downstream Inherits by Default

Lower layers automatically inherit from higher layers unless explicitly overridden.

### Rule 2: Overrides are Explicit

When a block instance overrides a setting, it must be explicit:
```typescript
{
  ...inheritedSettings,
  title: "Custom Title", // Explicit override
}
```

### Rule 3: Overrides are Rare

Most blocks should use inherited settings. Overrides should only be used for:
- Truly unique behavior
- Optional extensions
- User customization

### Rule 4: Overrides are Visible

All overrides are stored in block config and can be audited.

## Example: List Block Creation

### Step 1: Get Block Type Defaults

```typescript
const defaults = getBlockDefaults('list')
// { title: 'List View', table_id: '', view_type: 'grid' }
```

### Step 2: Apply User Overrides

```typescript
const withOverrides = createBlockWithDefaults('list', {
  table_id: 'some-table-id',
})
```

### Step 3: Inherit from Table

```typescript
const withInheritance = await inheritBlockSettings('list', 'some-table-id', withOverrides)
// Automatically:
// - Gets table sections
// - Gets table fields
// - Groups fields by section
// - Applies section defaults
// - Auto-applies title field from first section
```

### Step 4: Final Config

```typescript
{
  title: 'List View',           // From block type
  table_id: 'some-table-id',    // User override
  view_type: 'grid',            // From block type
  list_title_field: 'Name',     // Inherited from first section
  // ... other inherited settings
}
```

## Benefits

1. **Automatic Configuration**: Blocks are correct by default
2. **Consistency**: All blocks follow the same inheritance rules
3. **Maintainability**: Changes in core data propagate automatically
4. **Flexibility**: Users can still override when needed
