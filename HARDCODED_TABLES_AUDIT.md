# Hardcoded Tables Audit

## Current Status

The system has both hardcoded table definitions and a new dynamic system. This document tracks what needs to be migrated.

## Hardcoded Table References

### 1. `lib/tableMetadata.ts`
- **Status**: ⚠️ Contains hardcoded table definitions
- **Tables**: content, campaigns, contacts, ideas, media, tasks, briefings, sponsorships, strategy, assets
- **Action**: This file should be deprecated in favor of the dynamic `tables` and `table_fields` system
- **Priority**: Medium (used as fallback, but should migrate to dynamic system)

### 2. `lib/tables.ts`
- **Status**: ⚠️ Contains hardcoded table categories
- **Tables**: content, ideas, media, campaigns, tasks, contacts
- **Action**: Should load categories dynamically from database
- **Priority**: Low (used for UI organization)

### 3. Dashboard Block Defaults
- **Status**: ✅ Fixed - Now uses `useTables()` hook
- **Files**: 
  - `components/dashboard/blocks/KpiBlock.tsx` ✅
  - `components/dashboard/blocks/TableBlock.tsx` ✅
  - `components/dashboard/blocks/CalendarBlock.tsx` ✅

### 4. Page Block Settings
- **Status**: ⚠️ May have hardcoded references
- **Files**: `components/pages/BlockSettingsPanel.tsx`
- **Action**: Should use `useTables()` hook

### 5. Sidebar
- **Status**: ✅ Fixed - Uses dynamic table loading with fallback
- **File**: `components/sidebar/Sidebar.tsx`

## Migration Strategy

### Phase 1: Ensure All UI Uses Dynamic Tables (Current)
- ✅ Dashboard blocks use `useTables()` hook
- ✅ Sidebar loads tables dynamically
- ⏳ Page block settings should use `useTables()`
- ⏳ All dropdowns/selectors should use `useTables()`

### Phase 2: Migrate tableMetadata.ts (Future)
- Create migration script to convert `tableMetadata` entries to `tables` and `table_fields`
- Update all code that references `tableMetadata` to use dynamic system
- Remove `tableMetadata.ts` file

### Phase 3: Remove Hardcoded Categories (Future)
- Load table categories from database
- Update `lib/tables.ts` to be dynamic

## Current Implementation

The `useTables()` hook provides:
1. Loads from new `tables` system (via `/api/tables`)
2. Falls back to `table_metadata` system
3. Falls back to hardcoded list if both fail

This ensures backward compatibility while migrating to the dynamic system.

## Files to Update

1. ✅ `lib/hooks/useTables.ts` - Created
2. ✅ `components/dashboard/blocks/*.tsx` - Updated
3. ⏳ `components/pages/BlockSettingsPanel.tsx` - Should use `useTables()`
4. ⏳ Any other components with hardcoded table lists

