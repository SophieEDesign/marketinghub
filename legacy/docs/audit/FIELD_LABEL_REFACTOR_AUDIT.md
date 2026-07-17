# Field Label Refactor Audit (7fec709)

**Commit:** `7fec709` – "Refactor field label handling and layout across components for improved consistency"  
**Date:** Jan 30, 2026  
**Symptom:** Core Data (grid) works; other views/features do not.

---

## Summary

The refactor introduced shared field label utilities (`field-label.ts`, `getFieldDisplayName`) and applied them across record/field components. Core Data uses the grid path (`AirtableViewPage` → `AirtableGridView`), which was **not** modified. Other paths (List, Gallery, Kanban, Calendar, Timeline, Form, Interface pages) use `NonGridViewWrapper` and components that **were** modified. This split explains why only Core Data appears to work.

---

## Architecture: What Works vs What Doesn't


| Path                                                | Component Chain                                                            | Refactored?                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Core Data (grid)**                                | ViewPage → AirtableViewPage → AirtableGridView                             | ❌ No                                                              |
| **List, Gallery, Kanban, Calendar, Timeline, Form** | ViewPage → NonGridViewWrapper → ListView / GalleryView / KanbanView / etc. | ✅ Uses RecordModal/RecordPanel → RecordFields → InlineFieldEditor |
| **Interface / Record Review**                       | InterfacePage → BlockRenderer → FieldBlock / FieldSectionBlock             | ✅ Yes                                                             |
| **Record modal (from any view)**                    | RecordModal / RecordPanel → RecordFields → InlineFieldEditor               | ✅ Yes                                                             |


---

## Files Changed in 7fec709


| File                                                       | Change                                                                           | Risk                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `lib/fields/field-label.ts`                                | New: `FIELD_LABEL_CLASS`, `FIELD_LABEL_CLASS_NO_MARGIN`, `FIELD_LABEL_GAP_CLASS` | Low                                                                 |
| `lib/fields/display.ts`                                    | `getFieldDisplayName(field)` – expects `{ name, label }`                         | **Medium** – crashes if `field` is null/undefined or missing `name` |
| `components/records/InlineFieldEditor.tsx`                 | Uses `FIELD_LABEL_*`, `getFieldDisplayName`                                      | **High** – used in RecordModal, RecordPanel, RecordFields           |
| `components/records/RecordFields.tsx`                      | Uses `FIELD_LABEL_*`, `getFieldDisplayName`                                      | **High**                                                            |
| `components/records/RecordFieldPanel.tsx`                  | Uses `FIELD_LABEL_CLASS`, `getFieldDisplayName`                                  | Medium                                                              |
| `components/interface/blocks/FieldBlock.tsx`               | Uses `FIELD_LABEL_*`, `getFieldDisplayName`                                      | **High** – interface pages                                          |
| `components/interface/blocks/FieldSectionBlock.tsx`        | Uses `FIELD_LABEL_*`, `getFieldDisplayName`                                      | **High**                                                            |
| `components/grid/AirtableKanbanView.tsx`                   | Uses `getFieldDisplayName`                                                       | Low – Kanban in Core Data path rarely used                          |
| `components/fields/FieldEditor.tsx`                        | Uses `FIELD_LABEL_*`, `getFieldDisplayName`                                      | Medium                                                              |
| `components/fields/RichTextEditor.tsx`                     | Layout/styling changes                                                           | Low                                                                 |
| `components/interface/settings/RecordViewPageSettings.tsx` | Uses `getFieldDisplayName`                                                       | Medium                                                              |


---

## Hypotheses for "Nothing Else Works"

### H1: `getFieldDisplayName` receives invalid input

**Mechanism:** `getFieldDisplayName(field)` expects `Pick<TableField, "name" | "label">`. If `field` is:

- `null` or `undefined` → runtime error
- Object with `field_name` instead of `name` (e.g. from `view_fields`) → `field.name` is undefined, `formatFieldNameForDisplay("")` returns `""` (no crash)
- Missing `name` → fallback to `""` (no crash)

**Evidence:** No null checks before `getFieldDisplayName(field)` in InlineFieldEditor, RecordFields, FieldBlock.

### H2: `tableFields` or `viewFields` empty / wrong shape for non-grid views

**Mechanism:** NonGridViewWrapper passes `fieldIds` from `viewFields.map(f => f.field_name)` and `tableFields` from ViewPage. If `getViews` fails or returns empty, `fieldIds` could be empty. If `tableFields` is empty, lookups like `tableFields.find(f => f.name === key)` return undefined.

**Evidence:** ViewPage has try/catch on `getViews`; early return when `views.length === 0` prevents rendering CoreDataViewTabs but not the view content.

### H3: ViewPage throws before reaching non-grid render path

**Mechanism:** Server error in ViewPage (e.g. in `getTable`, `getView`, `getViews`, or Promise.allSettled block) could cause redirect/error UI instead of NonGridViewWrapper.

**Evidence:** ViewPage has broad try/catch; errors surface as "An error occurred while loading this view."

### H4: `fieldIds` derived from `view_fields` – mismatch with `table_fields`

**Mechanism:** `view_fields.field_name` is the internal column name. `table_fields` has `name`. If view_fields references fields not in table_fields (e.g. deleted fields), or ordering differs, components may receive mismatched data.

### H5: Layout / className changes cause invisible or broken UI

**Mechanism:** `FIELD_LABEL_GAP_CLASS` (`space-y-1.5`) or `FIELD_LABEL_CLASS_NO_MARGIN` changes could affect flex layout, causing content to collapse or overflow incorrectly.

---

## Components That Use Refactored Code

- **RecordModal** (List, Gallery, Kanban, Calendar, Timeline) → RecordFields → InlineFieldEditor
- **RecordPanel** (full-screen record) → RecordFields → InlineFieldEditor
- **BlockRenderer** (interface pages) → FieldBlock / FieldSectionBlock → InlineFieldEditor
- **RecordDetailsPanel** → RecordFields → InlineFieldEditor

Any crash in InlineFieldEditor, RecordFields, FieldBlock, or FieldSectionBlock when opening a record would explain "nothing else works" if the failure blocks the whole page or modal.

---

## Note on "HuyLAvHUN"

If this is a view ID, table ID, or similar identifier:

- No matches in the codebase
- Could be a Supabase UUID shown in the UI
- Consider checking browser console/network for errors when loading that view

---

## Recommended Next Steps

1. **Add defensive null checks** in `getFieldDisplayName` and at call sites that pass `field`.
2. **Add instrumentation** (debug logs) in ViewPage, NonGridViewWrapper, RecordFields, and InlineFieldEditor to trace:
  - Whether non-grid views render at all
  - Whether `tableFields` / `fieldIds` are populated
  - Whether `getFieldDisplayName` receives valid field objects
  - Any thrown errors
3. **Reproduce** with browser DevTools open (Console, Network) and note the exact error or blank screen behavior.
4. **Compare** behavior before/after `7fec709` (e.g. `git checkout 7fec709~1` and re-test).

