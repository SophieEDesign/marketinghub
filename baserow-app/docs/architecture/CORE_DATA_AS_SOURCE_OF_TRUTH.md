# Core Data as Single Source of Truth

## Overview

This document describes the architecture for using core data as the single source of truth for field settings, section settings, and block defaults.

## Core Principle

**If something exists in more than one place, it must be defined in only one place.**

Everything else either:
- Inherits it
- References it
- Or explicitly opts out (rare, deliberate, documented)

## Architecture Layers

### Layer 1: Core Data (Database)

The database is the authoritative source for:
- Field definitions (`table_fields` table)
- Section definitions (`field_sections` table)
- Block instances (`view_blocks` table)

### Layer 2: Core Data APIs

Single source of truth functions for reading and writing:

**Field Settings** (`lib/core-data/field-settings.ts`):
- `getFieldSettings(fieldId)` - Read field settings
- `updateFieldSettings(fieldId, updates)` - Write field settings
- `validateFieldSettings(settings)` - Validate field settings
- `normalizeFieldOptions(options, type)` - Normalize field options

**Section Settings** (`lib/core-data/section-settings.ts`):
- `getSectionSettings(tableId, sectionName)` - Read section settings
- `getTableSections(tableId)` - Get all sections for a table
- `upsertSectionSettings(tableId, sectionName, updates)` - Create/update section
- `ensureSectionExists(tableId, sectionName)` - Ensure section exists

**Block Defaults** (`lib/core-data/block-defaults.ts`):
- `getBlockDefaults(type)` - Get defaults from registry
- `createBlockWithDefaults(type, overrides)` - Create block with defaults
- `inheritBlockSettings(type, tableId, baseConfig)` - Inherit from fields/sections

### Layer 3: UI Components

All UI components should use the Core Data APIs instead of directly accessing the database.

## Inheritance Model

```
Core Data (fields)
    ↓
Section Definitions
    ↓
Block Type Definitions
    ↓
Block Instances
```

### Rules

1. **Downstream layers inherit by default**
2. **Overrides are explicit**
3. **Overrides are rare**
4. **Overrides are visible and auditable**

## Field Settings Flow

1. **Read**: Component calls `getFieldSettings(fieldId)`
2. **Edit**: Component calls `updateFieldSettings(fieldId, updates)`
3. **Validate**: API validates before saving
4. **Normalize**: API normalizes options before saving
5. **Save**: API writes to database

## Section Settings Flow

1. **Read**: Component calls `getTableSections(tableId)`
2. **Create**: Component calls `upsertSectionSettings(tableId, sectionName, updates)`
3. **Update**: Component calls `updateSectionSettings(sectionId, updates)`
4. **Save**: API writes to database

## Block Creation Flow

1. **Get Defaults**: `createBlockWithDefaults(type)` gets defaults from registry
2. **Apply Overrides**: Merge user-provided config
3. **Inherit Settings**: If `table_id` exists, call `inheritBlockSettings()`
   - Gets table sections
   - Gets table fields
   - Applies field groupings
   - Applies section defaults
4. **Normalize**: `normalizeBlockConfig()` validates and normalizes
5. **Save**: Write to database

## Migration Path

### Phase 1: Create APIs ✅
- [x] Field settings API
- [x] Section settings API
- [x] Block defaults API

### Phase 2: Refactor Components
- [ ] Field editing components
- [ ] Section rendering components
- [ ] Block creation points

### Phase 3: Remove Duplications
- [ ] Remove custom `getPillColor` functions
- [ ] Remove duplicate field settings logic
- [ ] Remove duplicate section rendering logic

## Benefits

1. **Consistency**: All components use the same logic
2. **Maintainability**: Changes in one place affect all components
3. **Validation**: Centralized validation prevents invalid data
4. **Inheritance**: Automatic inheritance reduces manual configuration
5. **Auditability**: All changes go through the same APIs

## Examples

### Before (Direct Database Access)
```typescript
// Component directly queries database
const { data } = await supabase
  .from('table_fields')
  .select('*')
  .eq('id', fieldId)
  .single()

// Component directly updates database
await supabase
  .from('table_fields')
  .update({ group_name: newGroupName })
  .eq('id', fieldId)
```

### After (Core Data API)
```typescript
// Component uses API
const settings = await getFieldSettings(fieldId)

// Component uses API
await updateFieldSettings(fieldId, { group_name: newGroupName })
```
