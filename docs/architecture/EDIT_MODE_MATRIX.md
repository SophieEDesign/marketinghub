# Edit mode authority matrix

Single reference for which system controls each behaviour. See also `.cursor/rules/layout-width-authority.mdc`.

| Concern | Owner | API / check |
|---------|--------|-------------|
| Right settings panel visible + 360px width | **UIModeContext** | `useUIMode().isEdit()` — `view` only when not editing |
| Page / block / sidebar edit scopes + dirty flags | **EditModeContext** | `usePageEditMode`, `useBlockEditMode`, `useEditMode().blocksDirty` |
| Record panel view vs edit | **resolveRecordEditMode** | `interfaceMode`, `pageLayoutEditActive` (UIMode edit + `onLayoutSave`) |
| Record open entry point | **RecordModalContext** → **RecordPanelContext** | `useRecordModal()` preferred |

## Rules

1. Layout width must not depend on `selectedContext` or block selection.
2. `InterfacePageClient` must not overwrite builder-owned blocks in the right panel when a block is selected.
3. Do not add a fourth parallel “edit mode” without updating this matrix.

## Deprecated

- **SidebarModeContext** — wraps EditModeContext; migrate callers to EditModeContext directly.
