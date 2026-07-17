# Refactoring Guide - Using Core Data APIs

## Overview

This guide provides step-by-step instructions for refactoring components to use the new Core Data APIs.

## Field Editing Components

### Components to Refactor

1. `baserow-app/components/layout/FieldSettingsDrawer.tsx`
2. `baserow-app/components/interface/settings/FieldDataSettings.tsx`
3. `baserow-app/components/grid/FieldBuilderDrawer.tsx`
4. `baserow-app/components/grid/FieldBuilderModal.tsx`

### Refactoring Steps

#### Step 1: Import Core Data API

```typescript
import { 
  getFieldSettings, 
  updateFieldSettings,
  validateFieldSettings 
} from '@/lib/core-data/field-settings'
```

#### Step 2: Replace Direct Database Queries

**Before**:
```typescript
const { data } = await supabase
  .from('table_fields')
  .select('*')
  .eq('id', fieldId)
  .single()
```

**After**:
```typescript
const settings = await getFieldSettings(fieldId)
```

#### Step 3: Replace Direct Database Updates

**Before**:
```typescript
await supabase
  .from('table_fields')
  .update({ group_name: newGroupName })
  .eq('id', fieldId)
```

**After**:
```typescript
const result = await updateFieldSettings(fieldId, {
  group_name: newGroupName,
})

if (!result.success) {
  console.error(result.error)
  return
}
```

#### Step 4: Remove Duplicate Logic

Remove:
- Custom `syncSelectOptionsPayload` functions
- Custom validation logic
- Custom normalization logic

Use the Core Data API functions instead.

## Section Rendering Components

### Components to Refactor

1. `baserow-app/components/interface/settings/shared/FieldPicker.tsx`
2. `baserow-app/components/records/RecordFields.tsx`
3. `baserow-app/components/interface/blocks/FieldSectionBlock.tsx`

### Refactoring Steps

#### Step 1: Import Section Settings API

```typescript
import { getTableSections, getSectionSettings } from '@/lib/core-data/section-settings'
```

#### Step 2: Replace Implicit Section Logic

**Before**:
```typescript
const sections = fields.reduce((acc, field) => {
  const sectionName = field.group_name || 'General'
  if (!acc[sectionName]) acc[sectionName] = []
  acc[sectionName].push(field)
  return acc
}, {})
```

**After**:
```typescript
const sections = await getTableSections(tableId)
const fieldsBySection = new Map()

for (const section of sections) {
  fieldsBySection.set(section.name, [])
}

for (const field of fields) {
  const sectionName = field.group_name || 'General'
  const sectionFields = fieldsBySection.get(sectionName) || []
  sectionFields.push(field)
  fieldsBySection.set(sectionName, sectionFields)
}
```

#### Step 3: Use Section Settings

```typescript
for (const section of sections) {
  const sectionFields = fieldsBySection.get(section.name) || []
  
  // Use section settings
  const isCollapsed = section.default_collapsed
  const isVisible = section.default_visible
  
  // Render section with its settings
}
```

## Pill Rendering Components

### Components to Refactor

1. `baserow-app/components/views/ListView.tsx`
2. `baserow-app/components/views/HorizontalGroupedView.tsx`
3. `baserow-app/components/views/GalleryView.tsx`
4. `baserow-app/components/views/TimelineView.tsx`
5. `baserow-app/components/interface/RecordReviewView.tsx`

### Refactoring Steps

#### Step 1: Import Pill API

```typescript
import { renderPill, renderPills, resolvePillColor } from '@/lib/ui/pills'
```

#### Step 2: Remove Custom getPillColor Functions

**Before**:
```typescript
const getPillColor = useCallback((field: TableField, value: any): string | null => {
  // Custom color resolution logic
}, [])
```

**After**:
```typescript
// Use centralized function
const color = resolvePillColor(field, value)
```

#### Step 3: Replace Inline Pill Rendering

**Before**:
```typescript
{pillFields.flatMap((fieldNameOrId) => {
  const field = tableFields.find(...)
  const color = getPillColor(field, label)
  return (
    <span style={{ backgroundColor: bg, ... }}>
      {label}
    </span>
  )
})}
```

**After**:
```typescript
{renderPills(field, values, {
  density: 'default',
  max: 5,
  onValueClick: (value) => handleClick(value),
})}
```

## Testing Checklist

After refactoring each component:

- [ ] Component loads without errors
- [ ] Field settings can be read
- [ ] Field settings can be updated
- [ ] Validation works correctly
- [ ] Sections render correctly
- [ ] Pills render correctly
- [ ] No console errors
- [ ] No TypeScript errors

## Rollback Plan

If issues occur:

1. Revert component changes
2. Keep Core Data APIs (they're backward compatible)
3. Fix issues in APIs
4. Re-apply component changes
