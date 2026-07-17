# Record Page Types: Migration Path (If Deprecated)

**Status:** Reference only. Record page types (`record_view`, `record_review`) are **not deprecated** and remain first-class.

This document defines acceptable migration options for **when/if** product decides to remove record page types. It is not a commitment to deprecate. No implementation, UI hiding, or breaking changes are implied.

**Related:** [PAGE_TYPE_CONSOLIDATION.md](PAGE_TYPE_CONSOLIDATION.md), [FUTURE_RECORD_CONTEXT_ON_CONTENT_PAGES.md](FUTURE_RECORD_CONTEXT_ON_CONTENT_PAGES.md).

---

## Constraints for any migration

- **No breaking existing pages** — Migration is opt-in or run only when product explicitly decides to deprecate record page types. Existing record_view/record_review pages must continue to work until migration is available and chosen.
- **URLs** — Existing URLs (e.g. `/pages/[id]` for record review pages) may redirect to the migrated content page + same record context if desired.
- **Left-column behaviour** — Field list, group-by, search/filter, and left-panel settings must be reproducible (in block config or a dedicated block) so users do not lose functionality.

---

## Acceptable migration options (future consideration)

### 1. Content page + record context from a block

- A block (e.g. List, Grid) can set "selected record as page/canvas context"; other blocks receive `recordId` as they do on record pages.
- Optional: layout template or "record review layout" that pre-places a list block (e.g. left) and canvas (right) so behaviour resembles current record review.
- **Migration:** For each record_view/record_review page, create a content page, set base_table in page config, add a record-list block that sets context, copy right-side blocks (or seed from template), and preserve left-panel field visibility in block/config where possible.

### 2. Content page + URL record context

- Content page can receive `recordId` from URL (e.g. query or path). Canvas passes it to blocks. List block "record click" could set URL (e.g. `?recordId=...`) instead of navigating away.
- **Migration:** Same as option 1, with URL pattern documented; existing "open record" links could point to content page + recordId.

### 3. Full-page or "record review" block

- A single block type encapsulates "left record list + right canvas" (or a full-width layout that mimics it). Page type becomes content; the block owns the record-context behaviour.
- **Migration:** One block per record page, with config holding table + left-panel options; right-side content could be blocks inside the block or a reference to current right-side blocks (design needed).

---

## When to use this document

- **Choosing a path:** Only when/if product decides to remove record page types. Then choose and specify one migration path in detail.
- **Preserving existing pages:** Until that decision and a migration path are in place, record_view and record_review remain supported and must not be broken.

*End of document.*
