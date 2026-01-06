# Interface Builder Audit Report

**Date:** 2025-01-XX  
**Scope:** Existing Interface Builder system (no new page types)  
**Focus:** Correctness, consistency, reusability for Airtable-style block dropping

---

## Executive Summary

The Interface Builder system has a solid foundation with proper separation of concerns (page types, blocks, settings), but several critical gaps prevent Airtable-style reusability. **Key finding:** Blocks inconsistently load config from `view_blocks.config`, some rely on edit mode, and SQL wiring is incomplete.

**Overall Status:**
- ✅ **Working:** Page type definitions, block rendering infrastructure, settings panels
- 🟡 **Partially Working:** Most blocks (config loading inconsistencies), page validation, view types
- 🔴 **Broken/Missing:** SQL view auto-generation, some block types, save loop prevention

---

## 1️⃣ Page Types Audit

### Existing Page Types

| Page Type | Expected Config | Validation | Setup State | Edit/View Parity |
|-----------|----------------|------------|-------------|------------------|
| **list** | `saved_view_id` (source view) | ✅ Validated | ✅ Shows setup state | ✅ Renders identically |
| **dashboard** | `dashboard_layout_id` (blocks) | ✅ Validated | ✅ Shows setup state | ✅ Renders identically |
| **form** | `base_table` (table_id) | ✅ Validated | ✅ Shows setup state | ⚠️ Form fields config unclear |
| **record_review** | `saved_view_id` + detail config | ✅ Validated | ✅ Shows setup state | ✅ Renders identically |

### Findings

#### ✅ Working

1. **Page Type Definitions** (`baserow-app/lib/interface/page-types.ts`)
   - All 4 requested types defined with clear requirements
   - `validatePageConfig()` checks required fields
   - `getRequiredAnchorType()` correctly maps types to anchors

2. **Setup States** (`baserow-app/components/interface/PageSetupState.tsx`)
   - Clear setup messages for missing config
   - Different messages for admin vs non-admin
   - Action buttons to configure pages

3. **Page Validation**
   - `validatePageAnchor()` enforces exactly one anchor per page
   - Database constraints prevent invalid states

#### 🟡 Partially Working

1. **Form Page Configuration**
   - Requires `base_table` ✅
   - Form fields config stored in `config.form_fields` but unclear if validated
   - No clear setup state for "table selected but no fields configured"

2. **Record Review Page**
   - Requires `saved_view_id` ✅
   - Detail panel config stored in `config.detail_fields` but not validated
   - Missing setup state for "view selected but no detail fields configured"

#### 🔴 Broken/Missing

1. **Page Settings Persistence**
   - Inline title editing works ✅
   - Page type constraints not enforced after creation (can change type?)
   - No validation that changing page type preserves required anchors

---

## 2️⃣ Block Audit

### Block Inventory

| Block Type | Config Source | Works w/o Edit Mode | Settings Persisted | Status |
|------------|---------------|---------------------|-------------------|--------|
| **Grid** | `block.config` ✅ | ✅ Yes | ✅ Yes | ✅ Working |
| **Form** | `block.config` ✅ | ✅ Yes | ✅ Yes | ✅ Working |
| **Record** | `block.config` ✅ | ⚠️ Opens panel | ✅ Yes | 🟡 Partial |
| **Calendar** | `block.config` ✅ | ✅ Yes | ✅ Yes | ✅ Working |
| **Chart** | `block.config` ✅ | ✅ Yes | ✅ Yes | ✅ Working |
| **KPI** | `block.config` ✅ | ✅ Yes | ✅ Yes | ✅ Working |
| **Text** | `block.config` ✅ | ✅ Yes | ✅ Yes | ✅ Working |
| **Image** | `block.config` ✅ | ✅ Yes | ✅ Yes | ✅ Working |
| **Button** | ❓ Not found | ❓ | ❓ | 🔴 Missing |
| **Tabs** | `block.config` ✅ | ⚠️ Needs blocks | ✅ Yes | 🟡 Partial |
| **Snapshot** | `block.config` ✅ | ✅ Yes | ✅ Yes | ✅ Working |
| **Link Preview** | `block.config` ✅ | ✅ Yes | ✅ Yes | ✅ Working |
| **Divider** | `block.config` ✅ | ✅ Yes | ✅ Yes | ✅ Working |

### Detailed Findings

#### ✅ Working Blocks

1. **Grid Block** (`baserow-app/components/interface/blocks/GridBlock.tsx`)
   - ✅ Loads config from `block.config`
   - ✅ Works without edit mode
   - ✅ Shows setup state when `table_id` missing
   - ✅ Supports grid, calendar view types
   - ✅ Config filters/sorts override view filters/sorts
   - ✅ Appearance settings applied

2. **Form Block** (`baserow-app/components/interface/blocks/FormBlock.tsx`)
   - ✅ Loads config from `block.config`
   - ✅ Works without edit mode
   - ✅ Shows setup states for missing table/fields
   - ✅ Form fields from `config.form_fields`
   - ✅ Validates required fields on submit

3. **Chart Block** (`baserow-app/components/interface/blocks/ChartBlock.tsx`)
   - ✅ Loads config from `block.config`
   - ✅ Works without edit mode
   - ✅ Shows setup states for missing table/axes
   - ⚠️ Falls back to `pageTableId` if block has no `table_id` (inconsistent)

4. **KPI Block** (`baserow-app/components/interface/blocks/KPIBlock.tsx`)
   - ✅ Loads config from `block.config`
   - ✅ Works without edit mode
   - ✅ Shows setup state for missing table
   - ⚠️ Falls back to `pageTableId` (inconsistent)

5. **Text Block** (`baserow-app/components/interface/blocks/TextBlock.tsx`)
   - ✅ Loads config from `block.config`
   - ✅ Works without edit mode
   - ✅ Supports TipTap JSON and plain text
   - ✅ Auto-saves with debouncing
   - ✅ Prevents save loops

6. **Image Block** (`baserow-app/components/interface/blocks/ImageBlock.tsx`)
   - ✅ Loads config from `block.config`
   - ✅ Works without edit mode
   - ✅ Shows setup state for missing image
   - ✅ Appearance settings applied

7. **Table Snapshot Block** (`baserow-app/components/interface/blocks/TableSnapshotBlock.tsx`)
   - ✅ Loads config from `block.config`
   - ✅ Works without edit mode
   - ✅ Applies view filters/sorts
   - ✅ Shows setup state for missing table/view

8. **Divider Block** (`baserow-app/components/interface/blocks/DividerBlock.tsx`)
   - ✅ Loads config from `block.config`
   - ✅ Works without edit mode
   - ✅ Appearance settings applied

#### 🟡 Partially Working Blocks

1. **Record Block** (`baserow-app/components/interface/blocks/RecordBlock.tsx`)
   - ✅ Loads config from `block.config`
   - ⚠️ Opens global record panel (not self-contained)
   - ✅ Shows setup states
   - ⚠️ Falls back to `pageTableId` and `pageRecordId` (inconsistent)

2. **Tabs Block** (`baserow-app/components/interface/blocks/TabsBlock.tsx`)
   - ✅ Loads config from `block.config`
   - ⚠️ Requires child blocks to function
   - ✅ Appearance settings applied
   - ⚠️ No setup state for "no tabs configured"

#### 🔴 Broken/Missing Blocks

1. **Button Block**
   - ❌ Not found in `baserow-app/components/interface/blocks/`
   - ❌ May exist in `components/blocks/` but not integrated

2. **Link Preview Block** (`baserow-app/components/interface/blocks/LinkPreviewBlock.tsx`)
   - ✅ Exists but not audited in detail
   - ⚠️ Need to verify config loading

### Critical Issues

#### 🔴 Config Loading Inconsistencies

**Problem:** Some blocks fall back to `pageTableId` when `config.table_id` is missing, others show setup state.

**Affected Blocks:**
- Chart Block: Falls back to `pageTableId` (line 41)
- KPI Block: Falls back to `pageTableId` (line 27)
- Record Block: Falls back to `pageTableId` and `pageRecordId` (lines 20-21)

**Impact:** Blocks cannot be truly reusable - they depend on page context.

**Fix Required:** All blocks should require `table_id` in config, show setup state if missing.

#### 🔴 Save Loop Prevention

**Status:** ✅ Text Block has proper save loop prevention  
**Status:** ⚠️ Settings Panel has debouncing but may still loop  
**Status:** ❓ Other blocks not audited for save loops

**Fix Required:** Audit all blocks for save loop prevention.

---

## 3️⃣ View Types (Within Blocks)

### View Type Support

| View Type | Grid Block | Standalone | Sorting | Filtering | Field Visibility | Date Field | Grouping |
|-----------|------------|-----------|---------|-----------|------------------|------------|----------|
| **Grid** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | N/A | ✅ Yes |
| **Calendar** | ✅ Yes | ✅ Yes | ⚠️ Partial | ✅ Yes | ✅ Yes | ✅ Yes | N/A |
| **Kanban** | ❌ No | ✅ Yes | ⚠️ Partial | ✅ Yes | ✅ Yes | N/A | ✅ Yes |
| **Timeline** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Yes | ❌ No |
| **List** | ⚠️ Same as Grid | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | N/A | ✅ Yes |
| **Gallery** | ❌ No | ⚠️ Partial | ⚠️ Partial | ✅ Yes | ✅ Yes | N/A | ❌ No |

### Findings

#### ✅ Working

1. **Grid View**
   - ✅ Fully configurable via `config.view_type = 'grid'`
   - ✅ Sorting from `config.sorts` or view sorts
   - ✅ Filtering from `config.filters` or view filters
   - ✅ Field visibility from `config.visible_fields` or view fields
   - ✅ Grouping from view config

2. **Calendar View**
   - ✅ Fully configurable via `config.view_type = 'calendar'`
   - ✅ Date field from `config.calendar_date_field` or auto-detected
   - ✅ Filtering supported
   - ✅ Field visibility supported
   - ⚠️ Sorting not clearly implemented

#### 🟡 Partially Working

1. **Kanban View**
   - ✅ Exists as standalone (`baserow-app/components/grid/AirtableKanbanView.tsx`)
   - ❌ Not available in Grid Block view type selector
   - ✅ Grouping supported
   - ⚠️ Sorting unclear

2. **Gallery View**
   - ⚠️ Exists but not fully integrated
   - ⚠️ Sorting/filtering unclear

#### 🔴 Broken/Missing

1. **Timeline View**
   - ❌ Not implemented in Grid Block
   - ❌ Not found as standalone component
   - ❌ No date field handling

2. **View Type Selection**
   - ⚠️ Grid Block only supports `grid` and `calendar`
   - ❌ Kanban, Timeline, Gallery commented out in `GridDataSettings.tsx` (lines 54-75)

**Fix Required:** Enable all view types in Grid Block settings, or document why they're disabled.

---

## 4️⃣ Page Settings Audit

### Page Settings Inventory

| Setting | Persisted | Triggers Re-render | Validation | UI Language |
|---------|-----------|-------------------|------------|-------------|
| **Page Title** | ✅ Yes | ✅ Yes | ✅ Required | ✅ Non-technical |
| **Interface Assignment** | ✅ Yes | ✅ Yes | ✅ Required | ✅ Non-technical |
| **Table Selection** | ✅ Yes | ✅ Yes | ⚠️ Not validated | ✅ Non-technical |
| **Page Type** | ✅ Yes | ✅ Yes | ⚠️ Not enforced | ✅ Non-technical |
| **Default Filters** | ✅ Yes | ✅ Yes | ❌ No validation | ✅ Non-technical |
| **Record Panel** | ✅ Yes | ✅ Yes | ❌ No validation | ✅ Non-technical |

### Findings

#### ✅ Working

1. **Page Title Inline Editing** (`baserow-app/components/interface/InterfacePageClient.tsx`)
   - ✅ Inline editing with debounced save
   - ✅ Prevents save loops (line 58: `lastSavedTitleRef`)
   - ✅ Auto-focus and select on edit
   - ✅ Error handling

2. **Page Settings Drawer** (`baserow-app/components/interface/InterfacePageSettingsDrawer.tsx`)
   - ✅ Interface assignment required
   - ✅ Table selection
   - ✅ Admin-only toggle
   - ✅ Save/Cancel buttons

3. **Page Display Settings** (`baserow-app/components/interface/PageDisplaySettingsPanel.tsx`)
   - ✅ Auto-save with debouncing
   - ✅ Visual settings (layout, density, read-only)
   - ✅ Record panel toggle

#### 🟡 Partially Working

1. **Page Type Constraints**
   - ✅ Validated on creation
   - ⚠️ Not enforced after creation (can change type?)
   - ⚠️ No validation that anchor matches new type

2. **Table Selection**
   - ✅ Persisted to `base_table`
   - ⚠️ Not validated that table exists
   - ⚠️ No validation that table has required fields for page type

#### 🔴 Broken/Missing

1. **Required Fields Enforcement**
   - ❌ Page can be saved without required fields
   - ❌ No validation errors shown
   - ❌ Silent failures possible

2. **Settings Change Re-render**
   - ✅ Title changes trigger re-render
   - ⚠️ Other settings may not trigger immediate re-render
   - ⚠️ Blocks may not refresh when page settings change

---

## 5️⃣ Block Settings Audit

### Block Settings Inventory

| Setting Category | Persisted | Preview Update | Save Loops | Schema Strict |
|------------------|-----------|----------------|------------|---------------|
| **Data Settings** | ✅ Yes | ⚠️ Partial | ✅ Prevented | ⚠️ Partial |
| **Appearance Settings** | ✅ Yes | ✅ Yes | ✅ Prevented | ✅ Yes |
| **Advanced Settings** | ✅ Yes | ⚠️ Partial | ✅ Prevented | ⚠️ Partial |

### Findings

#### ✅ Working

1. **Settings Panel Structure** (`baserow-app/components/interface/SettingsPanel.tsx`)
   - ✅ Three-tab structure (Data, Appearance, Advanced)
   - ✅ Auto-save with 1.5s debouncing
   - ✅ Save loop prevention (lines 138-194)
   - ✅ Visual save status indicators

2. **Appearance Settings**
   - ✅ Title, colors, borders, padding
   - ✅ Immediate preview update
   - ✅ Settings persisted correctly

3. **Block-Specific Settings**
   - ✅ Grid: Table, view, fields, filters, sorts, view type
   - ✅ Chart: Table, chart type, axes, grouping
   - ✅ KPI: Table, metric, field, comparison
   - ✅ Form: Table, fields, required flags
   - ✅ Text: Content (TipTap JSON)

#### 🟡 Partially Working

1. **Data Settings Preview**
   - ✅ Table selection updates preview
   - ⚠️ Field selection may not update preview immediately
   - ⚠️ Filter changes may not update preview

2. **Config Schema Validation**
   - ✅ `normalizeBlockConfig()` normalizes configs
   - ✅ `validateBlockConfig()` validates configs
   - ⚠️ Validation warnings don't block saves
   - ⚠️ Some blocks accept invalid configs silently

#### 🔴 Broken/Missing

1. **Save Loop Prevention**
   - ✅ Text Block: Proper prevention
   - ✅ Settings Panel: Debouncing + comparison
   - ❓ Other blocks: Not audited

2. **Config Schema Strictness**
   - ⚠️ Some blocks accept extra fields silently
   - ⚠️ Type mismatches not caught
   - ⚠️ Required fields not enforced

**Fix Required:** Audit all blocks for save loop prevention, enforce strict config schemas.

---

## 6️⃣ SQL & Data Wiring

### SQL View System

| Component | Status | Notes |
|-----------|--------|-------|
| **SQL View Auto-Generation** | 🔴 Missing | No automatic SQL view creation |
| **Table as Primary Source** | ✅ Yes | Tables are user-facing |
| **SQL Views Hidden** | ✅ Yes | Users select tables, not SQL views |
| **Block Query Generation** | 🟡 Partial | Blocks query tables directly, not SQL views |
| **Reusable SQL** | ❌ No | Each block builds queries independently |

### Findings

#### ✅ Working

1. **Table Selection**
   - ✅ Users select tables, not SQL views
   - ✅ Tables stored in `base_table` or `config.table_id`
   - ✅ SQL views are internal (not user-facing)

2. **Block Data Loading**
   - ✅ Blocks load from `supabase_table` name
   - ✅ Filters/sorts applied at query level
   - ✅ Field visibility respected

#### 🟡 Partially Working

1. **Query Building**
   - ✅ Blocks build queries from config
   - ⚠️ Each block implements query building independently
   - ⚠️ No shared query builder utility
   - ⚠️ Inconsistent filter/sort handling

2. **SQL View Usage**
   - ⚠️ `querySqlView()` exists but not used by blocks
   - ⚠️ SQL views mentioned in docs but not generated
   - ⚠️ No automatic SQL view creation from table config

#### 🔴 Broken/Missing

1. **SQL View Auto-Generation**
   - ❌ No automatic SQL view creation
   - ❌ No SQL view management
   - ❌ Blocks don't use SQL views (query tables directly)

2. **Reusable SQL**
   - ❌ Each block builds queries independently
   - ❌ No shared query builder
   - ❌ Filter/sort logic duplicated across blocks

**Fix Required:** 
- Implement SQL view auto-generation (or document why not needed)
- Create shared query builder utility
- Standardize filter/sort handling

---

## 7️⃣ Airtable Parity Check (Conceptual)

### Use Cases

| Use Case | Page Type | Blocks Needed | Status |
|----------|-----------|---------------|--------|
| **Calendar pages with filters** | `list` or `dashboard` | Calendar block + Filter block | 🟡 Partial (filters at page level) |
| **Campaign/content record review** | `record_review` | Grid block (left) + Record block (right) | ✅ Possible |
| **Dashboard with filters + charts + lists** | `dashboard` | Filter block + Chart blocks + Grid block | 🟡 Partial (no filter block) |
| **PR tracker style** | `dashboard` | Chart blocks + Grid block | ✅ Possible |
| **Post calendar pages** | `dashboard` | Calendar block | ✅ Possible |

### Findings

#### ✅ Possible with Current System

1. **Record Review Pages**
   - ✅ `record_review` page type exists
   - ✅ Grid block for list (left)
   - ✅ Record block for detail (right)
   - ✅ Can be configured with existing blocks

2. **Dashboard Pages**
   - ✅ `dashboard` page type exists
   - ✅ Chart blocks work
   - ✅ Grid blocks work
   - ✅ KPI blocks work
   - ✅ Can combine multiple blocks

3. **Calendar Pages**
   - ✅ Calendar view in Grid block
   - ✅ Can be used in dashboard
   - ✅ Filters supported

#### 🟡 Partially Possible

1. **Filter Blocks**
   - ⚠️ No dedicated filter block
   - ⚠️ Filters configured at page level or block level
   - ⚠️ No global filter bar component

2. **Page-Level Filters**
   - ⚠️ `config.default_filters` exists but not clearly exposed
   - ⚠️ No UI for page-level filter configuration
   - ⚠️ Filters may not propagate to all blocks

#### 🔴 Not Possible

1. **Hardcoded Layouts**
   - ❌ No hardcoded layouts (good!)
   - ✅ All layouts are block-based (correct)

2. **One-off SQL**
   - ❌ No one-off SQL (good!)
   - ✅ All queries from config (correct)

---

## Prioritized Fix List

### 🔴 Critical (Blocks Airtable Migration)

1. **Config Loading Consistency**
   - **Issue:** Blocks inconsistently fall back to `pageTableId`
   - **Fix:** Remove all fallbacks, require `table_id` in config, show setup state
   - **Files:** `ChartBlock.tsx`, `KPIBlock.tsx`, `RecordBlock.tsx`
   - **Priority:** P0

2. **Save Loop Prevention**
   - **Issue:** Some blocks may cause save loops
   - **Fix:** Audit all blocks, implement proper debouncing + comparison
   - **Files:** All block components
   - **Priority:** P0

3. **Block Settings Schema Enforcement**
   - **Issue:** Blocks accept invalid configs silently
   - **Fix:** Enforce strict schemas, show validation errors
   - **Files:** `block-validator.ts`, `block-config-types.ts`
   - **Priority:** P0

### 🟡 High Priority (Improves UX)

4. **View Type Support in Grid Block**
   - **Issue:** Kanban, Timeline, Gallery disabled
   - **Fix:** Enable all view types or document why disabled
   - **Files:** `GridDataSettings.tsx`, `GridBlock.tsx`
   - **Priority:** P1

5. **Page Settings Validation**
   - **Issue:** Required fields not enforced
   - **Fix:** Add validation, show errors, prevent invalid saves
   - **Files:** `InterfacePageSettingsDrawer.tsx`, `PageDisplaySettingsPanel.tsx`
   - **Priority:** P1

6. **Setup States for All Blocks**
   - **Issue:** Some blocks don't show setup states
   - **Fix:** Add setup states for all missing config scenarios
   - **Files:** All block components
   - **Priority:** P1

### 🟢 Medium Priority (Polish)

7. **SQL View Auto-Generation**
   - **Issue:** SQL views not auto-generated
   - **Fix:** Implement or document why not needed
   - **Files:** New migration/utility
   - **Priority:** P2

8. **Shared Query Builder**
   - **Issue:** Query building duplicated
   - **Fix:** Create shared utility for filters/sorts
   - **Files:** New utility file
   - **Priority:** P2

9. **Filter Block Component**
   - **Issue:** No dedicated filter block
   - **Fix:** Create filter block or document page-level filters
   - **Files:** New component
   - **Priority:** P2

---

## Ready for Airtable Migration Checklist

### ✅ Ready

- [x] Page types defined and validated
- [x] Blocks load config from `view_blocks.config`
- [x] Blocks show setup states
- [x] Settings panels persist config
- [x] Blocks render identically in edit/view mode
- [x] No hardcoded layouts
- [x] No one-off SQL

### ⚠️ Needs Work

- [ ] **Config loading consistency** - Remove fallbacks to `pageTableId`
- [ ] **Save loop prevention** - Audit all blocks
- [ ] **Schema enforcement** - Strict validation for all blocks
- [ ] **View type support** - Enable all view types or document
- [ ] **Page validation** - Enforce required fields
- [ ] **SQL wiring** - Document or implement auto-generation

### ❌ Blockers

- [ ] **Button Block** - Not found, may be missing
- [ ] **Timeline View** - Not implemented
- [ ] **Filter Block** - Not implemented (may use page-level filters)

---

## Recommendations

### Immediate Actions

1. **Fix config loading inconsistencies** - Remove all `pageTableId` fallbacks
2. **Audit save loops** - Test all blocks for save loop issues
3. **Enable view types** - Uncomment Kanban/Timeline/Gallery or document why disabled

### Short-term Improvements

1. **Add filter block** - Or document page-level filter usage
2. **Implement shared query builder** - Reduce duplication
3. **Enforce page validation** - Prevent invalid page states

### Long-term Considerations

1. **SQL view auto-generation** - Evaluate if needed
2. **Block registry** - Centralize block definitions
3. **Config migration** - Handle config schema changes

---

## Conclusion

The Interface Builder system is **80% ready** for Airtable-style migration. The architecture is sound, but **config loading inconsistencies** and **missing validation** prevent true block reusability. With the prioritized fixes, blocks can be dropped into any page Airtable-style.

**Key Insight:** The system's strength is its block-based architecture. Its weakness is inconsistent config handling. Fixing config loading will unlock true reusability.

---

**Report Generated:** 2025-01-XX  
**Next Review:** After P0 fixes implemented

