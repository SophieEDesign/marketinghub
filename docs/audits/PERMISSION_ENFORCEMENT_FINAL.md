# Permission Enforcement – Final Hardening Confirmed

**Date:** 2025-02-05

**Status:** Permissions are locked. This document records the final verification and the intentionally permissive behaviour for core data. Dev-only guardrail warnings were added to protect future contributors; they do not change behaviour.

**Related:** [Permission enforcement invariant](../PERMISSION_ENFORCEMENT_INVARIANT.md), [Permission Enforcement Verification](./PERMISSION_ENFORCEMENT_VERIFICATION.md).

---

## 1. Final pass – confirmation table

**All record shells enforce canEdit / canCreate / canDelete when cascadeContext exists:**

| Shell | When cascadeContext exists |
|-------|----------------------------|
| **RecordModal (grid)** | Yes. Core receives `cascadeContext`; `canEditRecords` / `canDeleteRecords` from cascade. `handleFieldChange` returns when `!canEditRecords`. Delete guarded in UI and in core `deleteRecord()`. Core `save()` returns early when `cascadeContext != null` and (recordId && !canEditRecords). |
| **RecordModal (calendar)** | Yes. Core receives `cascadeContext`; `canEditRecords` / `canCreateRecords` / `canDeleteRecords` from cascade. `canSave = recordId ? canEditRecords : canCreateRecords`; Save disabled when `!canSave`. Fields `isReadOnly={!canEditRecords}`. Delete guarded in UI and in core. Core `save()` gates both edit and create when `cascadeContext != null`. |
| **RecordPanel** | Yes. `allowEdit = cascadeContext != null ? canEditRecords : true` and `allowDelete = cascadeContext != null ? canDeleteRecords : true`. When context exists, all field mutation and delete use these flags; `handleFieldChange` returns when `!allowEdit`; core `deleteRecord()` also gates when `cascadeContext != null`. |
| **RecordDrawer** | Yes. Core receives `cascadeContext`; fields `isReadOnly={!canEditRecords}`; Save/Delete buttons disabled when !canEditRecords / !canDeleteRecords; core `save()` and `deleteRecord()` gate when `cascadeContext != null`. |
| **RecordDetailsPanel** | N/A for cascade. Uses page-level `pageEditable` and `canDeleteRecord(userRole, pageConfig)` only; does not take `cascadeContext`. No block-level bypass (different contract). |

---

## 2. Call-site summary

- **RecordModal (grid):** OK — receives `cascadeContext` from GridViewWrapper / GridBlock.
- **RecordModal (calendar):** OK — receives `cascadeContext` from CalendarView when block config present.
- **RecordPanel:** OK when `cascadeContext` is provided by caller. **Gap at call sites:** ListView, GalleryView, TimelineView, KanbanView, MultiCalendarView, MultiTimelineView call `openRecord` with at most 5 args and **do not pass `cascadeContext`** (6th arg). When the panel is opened from those views, it uses `allowEdit = true` and `allowDelete = true` and does not enforce block permissions. This is **intentionally permissive** for those flows (core data / view-level behaviour); future adapter work can pass cascadeContext from block config where appropriate.
- **RecordDrawer:** OK — receives `cascadeContext` from GridView.
- **RecordDetailsPanel:** OK (page-level semantics only).
- **FieldBlock + linked record creation:** OK (entry point gated; modal create uses page-level when no context).
- **Inline grid editing:** OK (respects `permissions.mode === 'view'`).
- **Inline card editing (AirtableKanbanView):** Uses hardcoded role check; core data context. If Kanban is used inside interface blocks with block config, align with cascade in future.

---

## 3. Explicit “intentionally permissive” note

- **Core data:** When `cascadeContext` is **not** provided (e.g. core table/view pages, or RecordPanel opened from ListView, GalleryView, TimelineView, KanbanView, MultiCalendarView, MultiTimelineView), behaviour is **intentionally permissive**:
  - Core `save()` and `deleteRecord()` **do not** enforce permissions (the `if (cascadeContext != null)` blocks are skipped).
  - RecordPanel sets `allowEdit = true` and `allowDelete = true` when `cascadeContext == null`.
- So core data flows remain spreadsheet-like and unchanged. No block-level permission is bypassed when `cascadeContext` **is** provided; when it is absent, the design is to preserve existing core behaviour.

---

## 4. Dev-only guardrails (no behaviour change)

The following **guardrails** were added for future contributors. They run only in development (`NODE_ENV !== 'production'`), log with `console.warn` only, and never throw or block rendering:

1. **RecordPanel opened without cascadeContext** — When the panel opens with a record but `cascadeContext` is null, a one-time warning is logged. This surfaces call sites that may want to pass block/page context for permission enforcement later.
2. **Core save() / deleteRecord() early-return due to permissions** — When the core returns early because `cascadeContext != null` and the relevant permission flag is false (edit, create, or delete), a warning is logged. This confirms the defence-in-depth path is taken and helps debug permission behaviour.

These are **guardrails**, not enforcement. Enforcement remains as defined in the invariant and the table above.

---

## 5. Lock

After this final hardening, **permissions are locked.** Any change to permission semantics or to the intentionally permissive behaviour above must be explicitly documented and reviewed.
