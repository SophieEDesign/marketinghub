# Modal Layout Audit (required deliverable)

Short audit capturing where modal layout is defined, edited, rendered, where divergence occurs, and which components to delete/bypass/simplify. Full redesign plan: [MODAL_EDITOR_UX_REDESIGN_PLAN.md](./MODAL_EDITOR_UX_REDESIGN_PLAN.md).

## 1.1 Where modal layout is defined

- **Type / shape**: `baserow-app/lib/interface/types.ts` — `BlockConfig['modal_layout']`: `{ blocks: Array<{ id, type, fieldName?, x, y, w, h, config? }>, layoutSettings?: { cols?, rowHeight?, margin? } }`.
- **Stored**: Grid (and list/calendar/kanban/timeline/gallery) block config as `config.modal_layout`. Persisted when the user saves the block via the Settings panel.
- **Defaults**: `baserow-app/lib/interface/canvas-layout-defaults.ts` — `MODAL_CANVAS_LAYOUT_DEFAULTS`, `MODAL_CANVAS_LAYOUT_CONSTRAINTS`.

## 1.2 Where modal layout is edited (current)

- **Entry point**: Grid Data Settings — `baserow-app/components/interface/settings/GridDataSettings.tsx` — "Edit Layout" button opens a **separate dialog**.
- **Editor**: `baserow-app/components/interface/settings/ModalLayoutEditor.tsx` — react-grid-layout (draggable, resizable), different viewport/record; not WYSIWYG.

## 1.3 Where modal layout is rendered (current)

- **Record modals**: `baserow-app/components/grid/RecordModal.tsx`, `baserow-app/components/calendar/RecordModal.tsx` use `ModalCanvas` with `modalBlocks` from `modalLayout?.blocks`.
- **ModalCanvas**: `baserow-app/components/interface/ModalCanvas.tsx` — read-only grid. RecordPanel does not use `modal_layout`.

## 1.4 Where divergence occurs

| Aspect    | ModalLayoutEditor (edit)        | ModalCanvas in RecordModal (view) |
| --------- | ------------------------------- | --------------------------------- |
| Context   | Block Data Settings; no record  | User has specific record open     |
| Container | Gray preview box                | Actual DialogContent              |
| Record    | First record from table         | The record the user clicked       |
| Entry     | "Edit Layout" in settings       | No "Edit layout" in modal         |
| Grid      | Drag + resize; x/y/w/h          | Read-only                         |

Edited layout is authored in a different place with a different viewport/record than actual modal rendering.

## 1.5 Components to delete, bypass, or simplify

- **ModalLayoutEditor.tsx**: Bypass as primary path; delete or keep as fallback only.
- **GridDataSettings.tsx**: Remove "Edit Layout" button; replace with "Open a record to edit the modal layout."
- **ModalCanvas.tsx**: Extend with `mode: 'view' | 'edit'`; one component, two modes.
- **RecordModal (grid + calendar)**: Add `isEditingLayout`, Edit/Done/Cancel, draft layout, `onLayoutSave(blockId, modalLayout)`, `canEditLayout`.
