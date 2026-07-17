# Page Type Consolidation: Record-Centric Pages

**Status:** Canonical architecture / product decision. **Decision status: LOCKED.**  
**Audience:** Engineers, product, and anyone asking “why do we have two page types?”

---

## Record-centric pages

`record_view` and `record_review` **share the same shell** (`RecordReviewPage`).

They differ only by:

- **Left-column configuration** — which fields are shown, how they’re ordered, and how the list is presented.
- **Settings surface** — which page-level settings are exposed (e.g. record_review’s full field list config vs record_view’s simplified title/subtitle/additional fields).

Both are **first-class, supported page types**. They are **not deprecated**.

**Content pages** do not yet support page-level record context. That is a separate consideration (see [FUTURE_RECORD_CONTEXT_ON_CONTENT_PAGES.md](FUTURE_RECORD_CONTEXT_ON_CONTENT_PAGES.md)). If record page types were ever deprecated, migration options are documented in [RECORD_PAGE_MIGRATION_PATH.md](RECORD_PAGE_MIGRATION_PATH.md).

---

## Why this is documented

This doc exists to:

1. **Prevent “Why do we have two page types?” questions** — The answer is: one shell, two configuration flavours. Both are valid.
2. **Avoid accidental divergence** — Implementations should treat record_view and record_review as the same layout with different config; no branching that isn’t about left-column or settings.
3. **Avoid over-eager refactors** — Do not merge or remove one type in an attempt to “simplify” without product agreement. Consolidation, if it happens, is a product/architecture decision, not a quick code cleanup.

---

## Summary

| Point | Detail |
|-------|--------|
| **Shell** | One: `RecordReviewPage` (fixed left column + right canvas). |
| **Page types** | `record_view` and `record_review` both use it. |
| **Difference** | Left-column configuration and settings UX only. |
| **Status** | Both first-class; neither deprecated. |
| **Content pages** | No page-level record context yet. |

Where code branches on `record_view` vs `record_review`, the intent is configuration and settings behaviour, not a different product or layout concept. **In short: same shell, different config.**
