# Field Type Mapping Confirmation

## Current Field Types in System

Based on `baserow-app/types/fields.ts`, the system currently supports:

1. `text` - Single line text
2. `long_text` - Long text
3. `number` - Number
4. `percent` - Percent
5. `currency` - Currency
6. `date` - Date
7. `single_select` - Single select (with options)
8. `multi_select` - Multiple select (with options)
9. `checkbox` - Checkbox (boolean)
10. `attachment` - Attachment (JSONB)
11. `link_to_table` - Link to table
12. `formula` - Formula (virtual, read-only)
13. `lookup` - Lookup (virtual, read-only)

## Your Proposed Mapping vs Current Implementation

| Your Field Type | Current System Type | UI Component | Status |
|----------------|-------------------|--------------|--------|
| `text` | ✅ `text` | `<input type="text">` | ✅ **CONFIRMED** |
| `long_text` | ✅ `long_text` | `<textarea>` | ✅ **CONFIRMED** |
| `number` | ✅ `number` | `<input type="number">` | ✅ **CONFIRMED** |
| `date` | ✅ `date` | `<input type="date">` | ✅ **CONFIRMED** |
| `select` | ⚠️ `single_select` | `<select>` with options | ⚠️ **NAME DIFFERENCE** |
| `multi_select` | ✅ `multi_select` | Multiselect tag component | ✅ **CONFIRMED** |
| `boolean` | ⚠️ `checkbox` | `<input type="checkbox">` | ⚠️ **NAME DIFFERENCE** |
| `attachment` | ✅ `attachment` | Image/file thumbnails | ✅ **CONFIRMED** |
| `url` | ❌ **NOT IN SYSTEM** | Clickable link | ❌ **NEEDS ADDITION** |
| `email` | ❌ **NOT IN SYSTEM** | `mailto:` link | ❌ **NEEDS ADDITION** |
| `json` | ❌ **NOT IN SYSTEM** | Read-only pill | ❌ **NEEDS ADDITION** |

## Additional Field Types in System (Not in Your List)

- `percent` - Percent display (e.g., 0.15 → "15%")
- `currency` - Currency display (e.g., 100 → "$100.00")
- `link_to_table` - Relationship to another table
- `formula` - Calculated field (virtual, read-only)
- `lookup` - Lookup field (virtual, read-only)

## Current Implementation Status

### ✅ Already Implemented Correctly:
- `text` → text input (Cell.tsx, AirtableGridView.tsx)
- `long_text` → textarea (Cell.tsx)
- `number` → number input (Cell.tsx, AirtableGridView.tsx)
- `date` → date input (Cell.tsx detects date type)
- `single_select` → select dropdown (Cell.tsx)
- `multi_select` → comma-separated display (needs tag component upgrade)
- `checkbox` → checkbox (Cell.tsx, AirtableGridView.tsx)
- `attachment` → JSONB storage (needs thumbnail UI)

### ⚠️ Name Differences:
- You said `select` → System uses `single_select` ✅ (same functionality)
- You said `boolean` → System uses `checkbox` ✅ (same functionality)

### ❌ Missing Field Types (Need to Add):
1. **`url`** - Should render as clickable link
2. **`email`** - Should render as `mailto:` link
3. **`json`** - Should render as read-only formatted JSON pill

## Recommendations

### Option 1: Add Missing Types
Add `url`, `email`, and `json` to the field types system:
- Update `types/fields.ts` to include these types
- Update database migration to allow these types
- Update UI components to render them appropriately

### Option 2: Alias Existing Types
- Keep `checkbox` but document it as boolean equivalent
- Keep `single_select` but document it as select equivalent

### Option 3: Rename for Consistency
- Rename `checkbox` → `boolean` (breaking change)
- Rename `single_select` → `select` (breaking change)

## Next Steps

Please confirm:
1. ✅ Should I add `url`, `email`, and `json` field types?
2. ✅ Should I keep current naming (`checkbox`, `single_select`) or rename?
3. ✅ Should `multi_select` use a tag component (like chips/badges)?
4. ✅ Should `attachment` show image/file thumbnails in grid view?
