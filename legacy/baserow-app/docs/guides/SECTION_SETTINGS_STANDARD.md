# Section Settings Standard

## Overview

This document defines the standard for section settings. Sections are first-class entities with their own settings.

## Section Settings Structure

Sections are stored in the `field_sections` table:

```typescript
interface SectionSettings {
  id: string
  table_id: string
  name: string
  display_name?: string | null
  order_index: number
  default_collapsed: boolean
  default_visible: boolean
  permissions?: Record<string, any>
  created_at: string
  updated_at?: string
}
```

## Using the Core Data API

### Reading Section Settings

```typescript
import { getSectionSettings, getTableSections } from '@/lib/core-data/section-settings'

// Get a specific section
const section = await getSectionSettings(tableId, 'Section Name')

// Get all sections for a table
const sections = await getTableSections(tableId)
```

### Creating/Updating Sections

```typescript
import { upsertSectionSettings } from '@/lib/core-data/section-settings'

const result = await upsertSectionSettings(tableId, 'Section Name', {
  display_name: 'Display Name',
  default_collapsed: false,
  default_visible: true,
  order_index: 0,
})

if (result.success && result.section) {
  console.log('Section created/updated:', result.section)
}
```

### Ensuring Section Exists

```typescript
import { ensureSectionExists } from '@/lib/core-data/section-settings'

// Automatically creates section if it doesn't exist
const section = await ensureSectionExists(tableId, 'Section Name')
```

## Field-to-Section Relationship

Fields are linked to sections via the `group_name` field:

- Field with `group_name = 'Section Name'` → Belongs to that section
- Field with `group_name = null` → Belongs to "General" section
- Sections are created automatically when fields are assigned

## Default Section

The default section name is "General". Fields without a `group_name` are placed in this section.

## Section Ordering

Sections are ordered by `order_index`:
- Lower `order_index` → Appears first
- "General" section always appears first if it exists

## Best Practices

1. **Use the API**: Never directly query/update `field_sections`
2. **Auto-create sections**: Use `ensureSectionExists()` when assigning fields
3. **Set display names**: Use `display_name` for user-friendly names
4. **Handle defaults**: Set `default_collapsed` and `default_visible` appropriately

## Migration Guide

### Before (Implicit Sections)
```typescript
// Sections were just group_name strings
const sections = fields.reduce((acc, field) => {
  const sectionName = field.group_name || 'General'
  if (!acc[sectionName]) acc[sectionName] = []
  acc[sectionName].push(field)
  return acc
}, {})
```

### After (Explicit Sections)
```typescript
// Sections are first-class entities
const sections = await getTableSections(tableId)
for (const section of sections) {
  const fields = tableFields.filter(f => f.group_name === section.name)
  // Render section with its settings
}
```
