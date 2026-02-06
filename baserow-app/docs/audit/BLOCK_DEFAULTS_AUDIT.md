# Block Defaults Audit - Registry vs Validator Comparison

## Overview

This document compares block defaults defined in two places:
1. `BLOCK_REGISTRY` in `baserow-app/lib/interface/registry.ts`
2. `getDefaultConfigForType` in `baserow-app/lib/interface/block-validator.ts`

## Comparison Table

| Block Type | BLOCK_REGISTRY defaultConfig | getDefaultConfigForType | Conflict? | Notes |
|------------|------------------------------|-------------------------|-----------|-------|
| grid | `{ title: 'Table View', table_id: '' }` | `{ table_id: '' }` | ✅ Yes | Registry has title, validator doesn't |
| form | `{ title: 'Form', table_id: '' }` | `{ table_id: '' }` | ✅ Yes | Registry has title, validator doesn't |
| record | `{ title: 'Record', table_id: '', record_id: '' }` | `{ table_id: '', record_id: '' }` | ✅ Yes | Registry has title, validator doesn't |
| chart | `{ title: 'Chart', table_id: '', chart_type: 'bar' }` | `{ table_id: '', chart_type: 'bar' }` | ✅ Yes | Registry has title, validator doesn't |
| kpi | `{ title: 'KPI', table_id: '', kpi_aggregate: 'count' }` | `{ table_id: '', kpi_aggregate: 'count' }` | ✅ Yes | Registry has title, validator doesn't |
| text | `{ title: '', text_content: '' }` | `{ content: '' }` | ✅ Yes | Different keys: text_content vs content |
| image | `{ title: 'Image', image_url: '', image_alt: '' }` | `{ image_url: '' }` | ✅ Yes | Registry has title and image_alt, validator doesn't |
| gallery | `{ title: 'Gallery', table_id: '', view_type: 'gallery' }` | `{ table_id: '', view_type: 'gallery' }` | ✅ Yes | Registry has title, validator doesn't |
| divider | `{ title: '', appearance: { divider_height: 2 } }` | `{}` | ✅ Yes | Registry has appearance settings, validator is empty |
| button | `{ title: 'Button', button_label: 'Click Me', button_automation_id: '' }` | `{ button_label: '' }` | ✅ Yes | Registry has title and default label, validator doesn't |
| action | `{ title: 'Action', action_type: 'navigate', label: 'Click Me', route: '' }` | `{ action_type: 'navigate', label: '' }` | ✅ Yes | Registry has title and default label, validator doesn't |
| link_preview | `{ title: 'Link Preview', url: '' }` | `{ link_url: '' }` | ✅ Yes | Different keys: url vs link_url |
| filter | `{ title: 'Filters', table_id: '', target_blocks: 'all', allowed_fields: [], allowed_operators: [], filters: [] }` | `{ target_blocks: 'all', allowed_fields: [], filters: [] }` | ✅ Yes | Registry has title and allowed_operators, validator doesn't |
| field | `{ title: '', field_id: '' }` | `{ field_id: '' }` | ✅ Yes | Registry has empty title, validator doesn't |
| field_section | `{ title: '', group_name: '' }` | `{ group_name: '' }` | ✅ Yes | Registry has empty title, validator doesn't |
| calendar | `{ title: 'Calendar', table_id: '', view_type: 'calendar' }` | `{ table_id: '', view_type: 'calendar' }` | ✅ Yes | Registry has title, validator doesn't |
| multi_calendar | `{ title: 'Multi Calendar', sources: [] }` | `{ sources: [] }` | ✅ Yes | Registry has title, validator doesn't |
| kanban | `{ title: 'Kanban Board', table_id: '', view_type: 'kanban' }` | `{ table_id: '', view_type: 'kanban' }` | ✅ Yes | Registry has title, validator doesn't |
| timeline | `{ title: 'Timeline', table_id: '', view_type: 'timeline' }` | `{ table_id: '', view_type: 'timeline' }` | ✅ Yes | Registry has title, validator doesn't |
| multi_timeline | `{ title: 'Multi Timeline', sources: [] }` | `{ sources: [] }` | ✅ Yes | Registry has title, validator doesn't |
| list | `{ title: 'List View', table_id: '' }` | `{ table_id: '', view_type: 'grid' }` | ✅ Yes | Registry has title, validator has view_type |
| horizontal_grouped | `{ title: 'Tabs View', table_id: '', group_by_field: '' }` | `{ table_id: '', group_by_field: '' }` | ✅ Yes | Registry has title, validator doesn't |
| number | `{ title: 'Number', table_id: '', field_id: '' }` | `{ table_id: '', field_id: '' }` | ✅ Yes | Registry has title, validator doesn't |

## Conflicts Identified

### 1. Title Field Inconsistency
**Issue**: BLOCK_REGISTRY includes `title` in most block defaults, but `getDefaultConfigForType` omits it.
**Impact**: When blocks are created with invalid configs, they lose their default titles.
**Resolution**: Use BLOCK_REGISTRY as source of truth, update validator to use registry.

### 2. Key Name Mismatches
**Issue**: Some blocks use different keys:
- `text`: `text_content` (registry) vs `content` (validator)
- `link_preview`: `url` (registry) vs `link_url` (validator)
**Impact**: Data inconsistency, potential data loss.
**Resolution**: Standardize on registry keys.

### 3. Missing Default Values
**Issue**: Validator has minimal defaults, missing helpful defaults like:
- `button_label: 'Click Me'` (registry) vs `button_label: ''` (validator)
- `label: 'Click Me'` for action blocks (registry) vs `label: ''` (validator)
**Impact**: Blocks created with invalid configs have empty labels.
**Resolution**: Use registry defaults in validator.

### 4. Missing Appearance Settings
**Issue**: Divider block has `appearance.divider_height: 2` in registry but empty in validator.
**Impact**: Divider blocks created with invalid configs lose default height.
**Resolution**: Include appearance defaults in validator.

### 5. List Block view_type
**Issue**: List block has `view_type: 'grid'` in validator but not in registry.
**Impact**: Inconsistency in default view type.
**Resolution**: Add to registry or remove from validator.

## Recommendations

1. **Use BLOCK_REGISTRY as single source of truth**
   - Update `getDefaultConfigForType` to use `BLOCK_REGISTRY[type].defaultConfig`
   - Remove duplicate defaults from validator

2. **Standardize key names**
   - Use `text_content` consistently (not `content`)
   - Use `url` consistently for link_preview (not `link_url`)

3. **Enhance registry with applicable settings**
   - Add `applicableSettings` property to BlockDefinition
   - Document which settings apply to which block types

4. **Create inheritance function**
   - Function to merge registry defaults with field/section defaults
   - Function to apply defaults on block creation
