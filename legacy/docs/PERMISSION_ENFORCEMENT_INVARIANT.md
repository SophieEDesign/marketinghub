# Permission enforcement invariant

**Do not change behaviour that breaks this invariant.** It prevents regressions in record mutation and core-data flows.

---

## Invariant

- **When `cascadeContext` is provided,** record mutation is governed **exclusively** by `canEditRecords`, `canCreateRecords`, and `canDeleteRecords`, enforced in **both** UI and core (e.g. `record-editor-core` save/delete, shell buttons and field editability).
- **When `cascadeContext` is not provided,** core-data behaviour remains unchanged (spreadsheet-like; no permission gating in core or in RecordPanel edit/delete).

Shells that use the core with `cascadeContext` must honour these flags in UI (disabled buttons, read-only fields, no-op handlers) and rely on the core to gate `save()` and `deleteRecord()` when context is present.

See: `baserow-app/lib/interface/record-editor-core.ts`, [docs/audits/PERMISSION_ENFORCEMENT_VERIFICATION.md](audits/PERMISSION_ENFORCEMENT_VERIFICATION.md), [docs/audits/PERMISSION_ENFORCEMENT_FINAL_HARDENING.md](audits/PERMISSION_ENFORCEMENT_FINAL_HARDENING.md).

---

## Smoke test matrix (documented expectations)

Lightweight checklist to catch regressions. Not full automated tests — manual or future E2E.

| Scenario | Expected |
|----------|----------|
| **GridBlock (view mode)** → open record → **RecordModal** | No edits: fields read-only, Save/Delete disabled or hidden. |
| **CalendarBlock** with block create disabled (no create) → open create modal (e.g. click empty date) | **Save disabled** (canCreateRecords false). |
| **RecordPanel** opened from **GridBlock** (with cascadeContext, e.g. view-only block) | **Delete disabled** (and edit disabled if block is view-only). |
| **RecordPanel** opened from **core grid** (no cascadeContext) | **Delete allowed** (and edit allowed); core-data behaviour unchanged. |
| **RecordDrawer** with cascadeContext (view-only block) | Fields read-only, Save and Delete disabled. |
| **RecordModal (calendar)** with cascadeContext (edit block) → create new record | Save enabled; after save, edit/delete follow canEdit/canDelete. |

When adding or refactoring shells or core, run through the relevant rows to confirm the invariant still holds.
