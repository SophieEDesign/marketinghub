# Pill/Tag Rendering Audit - Duplication Inventory

## Overview

This document inventories all pill/tag rendering locations and identifies duplications across the codebase.

## Pill Rendering Locations

### 1. ChoicePill Component (Standardized)
**Location**: `baserow-app/components/fields/ChoicePill.tsx`
**Purpose**: Standardized pill component for select fields
**Status**: ✅ Good - This is the standard component
**Usage**: Used in TimelineFieldValue.tsx

**Features**:
- Supports single_select and multi_select
- Uses centralized color resolution (resolveChoiceColor)
- Supports semantic vs muted colors
- Supports density (default/compact)

### 2. ListView.tsx
**Location**: `baserow-app/components/views/ListView.tsx`
**Lines**: 629-866
**Problem**: Custom pill rendering instead of using ChoicePill
**Implementation**:
- Custom `getPillColor` function (line 630)
- Custom pill rendering with inline styles (lines 838-866)
- Duplicates color resolution logic

**Code**:
```typescript
const getPillColor = useCallback((field: TableField, value: any): string | null => {
  // Custom color resolution logic
})

// Custom rendering
{pillFields.flatMap((fieldNameOrId) => {
  const field = tableFields.find((f) => f.name === fieldNameOrId || f.id === fieldNameOrId)
  const color = getPillColor(field, label)
  // Inline pill rendering
})}
```

### 3. HorizontalGroupedView.tsx
**Location**: `baserow-app/components/views/HorizontalGroupedView.tsx`
**Lines**: 258-469
**Problem**: Custom `getPillColor` function
**Implementation**:
- Custom `getPillColor` function (line 259)
- Uses for group header colors (line 469)

### 4. GalleryView.tsx
**Location**: `baserow-app/components/views/GalleryView.tsx`
**Lines**: 265-671
**Problem**: Custom `getPillColor` function
**Implementation**:
- Custom `getPillColor` function (line 266)
- Uses for group header colors (line 671)

### 5. TimelineView.tsx
**Location**: `baserow-app/components/views/TimelineView.tsx`
**Lines**: 692-1534
**Problem**: Custom `getPillColor` function
**Implementation**:
- Custom `getPillColor` function (line 693)
- Uses for group header colors (line 1534)

### 6. RecordReviewView.tsx
**Location**: `baserow-app/components/interface/RecordReviewView.tsx`
**Lines**: 1013-1030
**Problem**: Custom badge rendering with Badge component
**Implementation**:
- Uses Badge component instead of ChoicePill
- Custom color resolution with `getBadgeColorClasses`
- Inconsistent with other views

### 7. TimelineFieldValue.tsx
**Location**: `baserow-app/components/views/TimelineFieldValue.tsx`
**Status**: ✅ Good - Uses ChoicePill component correctly

## Duplication Patterns

### Pattern 1: getPillColor Function
**Duplicated in**: ListView, HorizontalGroupedView, GalleryView, TimelineView
**Issue**: Each view implements its own color resolution logic
**Solution**: Use centralized `resolveFieldColor` from `lib/field-colors.ts`

### Pattern 2: Inline Pill Rendering
**Duplicated in**: ListView (lines 838-866)
**Issue**: Custom JSX for pill rendering instead of using ChoicePill component
**Solution**: Replace with ChoicePill component

### Pattern 3: Badge vs Pill
**Duplicated in**: RecordReviewView
**Issue**: Uses Badge component instead of ChoicePill
**Solution**: Standardize on ChoicePill for all select field rendering

## Color Resolution

**Centralized Logic**: `baserow-app/lib/field-colors.ts`
- `resolveChoiceColor` - For select fields
- `resolveFieldColor` - For all field types
- `getChoiceThemePalette` - For theme-based colors

**Problem**: Views implement their own `getPillColor` functions instead of using centralized logic.

## Recommendations

1. **Create standardized Pill API**
   - Single function to render pills: `renderPill(params)`
   - Uses ChoicePill component internally
   - Handles all field types (select, linked, lookup)

2. **Replace all custom implementations**
   - ListView: Replace inline rendering with ChoicePill
   - HorizontalGroupedView: Remove getPillColor, use resolveFieldColor
   - GalleryView: Remove getPillColor, use resolveFieldColor
   - TimelineView: Remove getPillColor, use resolveFieldColor
   - RecordReviewView: Replace Badge with ChoicePill

3. **Standardize color resolution**
   - All views should use `resolveFieldColor` from field-colors.ts
   - Remove all custom `getPillColor` functions

4. **Extend ChoicePill for linked fields**
   - Add support for link_to_table fields
   - Add support for lookup fields
   - Maintain consistent styling
