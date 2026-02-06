# Modal Editor UX Audit & Redesign (WYSIWYG, In-Modal Editing)

## Invariants (must not be violated)

- Editing happens **inside the actual record modal**.
- **What you edit is exactly what you see**.
- **No separate modal layout editor** as primary UX.
- **Vertical layout only** (no resize, no x/y positioning).
- **One renderer, two modes** — not two editors.
- No schema changes.
- No permission changes.
- Record pages (record_view / record_review) unchanged.
- Existing modal layouts continue to render correctly.

## Canonical mental model

- **Modal** = fixed viewport; header + footer fixed; body scrolls vertically.
- **Fields** stack naturally.
- **Layout editing** = reordering + add/remove only.
- No grid concepts leak into modals.

---

## Part 1 — Audit (required deliverable)

### 1.1 Where modal layout is defined

- **Type / shape**: `baserow-app/lib/interface/types.ts` — `BlockConfig['modal_layout']`: `{ blocks: Array<{ id, type, fieldName?, x, y, w, h, config? }>, layoutSettings?: { cols?, rowHeight?, margin? } }`.
- **Stored**: On the grid (and list/calendar/kanban/timeline/gallery) block config as `config.modal_layout`. Persisted when the user saves the block via the Settings panel.
- **Defaults**: `baserow-app/lib/interface/canvas-layout-defaults.ts` — `MODAL_CANVAS_LAYOUT_DEFAULTS`, `MODAL_CANVAS_LAYOUT_CONSTRAINTS` shared by editor and canvas.

### 1.2 Where modal layout is edited (current)

- **Entry point**: Grid Data Settings. In `baserow-app/components/interface/settings/GridDataSettings.tsx` an "Edit Layout" button opens a **separate dialog**.
- **Editor component**: `baserow-app/components/interface/settings/ModalLayoutEditor.tsx` — uses react-grid-layout (draggable, resizable), different viewport/record; not WYSIWYG.

### 1.3 Where modal layout is rendered (current)

- **Record modals**: `baserow-app/components/grid/RecordModal.tsx`, `baserow-app/components/calendar/RecordModal.tsx` use `ModalCanvas` with `modalBlocks` from `modalLayout?.blocks`.
- **ModalCanvas**: `baserow-app/components/interface/ModalCanvas.tsx` — read-only grid, BlockAppearanceWrapper + BlockRenderer. RecordPanel does not use modal_layout.

### 1.4 Divergence

| Aspect       | ModalLayoutEditor (edit)           | ModalCanvas in RecordModal (view)   |
| ------------ | --------------------------------- | ----------------------------------- |
| Context      | Block Data Settings; no record.    | User has specific record open.      |
| Container    | Gray preview box.                 | Actual DialogContent.                |
| Record       | First record from table.          | The record the user clicked.        |
| Entry        | "Edit Layout" in settings.        | No "Edit layout" in modal.          |
| Grid model   | Drag + resize; x/y/w/h.           | Read-only.                          |

### 1.5 Components to delete, bypass, or simplify

- **ModalLayoutEditor.tsx**: Bypass as primary path; delete or keep as fallback only.
- **GridDataSettings.tsx**: Remove "Edit Layout" button; replace with "Open a record to edit the modal layout."
- **ModalCanvas.tsx**: Extend with `mode: 'view' | 'edit'`; one component, two modes.
- **RecordModal (grid + calendar)**: Add `isEditingLayout`, Edit/Done/Cancel, draft layout, `onLayoutSave(blockId, modalLayout)`, `canEditLayout`.

---

## Part 2 — Architecture changes (do exactly this)

### 1. ModalCanvas becomes dual-mode (single component)

**File:** `baserow-app/components/interface/ModalCanvas.tsx`

**Add:** `mode: 'view' | 'edit'`.

- **View mode** (existing behaviour): read-only, no drag handles, no layout controls; uses existing `modal_layout.blocks`.
- **Edit mode** (new): same renderer, same container, same record; **vertical reorder only** (no resize, no x/y UI). Inline controls:
  - Drag handle (vertical)
  - Remove block
  - Add field (between rows)
  - Optional section headers

**Constraint:** Keep using existing `modal_layout` data shape. Normalize to single column in edit mode (e.g. `x=0`, `w=full`).

### 2. RecordModal owns layout editing state

**Files:** `baserow-app/components/grid/RecordModal.tsx`, `baserow-app/components/calendar/RecordModal.tsx`, and any other modal-opening views that use custom modal layout.

**Add:**

- `const [isEditingLayout, setIsEditingLayout] = useState(false)`
- **Header controls:** "Edit layout" → enter edit mode; "Done" → save; "Cancel" → discard.
- **Behaviour:** Modal stays open; content switches mode; no navigation; no dialog stacking.
- **Pass to ModalCanvas:**

```tsx
<ModalCanvas
  mode={isEditingLayout ? 'edit' : 'view'}
  blocks={draftBlocks}
  onLayoutChange={setDraftLayout}
  ...
/>
```

(draft when editing, else modalBlocks from props)

### 3. Persistence flow (no auto-save)

- Modal edits produce a **draft layout** (local state in RecordModal).
- **On "Done":** call `onLayoutSave(blockId, modalLayout)`; exit edit mode.
- **On "Cancel":** restore original layout; exit edit mode.

### 4. Thread persistence (single source of truth)

**Ownership chain:**

```
InterfaceBuilder
  → GridBlock
    → GridView (and calendar/list/kanban/timeline/gallery where RecordModal + modal_layout)
      → RecordModal
        → ModalCanvas
```

- **InterfaceBuilder:** Owns `blocks` state. Add `updateBlockConfig(blockId, partialConfig)`. No direct API calls from modal.
- **GridBlock / GridView:** Receive `onModalLayoutSave(blockId, modalLayout)` and `canEditLayout`; pass to RecordModal.
- **RecordModal:** Calls `onLayoutSave(blockId, modalLayout)` on Done. Does **not** talk to APIs directly. Uses existing block config persistence (page save).

No schema changes. Uses existing block config persistence.

### 5. Remove broken editor path

- **GridDataSettings.tsx:** Remove (or hide) the "Edit Layout" button. Replace with text: **"Open a record to edit the modal layout."**
- **ModalLayoutEditor.tsx:** Stop enhancing. Either **delete** or keep as **fallback only** (e.g. when no records exist). If kept, document as fallback.

---

## Layout rules (authoritative)

- Modal **body** scrolls; **fields** never scroll.
- No nested scrollbars.
- No card UI in modal.
- No grid padding.
- No resize handles.
- No drag outside vertical axis.

---

## Acceptance checklist (must all pass)

- [ ] Editing happens **inside** the modal.
- [ ] Same record, same viewport.
- [ ] Saved layout matches view exactly.
- [ ] No separate editor dialog.
- [ ] Vertical reorder only.
- [ ] Existing layouts still render.
- [ ] No permission or record logic changes.
- [ ] No schema changes.

---

## Deliverables

- ModalCanvas supports `mode="edit"`.
- RecordModal has Edit layout / Done / Cancel UX and draft layout state.
- Layout persistence wired through InterfaceBuilder → GridBlock → GridView → RecordModal (`onModalLayoutSave(blockId, modalLayout)`, `canEditLayout`).
- GridDataSettings no longer opens layout editor; replaced with "Open a record to edit the modal layout."
- ModalLayoutEditor deprecated or bypassed (fallback only if kept).

---

## Explicitly out of scope

- No block schema redesign.
- No modal layout migration.
- No record page changes (record_view / record_review).
- No permission changes.
- No autosave.
- No x/y resize UI.
- No new layout engine.

---

## Implementation todos

1. **Audit doc**: Add this audit (or a short summary) under `docs/audits/` if not already present.
2. **ModalCanvas**: Add `mode: 'view' | 'edit'`; vertical reorder only; inline controls; keep existing data shape.
3. **RecordModal (grid + calendar)**: Add `isEditingLayout`, draft layout, Edit/Done/Cancel; pass `mode` and `onLayoutChange`; implement Save/Cancel semantics.
4. **Persistence**: Thread `onModalLayoutSave(blockId, modalLayout)` and `canEditLayout` from InterfaceBuilder → GridBlock → GridView → RecordModal; add `updateBlockConfig` in builder.
5. **GridDataSettings**: Replace "Edit Layout" button with "Open a record to edit the modal layout."; ModalLayoutEditor deprecated or fallback only.
6. **Verification**: View unchanged, existing layouts render, in-modal edit WYSIWYG, no record/permission changes.
