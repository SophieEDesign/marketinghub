# Field scroll invariant

**Field blocks must never scroll. Scroll ownership belongs to the record container (modal body / panel body) only.**

- Fields are content, not viewports: they expand to fit content; no internal scrollbars, no clipped content, no `overflow-y: auto|scroll`, no `max-height` or fixed height on field blocks or field wrappers.
- One scroll owner per surface: only the content region (record modal body, record panel body) has `overflow-y: auto`. Individual fields, field block wrappers, and full-page block/page containers do not scroll.
- This keeps UX consistent (no nested scroll, predictable keyboard/mouse behaviour) and matches the Airtable-correct mental model.

See implementation in: `FieldBlock.tsx`, `Canvas.tsx` (block content wrapper), `BlockAppearanceWrapper.tsx`, `InlineFieldEditor.tsx` (long_text).
