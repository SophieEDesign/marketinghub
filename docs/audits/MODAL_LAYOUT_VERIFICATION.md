# Modal layout in-modal edit — verification

Verification that: view mode is unchanged, existing layouts render, in-modal edit is WYSIWYG, and record/permission logic is unchanged.

## 1. View mode unchanged

**ModalCanvas** (`baserow-app/components/interface/ModalCanvas.tsx`):

- `mode` defaults to `"view"`. When `mode === "view"`, `isEditMode` is false.
- Then: `isDraggable={false}`, `isResizable={false}`, `onLayoutChange={undefined}` (lines 150–152).
- Render branch is the `else` (lines 198–212): no drag handle, no remove button, no “Add field”; same `BlockAppearanceWrapper` + `BlockRenderer` as before the change.
- Layout is still derived from `blocks` with existing `x, y, w, h` (only in edit mode do we force `x=0`, `w=cols` by index). So view mode uses the same layout and the same read-only block rendering.

**Conclusion:** View behaviour is unchanged.

---

## 2. Existing layouts still render

**RecordModal** (grid and calendar):

- `modalBlocks` is still built from `modalLayout?.blocks` with the same mapping (id, type, x, y, w, h, config, field_id, field_name). No change to data shape or source.
- When not in layout-edit mode, `blocksForCanvas = modalBlocks` (line 202 in grid RecordModal). So the same blocks and layout are passed to ModalCanvas as before.
- `modal_layout` type and stored shape are unchanged; we only added optional props (`canEditLayout`, `onLayoutSave`) and local state for draft layout when editing.

**Conclusion:** Existing `modal_layout.blocks` continue to render as before.

---

## 3. In-modal edit is WYSIWYG

- Layout editing happens inside the **same** RecordModal: no separate dialog, no navigation. User clicks “Edit layout” → modal stays open, content switches to edit mode.
- **Same record:** `recordId` and `record` are unchanged; ModalCanvas still receives the same `recordId` and `tableId`/`tableName`/`tableFields`. Field blocks show the current record’s data.
- **Same container:** Same `DialogContent` and same scrollable area; we only pass `mode="edit"` and callbacks to ModalCanvas. Edit UI (drag handle, remove, “Add field”) is inline in that same content.
- **Save path:** On “Done”, `handleDoneEditLayout` builds `newModalLayout` from `draftBlocks` (same shape as `modal_layout`) and calls `onLayoutSave(newModalLayout)`. Parent (InterfaceBuilder via GridBlock/GridView) updates block config only. No separate “preview” or different viewport.

**Conclusion:** What you edit in the modal is what you see and what gets saved (WYSIWYG).

---

## 4. No record or permission changes

**Record behaviour:**

- `handleFieldChange` is unchanged and still gated by `effectiveEditable` (and record/tableNameFromCore). No new record create/update/delete logic was added.
- Delete record flow (handleDeleteRecord, confirmDelete, canDeleteRecords) is unchanged.
- `onLayoutSave` only receives a `modal_layout` object and is used to update **block config** (e.g. `handleBlockUpdate(blockId, { modal_layout })` in InterfaceBuilder). It does not call any record API or change record data.

**Permissions:**

- `canEditRecords`, `canDeleteRecords`, and `effectiveEditable` are still derived from `useRecordEditorCore` and `role`/`canShowEditButton`/`isModalEditing` as before. No changes to those checks.
- Layout editing is gated only by **new** optional props: `canEditLayout` and `onLayoutSave`. “Edit layout” is shown only when both are provided (and there is a custom layout). These do not replace or alter existing permission checks for editing or deleting records.
- Record field editing remains gated by `effectiveEditable`; layout edit state (`isEditingLayout`) does not affect that.

**Conclusion:** Record behaviour and permission logic are unchanged; layout save only updates block config.
