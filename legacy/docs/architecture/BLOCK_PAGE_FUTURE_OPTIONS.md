# Block & Page Future Options

**Status:** Design only. No implementation.  
**Purpose:** Define three explicit future paths for block and page consolidation so one can be chosen later without reopening fundamentals.

Canonical state today is documented in [BLOCK_AND_PAGE_ARCHITECTURE.md](BLOCK_AND_PAGE_ARCHITECTURE.md). This doc describes **options** only; no option is implemented in the current plan.

---

## Current Reality (Summary)

- **Interface Pages** (`/pages/[pageId]`): Primary. Use `interface_pages` + `view_blocks` (page_id), render via interface/BlockRenderer (PageBlock).
- **View Pages** (`/tables/.../views/[viewId]` when `view.type === "page"`): Parallel / secondary. Use `views` + `view_blocks` (view_id), render via blocks/BlockRenderer (ViewBlock).

Both use **view_blocks**; they differ by scope, block model, and renderer.

---

## Option 1 — Adapter Unification (Preferred Long-Term)

**Goal:** One renderer, one block model, one behaviour surface.

**Meaning:**

- Interface Pages remain primary.
- View Pages still use view_blocks (scoped by view_id).
- View Pages: load blocks → map to PageBlock → render via interface/BlockRenderer.
- blocks/BlockRenderer becomes legacy.

**Guarantees:**

- Edit once, affect all.
- One settings registry.
- One validation pipeline.
- No data movement.

**Not doing now:**

- No adapter implementation.
- No renderer removal.
- No routing changes.

---

## Option 2 — Soft Redirect (Alias View Pages)

**Goal:** Single runtime surface without data migration.

**Meaning:**

- When `view.type === "page"`, resolve (or lazily create) an interface_page.
- Redirect or forward to `/pages/[pageId]`.
- Blocks remain in view_blocks (view_id).
- Interface renderer owns behaviour.

**Guarantees:**

- No UX change.
- No data copy.
- Clean rollback.
- Interface becomes runtime owner.

**Not doing now:**

- No redirect logic.
- No interface page creation.

---

## Option 3 — Explicit Dual-System Lock (Stability First)

**Goal:** Prevent accidental convergence.

**Meaning:**

- Two intentional systems:
  - **Interface Pages** — full-featured, evolving.
  - **View Pages** — limited, stable, read-mostly.
- Governance rules:
  - New block types → Interface only.
  - Settings registry → Interface only.
  - Fixes land in Interface first.

**Guarantees:**

- Predictability.
- Clear boundaries.

**Trade-off:**

- No “edit once, affect all”.
- Duplication accepted by design.

---

## Choosing an Option

When the team is ready to consolidate or formalise the split:

1. Choose **one** of the three options above.
2. Do **not** reopen fundamental decisions (canonical model, storage, page types) — those remain as in [BLOCK_AND_PAGE_ARCHITECTURE.md](BLOCK_AND_PAGE_ARCHITECTURE.md).
3. Implement only the chosen option in a separate, scoped effort.

This document does not prescribe a timeline or priority.
