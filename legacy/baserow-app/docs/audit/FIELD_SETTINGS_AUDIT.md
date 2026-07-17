# Field Settings Audit - Duplication Inventory

## Overview

This document inventories all field settings entry points and identifies duplications across the codebase.

## Field Settings Entry Points

### 1. FieldSettingsDrawer.tsx
**Location**: `baserow-app/components/layout/FieldSettingsDrawer.tsx`
**Purpose**: Main field editor (full-featured)
**Settings Handled**:
- Field name/label
- Section name (group_name) - lines 74, 255, 681, 865-877
- Field type
- Required toggle - lines 72, 253, 1556-1569
- Read-only toggle - lines 73, 254, 1572-1587
- Default value - lines 75, 257, 1589-1643
- Options (JSONB) - lines 76, 258, 684-743
- Type-specific settings (choices, formula, date format, etc.)

**Duplications**:
- Section name editing logic duplicated in 3 other components
- Read-only toggle logic duplicated
- Options normalization duplicated
- Type validation logic scattered

### 2. FieldDataSettings.tsx
**Location**: `baserow-app/components/interface/settings/FieldDataSettings.tsx`
**Purpose**: Block-level field picker (simplified)
**Settings Handled**:
- Section name (group_name) - lines 131, 221-232
- Field type (read-only display)
- Options editing (limited)
- Uses FieldSettingsDrawer for full editing

**Duplications**:
- Section name editing duplicated
- Options editing partially duplicated

### 3. FieldBuilderDrawer.tsx
**Location**: `baserow-app/components/grid/FieldBuilderDrawer.tsx`
**Purpose**: Grid view field builder
**Settings Handled**:
- Field name
- Section name (group_name) - lines 32, 55, 151, 159, 568-582
- Field type
- Required toggle
- Default value
- Options

**Duplications**:
- All field settings logic duplicated
- Section name editing duplicated
- Options normalization duplicated

### 4. FieldBuilderModal.tsx
**Location**: `baserow-app/components/grid/FieldBuilderModal.tsx`
**Purpose**: Grid view modal field builder
**Settings Handled**:
- Field name
- Section name (group_name) - lines 39, 121, 247, 255, 745-757
- Field type
- Required toggle
- Default value
- Options

**Duplications**:
- All field settings logic duplicated
- Section name editing duplicated
- Options normalization duplicated (syncSelectOptionsPayload function)

## Duplication Patterns

### Pattern 1: Section Name (group_name) Editing
**Duplicated in**: All 4 components
**Lines**:
- FieldSettingsDrawer: 74, 255, 681, 865-877
- FieldDataSettings: 131, 221-232
- FieldBuilderDrawer: 32, 55, 151, 159, 568-582
- FieldBuilderModal: 39, 121, 247, 255, 745-757

**Solution**: Create single `updateFieldGroupName` function in core data API

### Pattern 2: Options Normalization
**Duplicated in**: FieldSettingsDrawer, FieldBuilderModal
**Functions**:
- FieldSettingsDrawer: `syncSelectOptionsPayload` (lines 299-343)
- FieldBuilderModal: `syncSelectOptionsPayload` (lines 70-120)

**Solution**: Move to `lib/core-data/field-settings.ts`

### Pattern 3: Read-Only Toggle
**Duplicated in**: FieldSettingsDrawer, FieldBuilderDrawer, FieldBuilderModal
**Logic**: Stored in `options.read_only`, toggled via Switch component

**Solution**: Create `updateFieldReadOnly` function in core data API

### Pattern 4: Required Toggle
**Duplicated in**: All 4 components
**Logic**: Direct field property, toggled via Switch component

**Solution**: Create `updateFieldRequired` function in core data API

### Pattern 5: Default Value Handling
**Duplicated in**: All 4 components
**Logic**: Type-specific input handling (checkbox, date, number, text)

**Solution**: Create `updateFieldDefaultValue` function with type-specific validation

### Pattern 6: Type Validation
**Duplicated in**: FieldSettingsDrawer, FieldBuilderDrawer, FieldBuilderModal
**Logic**: `canChangeType` checks, type change warnings

**Solution**: Centralize in core data API

## Missing Centralization

1. **No single function to get field settings** - Each component loads directly from Supabase
2. **No single function to update field settings** - Each component has its own update logic
3. **No validation layer** - Validation scattered across components
4. **No normalization layer** - Options normalization duplicated
5. **No inheritance** - Field settings don't inherit from core data defaults

## Recommendations

1. Create `lib/core-data/field-settings.ts` with:
   - `getFieldSettings(fieldId)` - Single source for reading
   - `updateFieldSettings(fieldId, updates)` - Single source for writing
   - `validateFieldSettings(settings)` - Centralized validation
   - `normalizeFieldOptions(options, type)` - Centralized normalization

2. Refactor all 4 components to use the core data API

3. Add field settings schema with explicit defaults
