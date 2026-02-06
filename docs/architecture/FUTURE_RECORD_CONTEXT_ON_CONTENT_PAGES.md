# Future Capability: Record Context on Content Pages

**Status:** Design only — not implemented.  
**Role:** Canonical **future design goal** from the Page Type Consolidation decision (record-centric experience achievable via Content page + Record List block + Record context when prioritised).

This document defines a future capability that would allow content pages to hold a shared, ephemeral record context, enabling blocks on a content page to react to a single selected record in the same way they do on record_view and record_review pages.

This document does not propose or require any implementation.
No code changes, UI changes, page-type changes, migrations, or deprecations are implied.

## Non-Goals (Explicit)

- This does **not** replace record_view or record_review.
- Record pages remain first-class and unchanged.
- This does **not** introduce a new data model, database table, or saved state.
- This does **not** require blocks to change their configuration schema.
- This does **not** define UI or component implementations.

## Background

**Today:**

- record_view and record_review pages maintain an ephemeral selected record (recordId) as page-level UI state.
- That state is passed through:
  - Page → InterfaceBuilder → Canvas → BlockRenderer → blocks
- Blocks that support record context (e.g. RecordBlock, FieldBlock) already react to recordId when provided.
- Content pages do not currently provide a page-level record context. Blocks on content pages only receive a record ID when:
  - It is statically configured in the block, or
  - Navigation opens a record editor (modal/panel/drawer).

This document defines how content pages could gain an optional, shared record context without changing existing page types or behaviour.

---

## 1. Where Record Context Lives (Single Model)

Record context lives at the **page level**.

Each content page may hold one ephemeral record context:

```
recordContext = { recordId, tableId } | null
```

This context exists only in UI state.
It is not persisted to page config, block config, or the database.

**Ownership**

- The page container (the component that renders the content-page canvas) owns record context.
- The canvas and blocks are consumers, not owners.

**Explicitly not allowed**

- Record context is not owned by the canvas.
- Record context is not stored per block.
- Record context is not saved to the page model or block configuration.

---

## 2. Optional URL Synchronisation

Record context may optionally be reflected in the URL for deep-linking and sharing.

Example:

```
/pages/{pageId}?recordId=abc123&tableId=xyz
```

**Rules:**

- The URL is used only to set initial context on page load.
- After load, page-level state is the source of truth.
- Updating record context may update the URL.
- Clearing record context may remove the URL parameters.
- The URL is a reflection, not a second data model.

---

## 3. Who Can Set Record Context

All setters update the same page-level state via a single API.

### 3.1 Data Blocks

Blocks that already deal with records (e.g. Grid, List, Calendar, Kanban) may set record context when the user selects a record.

Example actions:

- Row click
- Card click
- Calendar item select

These blocks call a page-provided callback such as:

```
onRecordContextChange({ recordId, tableId })
```

(or an extension of the existing onRecordClick contract).

### 3.2 Optional “Record Context” Block (Future)

A dedicated block may exist whose sole responsibility is to set or clear record context (e.g. picker, dropdown, search).

- It uses the same setter as data blocks.
- It introduces no new model or special rules.

### 3.3 URL on Load

If the page is opened with `?recordId=...`, the page sets initial context once on load.
After that, normal page-level state rules apply.

---

## 4. Conflict Handling

There is exactly one record context per content page.

**Rules:**

- **Last write wins** — whichever setter runs last updates the context.
- There is no priority between blocks.
- Clearing the context sets it to null.

**Clearing**

Context may be cleared by:

- An explicit “clear selection” action in a block
- A dedicated Record Context block
- Navigating away from the page

There are no implicit clears and no reconciliation rules.

---

## 5. How Context Is Passed to Blocks

The propagation model is identical to record_review pages.

When record context exists:

```
Page
  → InterfaceBuilder (recordId, tableId)
    → Canvas
      → BlockRenderer
        → Blocks
```

**Key points:**

- No new rendering pipeline is introduced.
- No second “content-page record API” exists.
- Blocks that already support record context simply receive recordId when present.
- Blocks that do not care about records remain unaffected.

---

## 6. Coexistence with Record Pages

This capability does not change record pages.

- record_view and record_review remain first-class.
- Their fixed left-column behaviour remains unique and guaranteed.
- No migration from record pages to content pages is implied or required.

Content pages simply gain an optional capability:

A content page may have:

- **No record context** (current behaviour), or
- **One shared record context** (future behaviour).

There is no requirement that content pages use record context.

---

## 7. Data Model and Persistence Guarantees

- Record context is ephemeral UI state only.
- No database schema changes are introduced.
- No page config or block config is extended to store “current record”.
- The existing RECORD_REVIEW_CORRECTED_MODEL principle (“record selection is never saved”) remains intact.

---

## 8. Out of Scope

This document intentionally does not define:

- Implementation details
- Component names or file locations
- New block types or schemas
- Behaviour changes to record_view or record_review
- Permission changes
- Navigation or UX patterns

Those decisions belong to a future implementation phase.

---

## Summary

| Question | Answer |
|----------|--------|
| Where does record context live? | Page-level UI state; optional URL sync |
| Who can set it? | Data blocks, optional Record Context block, URL on load |
| Conflict handling? | Single context; last write wins; explicit clear |
| How is context passed? | Same pipeline as record_review |
| Impact on record pages? | None — record pages remain unchanged |

*End of document.*
