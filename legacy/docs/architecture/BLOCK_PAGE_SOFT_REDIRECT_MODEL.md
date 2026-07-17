# Block & Page Architecture — Soft Redirect Model

**Design-only. Not implemented.**

**No migrations, no runtime changes, no behaviour changes.**

**This document describes a future option, not a current state.**

---

## Intent

Soft Redirect is a convergence strategy, not a refactor. It reduces long-term duplication by aliasing View Pages to Interface Page behaviour at runtime, without moving or copying data. This option exists so that when the time comes to unify rendering paths, a clear, low-risk implementation path is documented and can be followed without reopening architectural decisions.

---

## Problem Being Solved

Today there are two rendering paths for page-like content:

1. **Interface Pages** — Route: `/pages/[pageId]`. Loads page from `interface_pages` (or legacy `views` where `type === 'interface'`). Blocks are loaded from `view_blocks` where `page_id` or `view_id` matches. Rendering uses InterfacePageClient → InterfaceBuilder → Canvas → interface BlockRenderer. Block model: PageBlock.

2. **View Pages** — Route: `/tables/[tableId]/views/[viewId]`. When `view.type === "page"`, loads blocks from `view_blocks` scoped by `view_id`. Rendering uses `components/views/InterfacePage` → `components/blocks/BlockRenderer`. Block model: ViewBlock.

Both paths read from `view_blocks`, but behaviour diverges because:

- Different renderers (interface BlockRenderer vs blocks BlockRenderer)
- Different block models (PageBlock vs ViewBlock)
- Different settings registries

The goal is to reduce long-term duplication without migrating data or breaking URLs.

---

## Definition: What "Soft Redirect" Means

- View Pages (`view.type === "page"`) are **not removed**
- `view_blocks` rows scoped by `view_id` remain **untouched**
- Runtime rendering is **aliased** to Interface Pages

Soft Redirect means one of the following (implementation-agnostic):

- HTTP redirect
- Internal forward
- Resolver that maps a view to an interface page at runtime

It never means:

- Copying blocks
- Moving data
- Deleting views
- Changing block ownership

---

## Canonical Runtime Behaviour (Future)

When implemented, the intended flow is:

1. User navigates to `/tables/[tableId]/views/[viewId]` where `view.type === "page"`.

2. System:
   - Resolves or lazily creates a corresponding `interface_pages` entry
   - Does **not** duplicate blocks
   - Uses existing `view_blocks` rows scoped by `view_id`

3. Rendering:
   - Uses Interface Page renderer
   - Uses PageBlock model
   - Uses blockSettingsRegistry
   - Uses interface BlockRenderer

4. Result:
   - Behaviour matches Interface Pages
   - URLs remain valid
   - Data remains in place

---

## Guarantees

- No data migration
- No block copying
- No schema changes
- No loss of history or audit data
- No URL breakage
- Clean rollback possible
- Interface Pages remain the single behaviour owner

---

## What Soft Redirect Does Not Do

- Does not remove View Pages
- Does not merge renderers yet
- Does not delete blocks/BlockRenderer
- Does not auto-convert existing pages
- Does not enforce new permissions
- Does not change UX or navigation

---

## Comparison to Other Options

| Option | Description | Why not chosen now |
|--------|-------------|--------------------|
| Adapter Unification | Map ViewBlocks → PageBlock directly | More invasive; higher coordination cost |
| Soft Redirect | Alias runtime rendering to Interface Pages | Chosen for lowest risk |
| Dual Lock | Freeze systems separately | Long-term duplication remains |

---

## Relationship to Canonical Architecture

- Canonical block model remains **PageBlock**
- Canonical renderer remains **Interface BlockRenderer**
- `view_blocks` remains the single storage

This option aligns with:

- [BLOCK_AND_PAGE_ARCHITECTURE.md](./BLOCK_AND_PAGE_ARCHITECTURE.md)
- [PAGE_TYPE_CONSOLIDATION.md](./PAGE_TYPE_CONSOLIDATION.md)
- [UNIFIED_CANVAS_BLOCKS_ARCHITECTURE.md](./UNIFIED_CANVAS_BLOCKS_ARCHITECTURE.md)

---

## Exit Criteria (Future Implementation Readiness)

Before implementation, the following must be true:

- Canonical architecture doc approved
- Block behaviour parity validated
- Rollback strategy agreed
- No active work depending on ViewBlock-only behaviour

---

## Summary

Soft Redirect is a low-risk convergence path that centralises behaviour without moving data. It keeps Interface Pages as the long-term owner of page rendering while allowing View Pages (view.type === "page") to be served through the same stack at runtime. It is not implemented now; this document exists to specify the model for future implementation.
