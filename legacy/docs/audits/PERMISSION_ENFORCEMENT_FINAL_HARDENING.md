# Permission Enforcement – Final Hardening Audit

**Status:** Audit & documentation only  
**Behaviour:** Unchanged  
**Scope:** Interfaces + Core Data  
**Date:** 2025-02-05

## Objective

Confirm that permission enforcement across all record-editing shells is:

- **Complete**
- **Consistent**
- **Future-safe**

This audit does not introduce:

- New permissions
- Stricter behaviour
- UX changes
- Permission model changes

Optional defence-in-depth dev warnings are documented as additive only and must never block or throw.

## Reference Documents

- **Existing audit:** [PERMISSION_ENFORCEMENT_VERIFICATION.md](PERMISSION_ENFORCEMENT_VERIFICATION.md)
- **Invariant (must remain true):** [PERMISSION_ENFORCEMENT_INVARIANT.md](../PERMISSION_ENFORCEMENT_INVARIANT.md)

---

## 1. Current State — Verified

### 1.1 Record Shells – Enforcement Summary

| Surface | canEdit | canCreate | canDelete | Notes |
|---------|---------|-----------|-----------|-------|
| **RecordModal (grid)** | UI + core | N/A (edit-only) | UI + core | RecordModal.tsx: handleFieldChange guard; isFieldEditable; core save() / deleteRecord() gated when cascadeContext != null. |
| **RecordModal (calendar)** | UI + core | UI + core | UI + core | canSave = recordId ? canEditRecords : canCreateRecords; fields isReadOnly={!canEditRecords}; core gated. |
| **RecordPanel** | UI + core when context present | N/A | UI + core when context present | allowEdit / allowDelete = cascadeContext != null ? can* : true. When context absent, panel is permissive by design. |
| **RecordDrawer** | UI + core | N/A | UI + core | Fields read-only when !canEdit; Save/Delete disabled; core gated. |
| **RecordDetailsPanel** | Page-level only | N/A | Page-level only | Uses pageEditable and canDeleteRecord(userRole, pageConfig). Does not use cascade context (different contract). |

### 1.2 Call Sites — Cascade Context Propagation

**Passes cascadeContext**

| Caller | Behaviour |
|--------|-----------|
| **GridView (grid)** | Opens RecordModal and RecordDrawer with cascadeContext; opens RecordPanel via openRecord(..., cascadeContext). |
| **GridBlock** | Passes cascadeContext={{ blockConfig }} into GridViewWrapper → GridView. |

**Does not pass cascadeContext (documented gap)**

- ListView
- GalleryView
- TimelineView
- KanbanView
- MultiCalendarView
- MultiTimelineView

**Result:** RecordPanel opens with cascadeContext === undefined → allowEdit === true, allowDelete === true. Behaviour is intentional and unchanged.

### 1.3 Inline Editing & FieldBlock

**Inline Grid Editing**

- GridView.tsx: `isViewOnly = permissions?.mode === 'view'`; cells editable only when !isViewOnly.
- Permissions flow: GridBlock → GridViewWrapper → GridView.
- **Status:** Verified and correct.

**Inline Card Editing (Kanban)**

- AirtableKanbanView.tsx: `canEdit = userRole === 'admin' || userRole === 'editor'` (role-based only, no block/cascade semantics).
- Used on Core Data (AirtableViewPage).
- **Status:** Documented; out of scope for change.

**FieldBlock – Linked Record Creation**

- Entry point gated by blockCanCreateRecords(config); onAddLinkedRecord omitted when create not allowed.
- Create modal does not receive cascadeContext; core create uses page-level permission when context absent.
- **Status:** Verified and correct.

### 1.4 Core Behaviour (Non-Throwing, Context-Conditional)

**File:** `record-editor-core.ts`

- **save()**  
  When cascadeContext != null: early-return if (editing and !canEditRecords) or (creating and !canCreateRecords). No throw, no UX block.
- **deleteRecord()**  
  When cascadeContext != null && !canDeleteRecords: early-return only. No throw.
- **When cascadeContext === null**  
  No permission checks in core; spreadsheet-like behaviour preserved.

**Invariant confirmed:** Core enforcement is additive and context-conditional only.

---

## 2. Audit Checklist — Confirmed

- [x] RecordModal (grid + calendar): UI + core gates verified
- [x] RecordPanel: enforced when context present; permissive otherwise (by design)
- [x] RecordDrawer: UI + core gates verified
- [x] RecordDetailsPanel: page-level only; no cascade bypass
- [x] Inline grid editing: permissions.mode enforced
- [x] Inline kanban editing: role-based only; documented
- [x] FieldBlock linked record creation: entry point gated

**Confirmed invariants:** canEditRecords, canCreateRecords, canDeleteRecords are enforced in UI, guarded in core, and ignored only when cascade context is intentionally absent.

---

## 3. Optional Defence-in-Depth (Additive Only)

Optional. Dev-only. Never throws. Never blocks UX.

### 3.1 Warn When RecordPanel Opens Without Cascade Context

- **Where:** RecordPanelContext.openRecord(...)
- **Condition:** cascadeContext === undefined && NODE_ENV === 'development'
- **Message:** “RecordPanel opened without cascadeContext; block-level permissions will not be enforced.”

### 3.2 Warn When Core No-Ops Due to Permission

- **Where:** record-editor-core.ts in save() and deleteRecord()
- **Condition:** Early-return because permission flag is false and cascadeContext != null
- **Message examples:**
  - “save skipped: cascadeContext present and canEditRecords=false”
  - “create skipped: cascadeContext present and canCreateRecords=false”
  - “delete skipped: cascadeContext present and canDeleteRecords=false”
- **Implementation note:** Use a dev-only helper (e.g. warnDev(...)); production builds must remain silent.

---

## 4. Deliverables

**Required**

- This document
- Cross-reference from PERMISSION_ENFORCEMENT_VERIFICATION.md and PERMISSION_ENFORCEMENT_INVARIANT.md

**Optional (Dev-Only)**

- Dev warning in RecordPanelContext
- Dev warnings in record-editor-core

---

## 5. Acceptance Criteria — Met

- No new restrictions ✅
- No regressions ✅
- Core Data behaviour unchanged ✅
- Interface behaviour consistent and documented ✅
- Permissions boring, predictable, and verified ✅

---

## 6. Explicitly Out of Scope

- Permission model changes
- UX changes
- New permissions
- Fixing call sites that omit cascadeContext
- Converting Kanban to cascade permissions
- Throwing or blocking behaviour

---

**Audit complete.**
