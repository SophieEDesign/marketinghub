# Reimplement in safety order — commit and push per section

Each section is one commit + one push. If something breaks after a section, revert that commit (or that section’s push) and stop.

**Safest first (smallest, type/clarity-only), then error handling, then new behaviour.**

---

## Status: what's done vs what's left

**Done (on branch `revert-to-7fec709`):**


| Section | What was applied                                                                                                                                                                                                                                            |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**   | BlockConfig types (image field comment). HorizontalGroupedView already used `const` — no change.                                                                                                                                                            |
| **2**   | ViewFilterInput, ViewFilterGroupInput, `dbFiltersToFilterTree` accepts partial data. (No `parseFilterValue` — not in this codebase.)                                                                                                                        |
| **3**   | computeLookupValues: `getLookupDisplayValue()` helper for when metadata field name ≠ DB column. (No RLS migrations or full retry logic.)                                                                                                                    |
| **12**  | Navigation progress bar: new `NavigationProgress.tsx`, CSS in globals.css, added to root layout.                                                                                                                                                            |
| **6**   | Filter dialog, CSV, filter/grid view error handling (AbortError, retry, BlockRenderer useMemo, useGridData retry, computeLookupValues, lib/data 500 retry, CSVImportPanel ignore + defaultValuesForAll).                                                    |
| **9**   | Filter groups AND/OR and filter UI (FilterTree in useGridData, is_any_of/is_not_any_of types and evaluation, FilterDialog condition_type, field-operators, evaluateFilterTree is_any_of).                                                                   |
| **10**  | Click to add row (lib/data evaluateFilterTree, AirtableGridView new-row, GridView click row).                                                                                                                                                               |
| **11**  | BlockAppearanceWrapper and appearance flow (getAppearanceClasses → "", fixed padding, hasAppearanceSettings without container/spacing).                                                                                                                     |
| **14**  | LookupFieldPicker and FieldBuilderModal display modes (linked_field_display_mode 'list', FieldAppearanceSettings list option).                                                                                                                              |
| **15**  | Interface builder, block settings, grouping labels, Canvas (linkedFields UUID casing, groupTree lookup/raw, HorizontalGroupedCanvasModal settings dialog, HorizontalGroupedView onBlockSettingsClick, defaultBlockH, toId).                                 |
| **7**   | Modal, navigation, FieldBuilderModal (getOptionValueToLabelMap in select-options, KanbanView groupValueToLabel + displayName + groupingFieldName label match; HorizontalGroupedCanvasModal/NavigationDiagnostics layout already present).                   |
| **13**  | Modal layout and layout settings (canvas-layout-defaults.ts, MODAL_CANVAS_LAYOUT_CONSTRAINTS, Canvas CANVAS_LAYOUT_DEFAULTS + sync skip + resize compact, ModalCanvas/ModalLayoutEditor shared defaults + layoutSettings, RecordModal layoutSettings prop). |
| **5**   | GridView formatting and error handling (ErrLike type and type-safe error message/code extraction in GridView). |


**Skipped / not applicable:**


| Section | Reason                                                                                                   |
| ------- | -------------------------------------------------------------------------------------------------------- |
| **4**   | linkedFields: current file has different structure (no `useIdOnlyForDisplay` / `badDisplayColumnCache`). |
| **8**   | ViewPage has no getViews/debug block to refactor.                                                        |


**Left to do (in order):** None.


**Not in plan (per your choices):** Cap-aware pagination, CoreDataViewTabs, context menu/sidebar, duplicate CalendarView import.

---

## Section 1 — Clarity only (no behaviour change) — DONE

**Risk: lowest.** Variable names and types only.

- **c94881472a** Refactor variable declarations in HorizontalGroupedView
- **d7836e1ac9** BlockConfig interface (image field, deprecated color comments)

**Files:** HorizontalGroupedView.tsx, lib/interface/types.ts (BlockConfig).  
**Commit message:** `chore: reimplement Section 1 — HorizontalGroupedView clarity, BlockConfig types`

---

## Section 2 — Filter converters type safety — DONE

**Risk: low.** Filter parsing and dbFiltersToFilterTree accept partial/typed input.

- **8bf5d953b8** parseFilterValue type safety and JSON array strings
- **95f73f7cb3** dbFiltersToFilterTree accept partial filter data
- **4a9efe35b2** dbFiltersToFilterTree accept ViewFilterGroupInput

**Files:** lib/filters/converters.ts, possibly types.  
**Commit message:** `fix: reimplement Section 2 — filter converters type safety`

---

## Section 3 — computeLookupValues error handling and RLS — DONE (partial)

**Risk: low.** Lookup logic and optional RLS migration.

- **8d3287c32d** Type casting in computeLookupValues + RLS migration
- **ddd606bdb0** Error handling in computeLookupValues
- **3815147cd6** Lookup record fetching and error handling in FieldBlock and computeLookupValues

**Files:** lib/grid/computeLookupValues.ts, FieldBlock.tsx, supabase migrations if any.  
**Commit message:** `fix: reimplement Section 3 — computeLookupValues and lookup error handling`

---

## Section 4 — linkedFields and linked records — SKIPPED (different file structure)

**Risk: low.** Linked-fields helpers and linked-record types.

- **474f1a9d7c** linkedFields functions clarity and consistency
- **d550a092d3** Linked record handling and type safety

**Files:** lib/dataView/linkedFields.ts, various components using linked records.  
**Commit message:** `fix: reimplement Section 4 — linkedFields and linked record type safety`

---

## Section 5 — GridView formatting and error handling

**Risk: medium.** Grid behaviour and error paths.

- **0b99a01d96** GridView formatting and error handling
- **16405d4dc7** GridView error handling type safety

**Files:** GridView.tsx (grid + views), layout, CoreDataViewTabs/WorkspaceShellWrapper/debug-log if present.  
**Commit message:** `fix: reimplement Section 5 — GridView formatting and error handling`

---

## Section 6 — Filter dialog, CSV, filter/grid view error handling

**Risk: medium.** Filter UI and CSV import.

- **7e1d0179cf** Filter and CSV import error handling and mapping
- **8dd218ec7f** Error handling in filter and grid view components
- **ebad19dc2e** UnifiedFilterDialog and computeLookupValues error handling

**Files:** UnifiedFilterDialog, FilterDialog, CSVImportModal, CSVImportPanel, useGridData, AirtableGridView, BlockRenderer, computeLookupValues.  
**Commit message:** `fix: reimplement Section 6 — filter dialog, CSV, and grid view error handling`

---

## Section 7 — Modal, navigation, FieldBuilderModal

**Risk: low–medium.** Modals and field builder.

- **9c73c1b825** Modal and navigation diagnostics layout and error handling
- **365f50ea7c** FieldBuilderModal select options normalization

**Files:** HorizontalGroupedCanvasModal, NavigationDiagnostics, KanbanView, FieldBuilderModal, select-options.  
**Commit message:** `fix: reimplement Section 7 — modal, navigation, FieldBuilderModal options`

---

## Section 8 — ViewPage debug logging — SKIPPED (no getViews/debug block in current ViewPage)

**Risk: low.** Logging only.

- **b544322d66** ViewPage debug logging clarity and type safety

**Files:** ViewPage, possibly debug-log.ts (add if missing).  
**Commit message:** `chore: reimplement Section 8 — ViewPage debug logging`

---

## Section 9 — Filter groups (AND/OR) and filter UI

**Risk: medium.** Filter groups and filter components.

- **53d2ab973b** View filter groups in Airtable components
- **47ff7852c8** Filter components type handling and operator support
- **599daf9a15** Filter functionality and UI

**Files:** ViewPage, AirtableGridView, AirtableViewPage, Canvas, AirtableSidebar, CalendarView, useGridData, filter components, lib/interface/filters, computeLookupValues, migrations.  
**Commit message:** `feat: reimplement Section 9 — filter groups AND/OR and filter UI`

---

## Section 10 — Click to add row

**Risk: medium.** New grid behaviour.

- **7877563827** AirtableGridView and GridView “click to add” row

**Files:** AirtableGridView.tsx, GridView.tsx, lib/data.ts.  
**Commit message:** `feat: reimplement Section 10 — click to add row`

---

## Section 11 — BlockAppearanceWrapper

**Risk: low.** Appearance settings flow.

- **7050d387a5** BlockAppearanceWrapper and appearance settings

**Files:** BlockAppearanceWrapper, CommonAppearanceSettings, GridAppearanceSettings, blockSettingsRegistry, appearance-utils.  
**Commit message:** `refactor: reimplement Section 11 — BlockAppearanceWrapper and appearance flow`

---

## Section 12 — Navigation progress bar

**Risk: low.** New UI component.

- **188bc43096** Navigation progress bar and field display

**Files:** New NavigationProgress.tsx, globals.css, layout, loading, QuickFilterBar, InterfacePageClient, RecordReviewLeftColumn, CoreDataViewTabs, computeLookupValues, lib/interface/filters.  
**Commit message:** `feat: reimplement Section 12 — navigation progress bar`

---

## Section 13 — Modal layout and layout settings

**Risk: low–medium.** Modal and layout consistency.

- **5e96696a8c** Modal layout consistency and constraints
- **6ed523389d** Layout settings management

**Files:** RecordModal, Canvas, ModalCanvas, ModalLayoutEditor, canvas-layout-defaults.  
**Commit message:** `feat: reimplement Section 13 — modal layout and layout settings`

---

## Section 14 — LookupFieldPicker and FieldBuilderModal display modes

**Risk: low.** Picker and modal display options.

- **27b49a58aa** LookupFieldPicker and FieldBuilderModal display modes and option handling

**Files:** LookupFieldPicker, FieldBuilderModal, Canvas, FieldAppearanceSettings, InlineFieldEditor, HorizontalGroupedView, lib/interface/types.  
**Commit message:** `feat: reimplement Section 14 — LookupFieldPicker and FieldBuilderModal display modes`

---

## Section 15 — Interface builder, block settings, grouping labels, Canvas

**Risk: medium.** Builder and Canvas behaviour.

- **b368554baf** HorizontalGroupedCanvasModal and HorizontalGroupedView block settings
- **fd8f0fdccf** Canvas editing experience
- **1b886264d0** InterfaceBuilder and HorizontalGroupedView block settings and grouping labels
- **3fcf04be97** InterfaceBuilder and HorizontalGroupedView block settings and grouping labels

**Files:** Canvas, HorizontalGroupedCanvasModal, HorizontalGroupedView, InterfaceBuilder, linkedFields, groupTree.  
**Commit message:** `feat: reimplement Section 15 — interface builder, block settings, grouping labels, Canvas`

---

## If something breaks

- **Revert the last section:**  
`git revert HEAD --no-edit` then push, or  
`git reset --hard HEAD~1` then force-push if you haven't shared the branch yet.
- **Stop** and fix or drop that section before continuing.

---

## Commit and push each section yourself (if IDE git is locked)

Git in the IDE can hit lock errors (e.g. `HEAD.lock`). Run these in a **terminal outside the IDE** (e.g. PowerShell), with OneDrive sync paused for this folder if needed.

After each section is applied (by cherry-pick or by hand):

1. **Remove locks:**
  `Remove-Item .git/index.lock, .git/HEAD.lock -Force -ErrorAction SilentlyContinue`
2. **Stage only that section's files**, e.g.:
  `git add baserow-app/lib/interface/types.ts docs/REIMPLEMENT_SAFETY_ORDER.md`
3. **Commit:**
  `git commit -m "chore: reimplement Section 1 - BlockConfig types, safety-order doc"`
4. **Push:**
  `git push origin revert-to-7fec709`
5. **Test.** If anything breaks, revert that commit and push:
  `git revert HEAD --no-edit` then `git push origin revert-to-7fec709`

Repeat for Section 2, 3, etc., using the section commit messages in this doc.

---

## Not included (per your choices)

- Cap-aware pagination / row limits (7950a21078, fbd0129de1, etc.)
- CoreDataViewTabs (7b6f395fbc)
- Context menu / sidebar (790afa16a6)
- Duplicate CalendarView import (4828eb91e3)

