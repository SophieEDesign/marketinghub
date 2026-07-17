# Filter Precedence

**Purpose:** Document how block-level and page-level filters interact.

---

## Overview

Filters can come from:

1. **Block base filters** – Stored in `block.config.filters` or `block.config.filter_tree`
2. **Filter block** – Emits filters via `FilterStateContext` to connected blocks
3. **Page-level filters** – Passed as `filters` prop from page/Canvas to blocks

---

## Precedence Order

When a block applies filters, the order is:

1. **Block base filters** – Always applied first (block’s own config)
2. **Filter block filters** – Applied when the block is connected to a Filter block
3. **Page-level filters** – Applied last (from `filters` prop)

Filters are merged with AND semantics unless the block uses `filter_tree` with OR groups.

---

## How Page Filters Reach Blocks

- **Canvas / InterfaceBuilder** resolves filters per block via `getFiltersForBlock(blockId, tableId)`
- **BlockRenderer** passes `filters` and `filterTree` to ChartBlock, KPIBlock, GridBlock, etc.
- Blocks use `mergeFilters(blockBaseFilters, filterBlockFilters, pageFilters)` from `@/lib/interface/filters`

---

## Filter Block Connections

- Filter blocks declare `target_blocks` (explicit IDs or `'all'`)
- Only blocks on the **same table** receive filters
- Blocks consume via `useFilterState()` or `filters` prop from parent

---

## Key Files

- `baserow-app/lib/interface/filters.ts` – `mergeFilters`, `FilterConfig`
- `baserow-app/lib/filters/canonical-model.ts` – `FilterTree`, `normalizeFilterTree`
- `baserow-app/components/interface/blocks/FilterBlock.tsx` – Filter block UI and emit
- `baserow-app/lib/interface/filter-state.tsx` – `FilterStateContext`, `useFilterState`
