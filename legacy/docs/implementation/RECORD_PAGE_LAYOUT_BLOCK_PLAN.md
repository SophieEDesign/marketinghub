# Record Page Layout Block — Implementation Plan (Airtable-style)

**Status:** Plan  
**Goal:** Unify Record Selector + Record View into a single, editable, Airtable-style layout block with full settings parity and no implicit/locked behaviour.

---

## 1. Goal

Fix the Record Selector / Record View experience so it behaves like Airtable:

- **Left panel** = selectable record list (cards)
- **Right panel** = editable record fields (modal-style layout, inline)
- Full-page mode fills the viewport without page scroll
- Blocks retain full settings parity (filters, fields, card settings, modal layout)
- No "locked" or auto-generated layouts that users can't edit

---

## 2. Problems to Fix (Observed)

| Problem | Description |
|--------|-------------|
| Record selector stretches full-width | In full-page mode the selector should only occupy a left column; rail layout (recent fix) addresses this for `record_context` + preview slot, but a dedicated `record_page` block makes the two-panel model explicit and editable. |
| No configuration parity | Record selector lacks: card settings, filters, sort, view selection — unlike grid/list blocks. |
| Record fields auto-generated & locked | When full-page is enabled, fields drop in automatically with no way to reorder, remove, control editability, or use modal layout tools. |
| Manual workaround tedious | Non-full-page mode requires manually adding field blocks; contradicts unified block philosophy. |

---

## 3. Conceptual Model (Airtable-style)

```
┌───────────────────────────────┐
│ Page (no scroll)              │
│                               │
│ ┌────────────┬──────────────┐ │
│ │ Record     │ Record       │ │
│ │ Selector   │ View         │ │
│ │ (cards)    │ (fields)     │ │
│ │ scroll     │ scroll       │ │
│ └────────────┴──────────────┘ │
└───────────────────────────────┘
```

- Page never scrolls.
- Only left and right panels scroll internally.
- No block chrome in full-page mode.

---

## 4. Approach: New Block Type `record_page`

Introduce a **Record Page Layout Block** that orchestrates the layout explicitly (no implicit behaviour).

### 4.1 Block responsibilities

| Area | Responsibility |
|------|----------------|
| **Layout** | Two fixed regions: left = Record Selector, right = Record View (fields). |
| **Left panel width** | Configurable (e.g. `block.config.left_panel_width`, default 320px). |
| **Right panel** | Fills remaining space. |
| **Scrolling** | Panels scroll independently; page and canvas do not scroll. |

### 4.2 Record Selector (left panel)

Reuse existing grid/list logic and config paths. **Do not invent new logic.**

Settings (same as Grid/List blocks):

- Table
- View
- Filters
- Sort
- Card fields (or list subtitle/image/pill/meta as applicable)
- Row height
- Search
- Allow clear selection

Config shape can mirror list/grid: `table_id`, `view_id`, `filters`, `sorts`, `view_type` (e.g. list), list/grid appearance fields.

### 4.3 Record View (right panel)

Use **modal_layout mechanics** — but embedded inline (no separate modal).

| Rule | Detail |
|------|--------|
| Fields not auto-generated | Layout is explicitly stored and editable. |
| Layout editable | Same UX as modal editor — WYSIWYG inline. |
| Vertical stack only | No x/y resizing; vertical order only (or same grid layout as modal_layout). |
| Same FieldBlock components | Reuse existing field block rendering. |

**Persistence:** Store layout in `block.config.record_layout` (same shape as `BlockConfig['modal_layout']`: `{ blocks: [...], layoutSettings?: {...} }`).

**Field controls per block:** Remove, reorder, editable toggle, read-only toggle; conditional visibility (future).

### 4.4 Editing model

- **"Edit layout"** toggles inline edit mode for the right panel.
- Same UI as modal layout editor — WYSIWYG in place.
- No separate editor dialog; layout stored in `block.config.record_layout`.

### 4.5 Full-page mode rules

When `record_page` block is full-page:

- Canvas: `overflow-hidden`, no padding, no grid.
- Block chrome removed.
- Left/right panels fill viewport.
- Record selector does not stretch; left column fixed width.

### 4.6 Remove implicit behaviour

- Do **not** auto-inject field blocks.
- Do **not** lock layouts.
- Do **not** infer structure from full-page toggle.

Everything must be explicit and editable.

---

## 5. Relation to Existing Work

- **record_context + RecordPreviewSurface (recent):** Provides a rail + right-hand preview slot driven by page-level record context; right side uses RecordBlock/synthetic block. That is a **context-driven** preview.
- **record_page (this plan):** A **single block** that owns both panels and stores selector config + `record_layout` (field layout) in one place. Better for “this page is a record browser” with full control over list settings and field layout.

Both can coexist: `record_context` for “add a selector and show a preview when a record is selected”; `record_page` for “this block is the whole record page” with full parity and editability.

---

## 6. Files to Create

| File | Purpose |
|------|---------|
| `components/interface/blocks/RecordPageBlock.tsx` | Main block component: two-panel layout, left = selector (reuse list/grid-style component or shared record list), right = inline field layout from `record_layout`. |
| `components/interface/RecordPageLayout.tsx` | Layout wrapper: left panel (configurable width) + right panel, overflow handling, no page scroll. Used when block is full-page or when block is on canvas (then may still render two columns). |

Optional: extract shared “record list/cards” component if list/grid card UI is reused for the left panel.

---

## 7. Files to Modify

| File | Changes |
|------|---------|
| `lib/interface/registry.ts` | Add `record_page` to `BlockType` and `BLOCK_REGISTRY`: defaultConfig (table_id, view_id, left_panel_width, record_layout), supportsFullPage, fullPageLayout 'rail' or a new 'two-panel' variant if needed. |
| `lib/interface/types.ts` | Add `'record_page'` to `BlockType`. In `BlockConfig`, add `record_layout?: BlockConfig['modal_layout']` and any record_page-specific fields (e.g. `left_panel_width?: number`). |
| `lib/interface/block-config-types.ts` | Add `RecordPageBlockConfig`, add to `BlockConfigUnion`, add to `BLOCK_CONFIG_UNION_TYPES`, add type guard `isRecordPageBlockConfig`. |
| `components/interface/BlockRenderer.tsx` | Add `case 'record_page':` render `RecordPageBlock` with required props (block, tableId, recordId from context, onRecordContextChange, etc.). |
| `components/interface/Canvas.tsx` | If full-page block is `record_page`, apply two-panel layout (no stretch); reuse or extend rail + right-area logic so record_page fills viewport with left/right panels. |
| `components/interface/BlockAppearanceWrapper.tsx` | No change required unless record_page needs a specific wrapper (e.g. no chrome when full-page two-panel). |
| `components/interface/settings/blockSettingsRegistry.tsx` | Register data and appearance settings for `record_page`: left panel = table, view, filters, sort, card/list settings; right panel = “Edit layout” (record_layout editor). Reuse GridDataSettings/ListDataSettings patterns for left; reuse ModalLayoutEditor or inline variant for record_layout. |

---

## 8. Config Shape (record_page)

Suggested `RecordPageBlockConfig`:

- `table_id: string`
- `view_id?: string`
- `view_type?: 'list' | 'grid'` (for selector display)
- `left_panel_width?: number` (default 320)
- `filters?: BlockFilter[]`
- `sorts?: BlockSort[]`
- List/grid appearance (e.g. list_subtitle_fields, list_image_field, card fields) — mirror list/grid config.
- `record_layout?: { blocks: ModalLayoutBlock[]; layoutSettings?: {...} }` — same as `modal_layout`.
- `allow_clear_selection?: boolean`

Persistence: same as other blocks; no new DB columns. Config stored in block `config` JSON.

---

## 9. Acceptance Criteria

- [ ] Left selector behaves like Grid/List (full settings: table, view, filters, sort, card/list settings).
- [ ] Right panel fields editable and reorderable (record_layout; same shape as modal_layout).
- [ ] Full-page mode matches Airtable: no page scroll, panels scroll internally.
- [ ] No auto-generated or locked layouts; all layout explicit and editable.
- [ ] Unified mental model with other blocks (same settings patterns, same field block usage).
- [ ] Clean upgrade path for future record pages (no one-off hacks).

---

## 10. Explicit Non-Goals

- No DB migrations.
- No record permission changes.
- No record_review page changes.
- No block-to-block wiring (record_page is self-contained).

---

## 11. Implementation Order (Suggested)

1. **Types and registry** — Add `record_page` type, `RecordPageBlockConfig`, registry entry.
2. **RecordPageLayout.tsx** — Two-panel layout component (left width, right flex, overflow).
3. **RecordPageBlock.tsx** — Left: record list (reuse list or grid card view); right: render blocks from `record_layout` (same as modal layout renderer); wire record context (selection) so right panel shows selected record.
4. **BlockRenderer + Canvas** — Render record_page; when full-page, use RecordPageLayout and no grid.
5. **Settings** — blockSettingsRegistry: data settings (selector = table, view, filters, sort, card/list), plus “Edit layout” for record_layout (inline or reuse ModalLayoutEditor).
6. **Full-page behaviour** — Ensure canvas gives record_page full viewport, two panels, no stretch; optional `fullPageLayout: 'two-panel'` if distinct from rail.

---

## 12. References

- [Modal layout type](baserow-app/lib/interface/types.ts) — `BlockConfig['modal_layout']`
- [ModalLayoutEditor](baserow-app/components/interface/settings/ModalLayoutEditor.tsx) — load/save layout, same shape for `record_layout`
- [HorizontalGroupedBlock](baserow-app/components/interface/blocks/HorizontalGroupedBlock.tsx) — uses `record_field_layout` and modal-style canvas for layout editing
- [Record Context rail + RecordPreviewSurface](baserow-app/components/interface/record-preview/RecordPreviewSurface.tsx) — alternative pattern (context-driven preview)
