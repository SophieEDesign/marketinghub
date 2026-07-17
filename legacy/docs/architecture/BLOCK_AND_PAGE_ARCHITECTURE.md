# Block & Page Architecture (Canonical Reference)

**Status:** Decision locked. Single source of truth for blocks, page types, and rendering paths.  
**Audience:** Engineers, product, and anyone defining or changing block or page behaviour.

This document locks what is canonical today. It does not implement, migrate, or change behaviour. For future consolidation options, see [BLOCK_PAGE_FUTURE_OPTIONS.md](BLOCK_PAGE_FUTURE_OPTIONS.md).

---

## 1. Blocks — Canonical Decisions

| Area | Canonical Choice | Code Location |
|------|------------------|---------------|
| Block model | PageBlock | `baserow-app/lib/interface/types.ts` |
| Block storage | view_blocks | API + load/save paths (e.g. `app/api/pages/[pageId]/blocks/route.ts`, `lib/pages/saveBlocks.ts`, `lib/pages/loadPage.ts`) |
| Deprecated table | page_blocks | Exists only in migrations; unused by application code. Do not use. Do not drop. |
| Config + schema | Interface types + validators | `types.ts`, `block-config-types.ts`, `block-validator.ts`, `assertBlockConfig.ts` (all under `lib/interface/`) |
| Layout mapping | DB ↔ layout | `lib/interface/layout-mapping.ts` |
| Settings registry | Block settings UI | `components/interface/settings/blockSettingsRegistry.tsx` |

**Decision (locked):**

- **PageBlock** is the only canonical block model.
- **view_blocks** is the only block storage.
- **page_blocks** is deprecated, documented here, and **not dropped**.

---

## 2. Rendering Paths (Current Reality)

| Path | Route | Data | Renderer | Status |
|------|--------|------|----------|--------|
| Interface Pages | `/pages/[pageId]` | interface_pages + view_blocks (by `page_id`) | interface/BlockRenderer (via Canvas → InterfaceBuilder) | **Primary** |
| View Pages | `/tables/[tableId]/views/[viewId]` when `view.type === "page"` | views + view_blocks (by `view_id`) | blocks/BlockRenderer (via InterfacePage) | **Parallel / Secondary** |

Both paths use **view_blocks**. They differ by scope (`page_id` vs `view_id`), block model (PageBlock vs ViewBlock), and which BlockRenderer and block components are used.

---

## 3. Page Types (Locked)

### record_view & record_review

- **Same shell:** RecordReviewPage (fixed left column + right canvas).
- **Differ only by:** Left-panel configuration (simple vs full) and settings UX.
- **No merge, no removal.** Both are first-class.
- **Detailed doc:** [PAGE_TYPE_CONSOLIDATION.md](PAGE_TYPE_CONSOLIDATION.md)

### content

- Canvas-only.
- No record context today.
- Eligible for future record context (design only; see below).

---

## 4. Record Editing (Invariant)

- **One** record editor concept.
- **One** create flow.
- **One** permission cascade.
- **Multiple shells** only for presentation: Page, Panel, Drawer, Modal.
- Shells never change behaviour or permissions.

---

## 5. Future Capability — Record Context on Content Pages

**Full design:** [FUTURE_RECORD_CONTEXT_ON_CONTENT_PAGES.md](FUTURE_RECORD_CONTEXT_ON_CONTENT_PAGES.md)

Summary for this doc:

- Record context is **page-level state** (ephemeral).
- Optional **URL sync** for deep linking.
- **Set by:** Data blocks (Grid/List/Calendar/Kanban), optional Record Context block, or URL on load.
- **Propagation:** Same as record_review — InterfaceBuilder → Canvas → BlockRenderer.
- **Ephemeral only** (no DB storage).
- **Does not replace** record pages (record_view / record_review remain first-class).
- **No implementation** in the current architecture lock; this is design only.

---

## 6. Explicit Non-Goals

This architecture lock does **not** include:

- Block migration
- Renderer merge
- Permission tightening
- Kanban permission refactors
- Page-type deprecation
- Record context implementation

---

## 7. Related Documents

| Document | Purpose |
|----------|---------|
| [PAGE_TYPE_CONSOLIDATION.md](PAGE_TYPE_CONSOLIDATION.md) | record_view vs record_review: one shell, different config. |
| [FUTURE_RECORD_CONTEXT_ON_CONTENT_PAGES.md](FUTURE_RECORD_CONTEXT_ON_CONTENT_PAGES.md) | Future design: optional record context on content pages. |
| [BLOCK_PAGE_FUTURE_OPTIONS.md](BLOCK_PAGE_FUTURE_OPTIONS.md) | Three future paths (Adapter, Redirect, Dual lock) — choose one when ready. |
