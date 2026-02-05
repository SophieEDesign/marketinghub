# Record editor shells – audit and safe wiring plan

**Scope:** Map data-loading, save, delete, validation, and permission logic for RecordPanel, RecordDrawer, and RecordDetailsPanel; identify what can delegate to `useRecordEditorCore` without changing UI, props, or behaviour. Plan only; no refactors.

---

## 1. Reference: `useRecordEditorCore` contract

**Location:** `baserow-app/lib/interface/record-editor-core.ts`

**Options:** `tableId`, `recordId`, `supabaseTableName?`, `tableFields?`, `modalFields?`, `initialData?`, `active?`, `onSave?(createdRecordId?)`, `onDeleted?`

**Result:**  
`loading`, `formData`, `setFormData`, `fields` (filtered), `effectiveTableName`, `saving`, `deleting`, `isCreateMode`, `save()`, `deleteRecord({ confirmMessage? })`, `handleFieldChange(fieldName, value)`, `normalizeUpdateValue(fieldName, value)`

**Core behaviour:**
- **Load:** When `active`, loads table info (supabase_table) if not provided, fields via `GET /api/tables/:tableId/fields` if not provided, and record from supabase when `recordId` + `effectiveTableName` exist.
- **Save:** Single `save()`; builds payload with link fields normalized, then supabase update or insert; calls `onSave(createdId?)`.
- **Delete:** `deleteRecord()` uses `confirm()`, then supabase delete; calls `onDeleted()`.
- **Field change:** Local state only (`setFormData`); no inline persist.
- **Permissions/validation:** None in core.

**Already using core:**  
`grid/RecordModal`, `calendar/RecordModal` (both use core for load/save/delete/fields; grid modal keeps custom inline field update + uuid rescue for compatibility).

---

## 2. Shell-by-shell logic map

### 2.1 RecordPanel

**Location:** `baserow-app/components/records/RecordPanel.tsx`  
**Context:** `RecordPanelContext` provides `state` (isOpen, tableId, recordId, tableName, modalFields, modalLayout, history, width, isPinned, isFullscreen) and actions (closeRecord, setWidth, togglePin, toggleFullscreen, navigateToLinkedRecord, goBack).

| Concern | Owner | Current behaviour |
|--------|--------|-------------------|
| **Data loading** | RecordPanel | `loadRecord()`: supabase `.from(state.tableName).select('*').eq('id', state.recordId).single()` when open. `loadFields()`: supabase `.from('table_fields').select('*').eq('table_id', state.tableId).order('order_index').order('position')`; filters by `state.modalFields` and builds `fieldGroups`. `loadFieldGroups()` no-op. |
| **Save** | RecordPanel | No bulk Save button. Inline per-field: `handleFieldChange` does optimistic `setFormData` + `setRecord`, then supabase `.update({ [fieldName]: value })`; on error toast + `loadRecord()` revert. |
| **Delete** | RecordPanel | `handleDelete`: `confirm()`, supabase delete, toast, `closeRecord()`. No role/permission check. |
| **Validation** | — | None. |
| **Permissions** | — | None (no admin-only delete or field checks). |
| **Other** | RecordPanel | Copy link, duplicate (supabase insert then `navigateToLinkedRecord`), resize/pin/fullscreen/back, keyboard Escape. |

**Delegation notes:**
- **Record load + formData:** Core can own load and form state; same semantics if `supabaseTableName` and `recordId` passed. Safe to delegate.
- **Fields:** Core loads via `GET /api/tables/:tableId/fields`; Panel loads via supabase `table_fields` with different ordering. Delegating would change source and possibly order → **do not delegate** if behaviour must stay identical.
- **Delete:** Core `deleteRecord` + `onDeleted` (toast + closeRecord) matches Panel; **can delegate** (shell keeps confirm UX via core’s built-in confirm, or keeps own ConfirmDialog if preferred; either way logic can be core).
- **Field change:** Core’s `handleFieldChange` is local-only. Panel needs inline persist. Core does not support “on change → supabase update”. So **do not delegate** handleFieldChange; keep Panel’s existing inline update.

---

### 2.2 RecordDrawer

**Location:** `baserow-app/components/grid/RecordDrawer.tsx`  
**Used by:** `AirtableKanbanView` (has `tableId`, passes `tableName`, `rowId`, `fieldNames`, `tableFields`, `onSave`, `onDelete`).

| Concern | Owner | Current behaviour |
|--------|--------|-------------------|
| **Data loading** | RecordDrawer | `loadRecord()` when `isOpen && rowId && tableName`: supabase `.from(tableName).select('*').eq('id', rowId).single()`. Fields from props (`tableFields`, `fieldNames`); no field fetch. |
| **Save** | RecordDrawer | `handleSave()`: supabase `.update(formData).eq('id', rowId)`; then `loadRecord()`, `onSave?.()`. No link normalization. |
| **Delete** | RecordDrawer | `handleDelete` opens ConfirmDialog; `confirmDelete()`: supabase delete, `onDelete?.()`, `onClose()`. No role check. |
| **Validation** | — | None. |
| **Permissions** | — | None. |
| **Other** | RecordDrawer | `handleFieldChange` local only (no inline persist). Escape closes. Collapsed sections in localStorage. |

**Delegation notes:**
- **Record load + formData:** Core does the same when `active`, `recordId`, `effectiveTableName`. Drawer can pass `supabaseTableName: tableName`, `tableFields` from props, `recordId: rowId`, `active: isOpen`. **Safe to delegate.**
- **Fields:** Drawer does not fetch fields; it uses `tableFields` + `fieldNames` to build `fieldsToDisplay`. Core can take `tableFields` and `modalFields: fieldNames` and return filtered `fields`. **Safe to delegate** (use core’s `fields` as the list to render).
- **Save:** Core `save()` does update with link normalization; then `onSave()`. Drawer currently calls `onSave()` after save; parent refetches and closes. Core does not call `onClose()`; shell can do that in `onSave`. **Safe to delegate** (use core.save + onSave callback to call parent’s onSave and optionally onClose).
- **Delete:** Core `deleteRecord` + `onDeleted` (onDelete + onClose). **Safe to delegate.**
- **Field change:** Both are local-only until Save; core’s `handleFieldChange` matches. **Safe to delegate.**
- **Props:** Drawer does not currently take `tableId`; core needs `tableId` only if table info/fields are loaded by core. Here we pass `tableFields` and `supabaseTableName`, so core does not need to fetch; **add optional `tableId`** for consistency (can be required by core API but not used when `supabaseTableName` + `tableFields` provided). No change to existing call site if we pass `tableId` from Kanban (already available).

---

### 2.3 RecordDetailsPanel

**Location:** `baserow-app/components/interface/RecordDetailsPanel.tsx`  
**Used by:** `RecordReviewView` (passes record, formData, fields, fieldGroups, visibleFields, pageEditable, editableFieldNames, onFieldChange, onRecordDelete, onRecordDuplicate, loading, etc.).

| Concern | Owner | Current behaviour |
|--------|--------|-------------------|
| **Data loading** | Parent (RecordReviewView) | Panel receives `record`, `formData`, `fields`, etc. Record = selected item from list (`data`); no separate record fetch. RecordReviewView loads table fields/name via `loadTableFields()` / `loadTableName()`. |
| **Save** | Parent | No bulk Save. RecordReviewView `handleFieldChange`: optimistic `setFormData`, then supabase single-field update; on error revert. Panel only calls `onFieldChange` (e.g. name edit). |
| **Delete** | RecordDetailsPanel | `handleDelete`: checks `canDeleteThisRecord` (page config + `canDeleteRecord(role, pageConfig)`), `confirm()`, then **`DELETE /api/interface-pages/:pageId/records/:recordId`** (not direct supabase). Then toast, `onRecordDelete(recordId)`. |
| **Duplicate** | RecordDetailsPanel | Direct supabase insert of `record` (minus id/created_at/updated_at), then `onRecordDuplicate(data.id)`. |
| **Validation** | — | None in panel. |
| **Permissions** | RecordDetailsPanel | Delete gated by `canDeleteThisRecord` (page config + role). |

**Delegation notes:**
- **Data loading:** Panel does not load; parent owns list + selection. Record comes from list, not a single-record fetch. Using core for “load selected record” would introduce a separate fetch and change semantics. **Do not delegate load** without a product decision to refetch selected record.
- **Save:** Parent does inline single-field update. Core has no “inline update” API. **Do not delegate** without changing to bulk Save or adding an inline-update path to core.
- **Delete:** Panel uses **API route** for interface-page delete (server-side enforcement). Core uses **direct supabase** delete. Delegating would change behaviour. **Do not delegate delete.**
- **Duplicate / copy link:** Core has no duplicate or copy-link. **Keep in panel.**

**Conclusion for RecordDetailsPanel:** No delegation to core without changing UI, props, or behaviour. RecordReviewView could later use core only if it switched to “single-record fetch + bulk save” and dropped the interface delete API; that would be a behaviour change and is out of scope for “safe wiring only”.

---

### 2.4 RecordPanelEditor

**Location:** `baserow-app/components/interface/RecordPanelEditor.tsx`  
**Role:** Edit **panel layout** (add/remove blocks for a record panel), not edit a single record. Loads page blocks and table fields for block picker. No record load/save/delete. **Out of scope** for useRecordEditorCore.

---

## 3. Safe wiring plan (no UI/props/behaviour change)

### 3.1 RecordPanel

**Goal:** Use core for record load, form state, and delete only. Keep existing fields source and inline field updates.

| Wire | Action |
|------|--------|
| **Record load + formData** | Call `useRecordEditorCore({ tableId: state.tableId, recordId: state.recordId, supabaseTableName: state.tableName, modalFields: state.modalFields, active: state.isOpen && !!state.tableId && !!state.recordId, onDeleted: () => { toast + closeRecord() } })`. Use `core.loading`, `core.formData`, `core.setFormData` for record and form. Remove Panel’s own `loadRecord()` and local record/formData load state. |
| **Fields** | Keep Panel’s `loadFields()` (supabase `table_fields`) and `fieldGroups` logic. Do **not** use core’s `fields` (different source). Keep filtering by `state.modalFields` in Panel. |
| **Delete** | Use `core.deleteRecord()` and `core.deleting`. In Panel’s delete handler, call `core.deleteRecord({ confirmMessage: '...' })`; rely on core’s `confirm()` and `onDeleted` for toast + close. Optionally keep Panel’s ConfirmDialog for UX parity with other shells; if so, open dialog on click and call `core.deleteRecord()` on confirm (with no confirmMessage to avoid double confirm). |
| **Field change** | Keep Panel’s `handleFieldChange` (optimistic update + supabase single-field update + revert on error). Do not use core’s `handleFieldChange`. |
| **Other** | Unchanged: copy link, duplicate, resize, pin, fullscreen, back, keyboard. |

**Props/context:** No change. Still driven by `useRecordPanel()` state.

---

### 3.2 RecordDrawer

**Goal:** Delegate all record load, form state, save, delete, and field list to core. Shell keeps only UI, layout, and callbacks.

| Wire | Action |
|------|--------|
| **tableId** | Add `tableId` to `RecordDrawerProps`. AirtableKanbanView already has `tableId`; pass it through. |
| **Core invocation** | `useRecordEditorCore({ tableId, recordId: rowId, supabaseTableName: tableName, tableFields, modalFields: fieldNames, active: isOpen, onSave: () => { onSave?.(); onClose() }, onDeleted: () => { onDelete?.(); onClose() } })`. |
| **Data / state** | Use `core.loading`, `core.formData`, `core.setFormData`, `core.fields`, `core.saving`, `core.deleting`. Remove local `loadRecord`, `handleSave`, `confirmDelete`, and related state. |
| **Save** | Footer Save button calls `core.save()`. Rely on `onSave` to run parent’s refetch and optionally `onClose` (as above). |
| **Delete** | Use `core.deleteRecord()` and `core.deleting`; keep existing ConfirmDialog, call `core.deleteRecord()` on confirm. `onDeleted` already handles `onDelete` + `onClose`. |
| **Field change** | Use `core.handleFieldChange`. |
| **Supabase usage** | Replace singleton `supabase` import with usage through core (no direct supabase in Drawer after wiring). |

**Props:** Add `tableId: string` to RecordDrawer. All other props unchanged. Kanban call site: add `tableId={tableId}`.

---

### 3.3 RecordDetailsPanel / RecordReviewView

**Goal:** No delegation to core in this phase.

| Wire | Action |
|------|--------|
| **All** | No change. Keep RecordReviewView’s load (table fields/name, record from list), inline `handleFieldChange`, and Panel’s API-based delete, duplicate, and copy link. Revisit only if product agrees to “single-record fetch + bulk save” and/or moving delete to core with an API/route option. |

---

## 4. Summary table

| Shell | Load record | Load fields | Save | Delete | Field change | Validation | Permissions |
|-------|-------------|-------------|------|--------|--------------|------------|-------------|
| **RecordPanel** | Delegate to core | Keep Panel (table_fields) | N/A (inline) | Delegate to core | Keep Panel (inline) | — | — |
| **RecordDrawer** | Delegate to core | Use core (tableFields + modalFields) | Delegate to core | Delegate to core | Delegate to core | — | — |
| **RecordDetailsPanel** | No (parent owns) | No (parent owns) | No (parent inline) | No (API route) | No (parent) | — | Keep in panel |

---

## 5. Implementation order (when implementing)

1. **RecordDrawer** – Add `tableId` prop, wire to `useRecordEditorCore` for load/form/save/delete/fields/handleFieldChange; remove local load/save/delete and singleton supabase.
2. **RecordPanel** – Wire core for record load, formData, and delete only; keep Panel’s loadFields and inline handleFieldChange.
3. **RecordDetailsPanel** – No wiring; document as “no safe delegation without behaviour change.”

---

*Audit and wiring plan only; no refactors, merges, or UI changes performed.*
