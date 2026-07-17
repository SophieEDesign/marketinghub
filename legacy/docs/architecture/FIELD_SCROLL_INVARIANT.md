# Field scroll invariant

**Fields must never own scroll. Scroll ownership belongs to the surface only (record modal/panel body, Kanban column, list body, gallery body).**

- Applies everywhere: record modals and panels, Kanban cards, list rows, gallery cards, full-page record view. A single field (Name, Email, long text, multi-select, etc.) never has an internal scrollbar.
- Fields are content, not viewports: they expand to fit content; no `overflow-y: auto|scroll` on field wrappers or field-type cells; no `max-height` or fixed height that forces internal scroll.
- One scroll owner per surface: the content region scrolls (modal body, panel body, Kanban column, list body, gallery body). Individual fields and field wrappers do not scroll.
- This keeps UX consistent (no nested scroll, predictable keyboard/mouse behaviour) and matches the Airtable-correct mental model.

See implementation in: `FieldBlock.tsx`, `Canvas.tsx` (block content wrapper), `BlockAppearanceWrapper.tsx`, `InlineFieldEditor.tsx` (long_text), and grid/card field cells (e.g. `MultiSelectCell.tsx` — no overflow-y-auto on field content).
