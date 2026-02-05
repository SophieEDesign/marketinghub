# Permission Enforcement Verification (Audit)

**Scope:** Audit-only verification that permission enforcement is complete and consistent. No code changes unless a missing enforcement is found.

**Date:** 2025-02-05

**Invariant (frozen):** See [Permission enforcement invariant](../PERMISSION_ENFORCEMENT_INVARIANT.md). When `cascadeContext` is provided, record mutation is governed exclusively by `canEditRecords`, `canCreateRecords`, and `canDeleteRecords` (UI + core). When not provided, core-data behaviour remains unchanged.

---

## 1. Table of surfaces vs permission flags


| Surface                            | canEditRecords (field mutation)                                                                                                                                                                                         | canCreateRecords (create flows)                                                                                                                                                                                                                                           | canDeleteRecords (delete)                                                                                                                    | Verdict                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **RecordModal (grid)**             | Yes: `handleFieldChange` guards with `!canEditRecords`; `RecordFields`/`ModalCanvas` get `isFieldEditable={() => canEditRecords}` / `pageEditable={canEditRecords}`; core `save()` gated when `cascadeContext != null`. | N/A (edit-only modal)                                                                                                                                                                                                                                                     | Yes: `handleDeleteRecord` checks `canDeleteRecords`; delete button disabled/title when `!canDeleteRecords`; core `deleteRecord` gated.       | **OK**                                                                 |
| **RecordModal (calendar)**         | Yes: `FieldEditor` `isReadOnly={!canEditRecords}`; `ModalCanvas` `pageEditable={canEditRecords}`; core `save()` gated.                                                                                                  | Yes: `canSave = recordId ? canEditRecords : canCreateRecords`; Save button disabled when `!canSave`; core `save()` gates create when `cascadeContext != null`.                                                                                                            | Yes: `handleDelete` checks `canDeleteRecords`; Delete button disabled/title; core `deleteRecord` gated.                                      | **OK**                                                                 |
| **RecordPanel**                    | Yes: `handleFieldChange` returns when `!allowEdit` (`allowEdit = cascadeContext != null ? canEditRecords : true`); `RecordFields` `isFieldEditable={() => allowEdit}`; `RecordHeader` `canEdit={allowEdit}`.            | N/A (panel is open on existing record)                                                                                                                                                                                                                                    | Yes: `handleDelete` checks `allowDelete`; `RecordHeader` `canDelete={allowDelete}`; core `deleteRecord` gated.                               | **OK** (when `cascadeContext` is provided)                             |
| **RecordDrawer**                   | Yes: `FieldEditor` `isReadOnly={!canEditRecords}`; Save button disabled when `!canEditRecords`; core `save()` gated.                                                                                                    | N/A (drawer is row-based, no create)                                                                                                                                                                                                                                      | Yes: Delete button disabled when `!canDeleteRecords`; core `deleteRecord` gated.                                                             | **OK**                                                                 |
| **RecordDetailsPanel**             | Yes: `pageEditable` gates title edit and `RecordFields` via `isFieldEditable`; duplicate disabled when `!pageEditable`. Uses page-level `config.allow_editing`, not cascade.                                            | N/A (details only)                                                                                                                                                                                                                                                        | Yes: `canDeleteThisRecord = pageEditable && canDeleteRecord(userRole, pageConfig)`; delete button/menu disabled when `!canDeleteThisRecord`. | **OK** (page-level semantics)                                          |
| **FieldBlock**                     | Inline edit gated by `canEditInline` (from `allow_inline_edit` + `inline_edit_permission` admin/member/both).                                                                                                           | Linked record creation: “Add” entry point gated by `blockCanCreateRecords(config)` (`onAddLinkedRecord={blockCanCreate ? handleAddLinkedRecord : undefined}`). Create modal does **not** receive `cascadeContext`; modal Save uses page-level create when context absent. | N/A                                                                                                                                          | **OK** (entry point gated; modal create is page-level when no context) |
| **Inline grid editing (GridView)** | Yes: `canEdit = !isViewOnly` where `isViewOnly = permissions?.mode === 'view'`; cells get `editable={canEdit && !isVirtual && rowId !== null}`. `permissions` from GridViewWrapper ← GridBlock block config.            | N/A (create is separate flow)                                                                                                                                                                                                                                             | Inline delete not in grid cells; delete via RecordModal/RecordPanel.                                                                         | **OK**                                                                 |
| **Inline card editing (Kanban)**   | **MISSING** (see below)                                                                                                                                                                                                 | N/A                                                                                                                                                                                                                                                                       | N/A                                                                                                                                          | **MISSING**                                                            |


---

## 2. Explicit OK / MISSING per surface

- **RecordModal (grid):** OK  
- **RecordModal (calendar):** OK  
- **RecordPanel:** OK when `cascadeContext` is provided by caller. **MISSING** at call sites that open the panel without passing `cascadeContext`: ListView, GalleryView, TimelineView, KanbanView, MultiCalendarView, MultiTimelineView (they call `openRecord` with at most 4 args; `cascadeContext` is 6th arg and is never passed). So the panel then uses `allowEdit = true`, `allowDelete = true` and does not enforce block permissions.  
- **RecordDrawer:** OK  
- **RecordDetailsPanel:** OK (page-level `pageEditable` and `canDeleteRecord(userRole, pageConfig)`).  
- **FieldBlock + linked record creation:** OK (button gated by `blockCanCreateRecords`; modal create uses page-level when no cascadeContext).  
- **Inline grid editing:** OK (respects `permissions.mode === 'view'` via `canEdit`).  
- **Inline card editing (AirtableKanbanView):** **MISSING** — `canEdit = userRole === "admin" || userRole === "editor"` is a hardcoded role check; it does not use block/cascade permissions. Used on AirtableViewPage (core data), so cascade semantics do not apply there; if Kanban is ever used in interface blocks with block config, this would be inconsistent.

---

## 3. Core data vs interfaces

- **Core data:** GridView (and grid RecordModal/RecordDrawer) when used without `cascadeContext` (e.g. from core table/view pages) keep spreadsheet-like behaviour: no cascade, so `allowEdit`/`allowDelete` fall back to true when `cascadeContext` is null (by design in RecordPanel and core).  
- **Interfaces:** RecordModal (grid/calendar), RecordPanel, RecordDrawer, and RecordDetailsPanel use either cascade (when context provided) or page-level config; interfaces remain stricter and guided where context/config is passed.

---

## 4. Hardcoded role checks (candidate for cascade semantics)


| Location                     | Current behaviour                                                    | Note                                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **AirtableKanbanView**       | `canEdit = userRole === "admin" || userRole === "editor"`            | Core data context; replace with cascade/block permissions if Kanban is used inside interface blocks.                          |
| **FieldBlock** (inline edit) | `editPermission === 'admin' && userRole === 'admin'` etc.            | Block-level field setting (admin/member/both); distinct from block `mode` view/edit; could be aligned with cascade in future. |
| **RecordDetailsPanel**       | `canDeleteRecord(userRole, pageConfig)`                              | Page-level record_actions (admin/both); by design, not block cascade.                                                         |
| **BulkEditModal**            | `userRole === "admin"` / `"editor"` for canEdit, admin for canDelete | Hardcoded roles; if used in interface context should derive from cascade.                                                     |
| **ViewBuilderToolbar**       | `canEdit = userRole === "admin" || userRole === "editor"`            | Core data / view builder; admin-only for manage views.                                                                        |


---

## 5. Summary

- **Shells (RecordModal grid/calendar, RecordPanel, RecordDrawer, RecordDetailsPanel):** Enforcement is **OK** for canEditRecords / canCreateRecords / canDeleteRecords on the components themselves. **Gap:** RecordPanel does not enforce when opened from ListView, GalleryView, TimelineView, KanbanView, MultiCalendarView, MultiTimelineView because they do not pass `cascadeContext`.  
- **FieldBlock + linked record creation:** **OK** (gated at entry point; modal create page-level when no context).  
- **Inline grid editing:** **OK** (respects `canEditRecords` via `permissions.mode === 'view'`).  
- **Inline card editing (Kanban):** **MISSING** (hardcoded role; no block/cascade).  
- **Core data behaviour:** Remains spreadsheet-like when `cascadeContext` is absent.  
- **Interfaces:** Remain stricter and guided where cascade or page config is provided.

---

## 6. Final pass – confirmation

**1. All record shells enforce canEdit / canCreate / canDelete when cascadeContext exists**

| Shell | When cascadeContext exists |
|-------|----------------------------|
| **RecordModal (grid)** | Yes. Core receives `cascadeContext`; `canEditRecords` / `canDeleteRecords` from cascade. `handleFieldChange` returns when `!canEditRecords`. Delete guarded in UI and in core `deleteRecord()`. Core `save()` returns early when `cascadeContext != null` and (recordId && !canEditRecords). |
| **RecordModal (calendar)** | Yes. Core receives `cascadeContext`; `canEditRecords` / `canCreateRecords` / `canDeleteRecords` from cascade. `canSave = recordId ? canEditRecords : canCreateRecords`; Save disabled when `!canSave`. Fields `isReadOnly={!canEditRecords}`. Delete guarded in UI and in core. Core `save()` gates both edit and create when `cascadeContext != null`. |
| **RecordPanel** | Yes. `allowEdit = cascadeContext != null ? canEditRecords : true` and `allowDelete = cascadeContext != null ? canDeleteRecords : true`. When context exists, all field mutation and delete use these flags; `handleFieldChange` returns when `!allowEdit`; core `deleteRecord()` also gates when `cascadeContext != null`. |
| **RecordDrawer** | Yes. Core receives `cascadeContext`; fields `isReadOnly={!canEditRecords}`; Save/Delete buttons disabled when !canEditRecords / !canDeleteRecords; core `save()` and `deleteRecord()` gate when `cascadeContext != null`. |
| **RecordDetailsPanel** | N/A for cascade. Uses page-level `pageEditable` and `canDeleteRecord(userRole, pageConfig)` only; does not take `cascadeContext`. No block-level bypass (different contract). |

**2. No block-level permission is bypassed**

- When `cascadeContext` is present, every shell uses the same core (`useRecordEditorCore`), which derives `canEditRecords` / `canCreateRecords` / `canDeleteRecords` from `permission-cascade` (and thus block `mode`, `allowInlineCreate`, `allowInlineDelete`). Core `save()` and `deleteRecord()` both early-return when context exists and the corresponding flag is false. UI (buttons, fields, handlers) disables or no-ops using the same flags. There is no code path that performs edit/create/delete when cascadeContext exists and the relevant permission is false.

**3. Core data behaviour unchanged**

- When `cascadeContext` is null (e.g. core data table/view, or RecordPanel opened from views that do not pass context): core `save()` and `deleteRecord()` do **not** enforce permissions (the `if (cascadeContext != null)` blocks are skipped). RecordPanel sets `allowEdit = true` and `allowDelete = true` when `cascadeContext == null`. So core data flows remain spreadsheet-like and unchanged.

