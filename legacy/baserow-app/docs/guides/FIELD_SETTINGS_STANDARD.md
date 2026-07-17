# Field Settings Standard

## Overview

This document defines the standard for field settings. All field editing components should follow this standard.

## Field Settings Structure

Field settings are stored in the `table_fields` table with the following structure:

```typescript
interface CanonicalFieldSettings {
  // Identity
  id: string
  name: string
  label?: string | null
  type: FieldType
  
  // Behavior
  required: boolean
  read_only: boolean
  default_value: any
  
  // Grouping
  group_name?: string | null
  
  // Type-specific options (stored in JSONB)
  options: FieldOptions
  
  // Metadata
  position: number
  order_index?: number
  created_at: string
  updated_at?: string
}
```

## Using the Core Data API

### Reading Field Settings

```typescript
import { getFieldSettings } from '@/lib/core-data/field-settings'

const settings = await getFieldSettings(fieldId)
if (!settings) {
  // Field not found
  return
}

// Use settings
console.log(settings.label)
console.log(settings.group_name)
```

### Updating Field Settings

```typescript
import { updateFieldSettings } from '@/lib/core-data/field-settings'

const result = await updateFieldSettings(fieldId, {
  label: 'New Label',
  group_name: 'New Section',
  required: true,
})

if (!result.success) {
  console.error(result.error)
}
```

### Validating Field Settings

```typescript
import { validateFieldSettings } from '@/lib/core-data/field-settings'

const validation = validateFieldSettings({
  label: 'Test Field',
  type: 'single_select',
  options: { choices: [] },
}, 'single_select')

if (!validation.valid) {
  console.error(validation.errors)
}
```

## Field Options Normalization

Field options are automatically normalized when saving:

- Select fields: Options are normalized to `selectOptions` format
- Empty values are removed
- Colors are preserved
- Order is maintained via `sort_index`

## Section Assignment

Fields are assigned to sections via the `group_name` field:

- `null` or empty → "General" section
- Non-empty string → Named section
- Sections are created automatically when fields are assigned

## Best Practices

1. **Always use the API**: Never directly query/update `table_fields`
2. **Validate before saving**: Use `validateFieldSettings()`
3. **Handle errors**: Check `result.success` and `result.error`
4. **Preserve existing values**: Only update fields that are explicitly changed
5. **Normalize options**: Let the API handle normalization

## Migration Guide

### Before
```typescript
// Direct database access
const { data } = await supabase
  .from('table_fields')
  .select('*')
  .eq('id', fieldId)
  .single()

await supabase
  .from('table_fields')
  .update({ group_name: newGroupName })
  .eq('id', fieldId)
```

### After
```typescript
// Use Core Data API
const settings = await getFieldSettings(fieldId)
await updateFieldSettings(fieldId, { group_name: newGroupName })
```
