# Core Data UI Rules Enforcement (System Contract)

These rules are **non-negotiable system contracts** and must be enforced consistently across **all views, blocks, and editors**.

- **Canonical source**: This document is the single source of truth for Core Data UI rules.
- **When rules change**: Add/modify rules here first, then refactor code to comply.
- **PR expectation**: Any UI change that touches core data interactions must be checked against this document.

---

## 1. Record Navigation (Critical)

A record may **ONLY** be opened via:

- A dedicated row open chevron/arrow at the start of the row
- (Optional) double-click on the row background

Records must **NEVER** open via:

- Clicking text fields
- Clicking select or multi-select pills
- Clicking empty cells
- Clicking linked record pills (unless it opens the *linked* record)

Remove any generic `onRowClick` / `onCellClick` navigation handlers that violate this.

---

## 2. Inline Editing (Global)

- There is **NO global edit mode**.
- All fields are **editable inline** on click.
- **Autosave** on blur / Enter.
- **Escape cancels**.
- Do **NOT** show per-field “Edit” buttons/links.

---

## 3. Pill Rendering (Strict Consistency)

Any **select**, **multi-select**, or **linked record** field must render as **pills everywhere**:

- Grid view
- Record view
- Gallery view
- Calendar view
- Kanban view
- Timeline view
- Any future block

Never render these fields as plain text or IDs. Pill appearance and interaction must be consistent across all blocks.

---

## 4. Linked Record Fields (Bi-Directional)

A linked relationship has:

- **One owning field** (editable)
- **One mirrored field** (read-only)

### Owning field

- Editable pill list
- Add/remove/search allowed
- Clicking a pill opens the **linked record**

### Mirrored field

- Pills are navigation-only
- No add/remove UI
- Label clearly indicates: **“Linked from [Table Name]”**
- Clicking a linked pill must **NEVER** open the current record

---

## 5. Empty Cells

- Clicking an empty cell enters inline edit.
- Empty cells must **never navigate**.
- Never show internal IDs or placeholders.

---

## 6. Grid View Rules

- **First column = row open chevron only**.
- Row background click selects the row only.
- No implicit navigation from cells.
- Inline editing must not trigger navigation.

---

## 7. Record View Loading

- Never render internal record IDs in the UI (even briefly). IDs are routing only.
- Record view must have explicit states:
  - Loading (skeleton)
  - Ready
  - Not found / error
- Do not render partial content.

---

## 8. Layout Persistence

Persist layout changes **ONLY** when:

- User explicitly drags a block
- User explicitly resizes a block

Never persist layout changes caused by:

- Browser resize
- Modal open/close
- Sidebar toggle
- Edit/view mode changes
- Initial mount or reflow

If the user didn’t interact, do not save layout.

---

## 9. Filters

- View default filters (builder-owned) and user quick filters (user-owned) must be **separate**.
- User filter changes must **never overwrite** view defaults.
- Provide a **“Reset to view defaults”** option.

---

## 10. Enforcement Rule

Any new or existing block must comply with all rules above.

- If behaviour differs between blocks, refactor to the shared rule, not the exception.
- **Consistency takes priority over convenience.**

---

## UX Principle

Match Airtable’s behaviour wherever applicable:

- Explicit navigation
- Inline editing
- Predictable pills
- No accidental actions

If Airtable would not do it, neither should this system.

---

## Change Log

- **2026-01-16**: Canonical rules document created and pinned as system contract.

