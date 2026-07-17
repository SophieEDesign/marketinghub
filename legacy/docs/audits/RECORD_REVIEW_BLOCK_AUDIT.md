# Record Review Block Audit vs Airtable Model

## Scope Clarification

**This audit covers the record review/record view layout implemented as a BLOCK (the two-panel block structure), NOT as a page type. NOT the settings panel.**

Implementation model: **block** (not page type). The left panel (record picker) + right panel (record display) are rendered by a block on the canvas, not by a dedicated record_review/record_view page type.

| Panel | Purpose | Component |
|-------|---------|-----------|
| **Left panel** | Record picker – list of records as cards | `RecordReviewLeftColumn` |
| **Right panel** | Record display – shows the selected record’s information and fields | `RecordDetailPanelInline` → `RecordEditor` |
| **Settings panel** | Properties inspector (edit mode) – configures field layout, etc. | `RightSettingsPanel` – **out of scope** |

The **settings panel** (RightSettingsPanel) is the properties inspector that appears in edit mode to configure layouts. It is out of scope for this audit.

**Common confusion:** Tables titled "Right Panel Structure" that list "Panel purpose: Properties for record detail layout" or "Field layout editor only" are **mislabeled** – they describe the **settings panel**, not the right panel.

### Right panel (record display) – in scope

| Aspect | Value |
|-------|-------|
| **Panel purpose** | Shows the selected record's data and fields |
| **Component** | RecordDetailPanelInline → RecordEditor |
| **When visible** | Always (when a record is selected) |

The right panel displays record data. It does **not** show "Properties for record detail layout" or "Field layout editor" – those belong to the settings panel.

### Settings panel – out of scope

| Aspect | Value |
|-------|-------|
| **Panel purpose** | Properties for record detail layout (Data, Permissions, Appearance, User actions); field layout editor (drag/drop, visibility) |
| **Component** | RightSettingsPanel |

If a table says "2.1 Right Panel Structure" but lists "Field layout editor only" or "Properties for record detail layout" under Panel purpose, it is mislabeled – relabel it as **2.1 Settings Panel Structure**.

---

## Settings Reference (Three Areas)

The record review block has three distinct settings areas, each configured via the settings panel (RightSettingsPanel) when the relevant context is selected:

| Settings for | What it configures | Config source | Settings UI component |
|--------------|--------------------|---------------|------------------------|
| **Left panel** | Record picker: which fields show on cards, card order, show labels, compact mode, table/view | `leftPanel`, `field_layout.visible_in_card` | RecordReviewLeftPanelSettings, InterfacePageSettingsDrawer |
| **Right panel** | Record display: which fields show, field order, groups, title field, comments, layout | `field_layout`, page config | RecordLayoutSettings |
| **Field blocks** | Individual field: label, editable, source (which field), style | `FieldLayoutItem` per field | FieldBlockSettings, FieldSchemaSettings |

---

## Settings Comparison: Current vs Airtable (Make More Like Airtable)

### Settings for Left Panel

| Setting | Airtable | Current | Action to match Airtable |
|---------|----------|---------|--------------------------|
| Title | Configurable (primary or other) | `leftPanel.title_field` in RecordViewPageSettings; RecordReviewLeftPanelSettings uses `visibleFieldIds`/`fieldOrder` | Wire `title_field` to card title in RecordReviewLeftColumn; ensure RecordReviewLeftPanelSettings exposes title field picker when used for record review block |
| Source table | Required | `tableId` from page config | OK |
| Filter by | Filter conditions | `left_panel.filter_tree` in RecordViewPageSettings | RecordReviewLeftPanelSettings does NOT have filter – add Filter by or ensure it reads from shared left_panel config |
| Sort by | Sort field + direction | `left_panel.sort_by` in RecordViewPageSettings | RecordReviewLeftPanelSettings does NOT have sort – add or wire to left_panel |
| Group by | Group field | `left_panel.group_by` in RecordViewPageSettings | RecordReviewLeftPanelSettings does NOT have group – add or wire |
| List item: Color by | Select field for coloring | `left_panel.color_field` | Add to RecordReviewLeftPanelSettings |
| List item: Image field | Attachment field for card image | `left_panel.image_field` | Add to RecordReviewLeftPanelSettings |
| List item: Title, Field 1, Field 2 | Preview fields on card | `field_layout.visible_in_card` or `title_field`/`field_1`/`field_2` | RecordReviewLeftColumn uses both; ensure RecordReviewLeftPanelSettings can configure these (or use field_layout) |
| Show labels | Toggle | `showLabels` in RecordReviewLeftPanelSettings | OK |
| Compact | Toggle | `compact` in RecordReviewLeftPanelSettings | OK |
| User filters | Tabs or dropdowns | Not in RecordReviewLeftPanelSettings | Add if Airtable parity needed |
| User actions (Sort, Filter, Add records) | Toggles | Not in RecordReviewLeftPanelSettings | Add if Airtable parity needed |

**Fix:** Unify left panel settings. RecordViewPageSettings has Filter, Sort, Group, Color, Image, Title, Field 1/2. RecordReviewLeftPanelSettings has visibleFieldIds, fieldOrder, showLabels, compact. For block-based record review, ensure one settings surface exposes all Airtable-equivalent options and saves to `left_panel` + `field_layout`.

---

### Settings for Right Panel

| Setting | Airtable | Current | Action to match Airtable |
|---------|----------|---------|--------------------------|
| **Data** | | | |
| Title field | Configurable (primary or other) | Not in RecordLayoutSettings; passed via page config | Add Title field selector to RecordLayoutSettings |
| Fields | Visible/hidden list, Find field | Visible/Hidden sections, Search | **Parity** – see comparison below |
| **Permissions** | View-only vs Editable (page-level) | Per-field only in FieldBlockSettings | Add page-level View-only/Editable toggle to RecordLayoutSettings |
| **Appearance** | | | |
| Title size | Large / Extra large | Missing | Add to RecordLayoutSettings |
| Page style | Sidesheet vs Full-screen | "Show as" Sidesheet/Full-screen in RecordLayoutSettings | **Remove for now** – stick with one (sidesheet) |
| Show as full width | Toggle | Missing | Add for record_view |
| Tab navigation | For groups | Missing | Add when groups UI exists |
| Collapsible groups | Toggle | Missing | Add when groups UI exists |
| **User actions** | | | |
| Comments | Toggle | Record comments row shown but not toggleable | Add Comments toggle; wire to `commentsEnabled` in page config |
| Revision history | Toggle | Missing | Add toggle; implement revision history UI |
| Buttons | Add buttons | Missing | Add Buttons config (future) |
| **Groups** | Add, rename, show title, description, background, field labels | `group_name` in data; no group UI | Add group management UI (add group, rename, show title, field labels Side/Top) |

**Fix:** Extend RecordLayoutSettings with Data (Title field), Permissions (page-level), Appearance (Title size, Show as full width), User actions (Comments, Revision history). Add group management when groups are used. **Remove** Sidesheet/Full-screen choice – stick with one display style for now.

---

### Visible / Hidden Fields List – Airtable vs Current

| Feature | Airtable | Current (RecordLayoutSettings) | Parity |
|---------|----------|--------------------------------|--------|
| Visible fields list | List of fields shown on record detail | "Visible" section with sortable field rows | Yes |
| Hidden fields list | "Hidden" section at bottom | "Hidden" section with field rows | Yes |
| Find field (search) | Search to filter field list | Search input | Yes |
| Eye icon | Toggle visibility per field | Eye/EyeOff per field | Yes |
| Hide all | – | "Hide all" button | Yes |
| Show all | – | "Show all" button | Yes |
| Drag to reorder | Drag on canvas | Drag handle (GripVertical) in list | Yes (different UX: list vs canvas) |
| Collapse/expand groups | In Airtable | Not in RecordLayoutSettings | No – add when groups exist |

**Conclusion:** Current implementation has parity with Airtable for the visible/hidden fields list. RecordLayoutSettings shows Visible and Hidden sections with search, eye toggle, drag reorder, Hide all/Show all.

---

### Settings for Field Blocks

| Setting | Airtable | Current | Action to match Airtable |
|---------|----------|---------|--------------------------|
| **Data** | | | |
| Source (which field) | Field picker, Edit field | FieldBlockSettings: Source + Edit field | OK |
| Permissions | View-only / Editable | View-only / Editable | OK |
| **Appearance** | | | |
| Label | Override field name | Uses `getFieldDisplayName(field)` – no override | Add `labelOverride` to FieldLayoutItem; add Label input to FieldBlockSettings |
| Style (Size) | Varies by field type | Appearance tab is placeholder | Add Style/Size options per field type |
| Helper text | Add helper text | Missing | Add Helper text to FieldBlockSettings; add to FieldLayoutItem |
| **Rules** | | | |
| Visibility | Conditional (Business/Enterprise) | Missing | Defer or add Visibility rules |

**Fix:** Add Label override and Helper text to FieldBlockSettings. Populate Appearance tab with Style/Size options. Extend FieldLayoutItem with `labelOverride`, `helperText`.

---

## Layout Structure (Airtable Parity)

### Airtable Record Review Layout

- **Left**: Record list – cards with title, optional image, optional preview fields
- **Right**: Record detail – selected record’s fields, title at top, grouped sections, comments, revision history

### Current Implementation

```
┌──────────────────────────┬──────────────────────────────────────┐
│ LEFT: RecordReviewLeftColumn │ RIGHT: RecordDetailPanelInline      │
│                              │ (or InterfaceBuilder for          │
│ - Record cards                │  record_review with blocks)       │
│ - Search/filter               │                                  │
│ - Card fields from            │ - RecordEditor (mode="review")    │
│   field_layout.visible_in_card│ - field_layout drives visibility │
│                              │ - Title, fields, comments         │
└──────────────────────────┴──────────────────────────────────────┘
```

---

## Right Panel (Record Display Block) – Airtable Comparison

### What the right panel should show (Airtable)

1. **Title** – One field at top (default: primary field)
2. **Fields** – Visible fields in order, with optional groups
3. **Field layout** – Sections, columns, side-by-side
4. **Comments** – Record comments (toggleable)
5. **Revision history** – (toggleable)
6. **Buttons** – Optional action buttons

### Current implementation

| Feature | Airtable | Current | Status |
|---------|----------|---------|--------|
| Title field | Configurable (primary or other) | Uses primary or `titleField` from config | Partial – `titleField` passed but may not be fully wired |
| Field visibility | From layout config | `field_layout` + `visibilityContext="canvas"` | OK |
| Field order | Drag/drop in layout | From `field_layout` order | OK |
| **Inline layout editing** | Drag, resize, grid layout on canvas | View only – no drag, resize, or grid editing in right panel; layout edited via settings panel | **Missing** |
| Groups/sections | Add group, rename, show title | `group_name` in FieldLayoutItem, `getFieldGroupsFromLayout` | Partial – groups in data, rendering may vary |
| Field labels | Side or Top per group | From RecordFields | Check |
| Comments | Toggle in page config (Settings for right panel) | `showComments={true}` hardcoded | No page-level toggle |
| Revision history | Toggle | Not present | Missing |
| Buttons | Add to record detail | Not present | Missing |
| Title size | Large / Extra large | Not configurable | Missing |
| Show as full width | Toggle | Not present | Missing |

---

## Key Components

### RecordDetailPanelInline

- Wraps `RecordEditor` with `mode="review"`, `visibilityContext="canvas"`
- Passes `fieldLayout`, `pageEditable`, `interfaceMode`, `onLayoutSave`
- Empty state: “Select a record from the list”

### RecordEditor (review mode)

- Renders title, fields (via RecordFields), comments
- Uses `field_layout` for visibility and order
- **No inline layout editing** – fields are view-only in the right panel; no drag, resize, or grid layout on the canvas. Layout is edited via the settings panel only.
- `canEditLayout` when `pageEditable && onLayoutSave` – enables layout editing (which opens the settings panel when editing)

---

## Gaps to Address (Record Display Block Only)

1. **Inline layout editing** – Right panel shows fields but cannot edit layout inline (no drag, resize, grid). Layout is edited via settings panel only. Airtable: drag/drop, resize, grid layout directly on the record detail canvas.
2. **Title field** – Ensure `titleField` from page config is used and overrides primary when set (configurable via Settings for right panel)
3. **Comments toggle** – Add page config `commentsEnabled`; pass to RecordDetailPanelInline
4. **Revision history** – Add page config `revisionHistoryEnabled`; implement if not present
5. **Title size** – Add `titleSize` (large/extra large) to page config and RecordEditor
6. **Show as full width** – Add to page config for record_view
7. **Buttons** – Add support for configurable buttons in record detail (future)

---

## Left Panel (Record Picker) – Quick Check

- **RecordReviewLeftColumn** – Cards from `field_layout.visible_in_card` or legacy `title_field`/`field_1`/`field_2`
- Page-owned: `leftPanel` config (see Settings for left panel), `field_layout` for card fields
- Should match Airtable record list: title, optional image, optional preview fields

---

## Summary

| Area | Focus | Status |
|------|-------|--------|
| Left panel | Record picker with cards | Implemented; verify parity |
| Right panel | Record display (fields, title, comments) | Implemented; missing inline layout editing (drag, resize, grid), toggles, title config |
| Settings panel | Properties inspector (edit mode) – RightSettingsPanel | Out of scope for this audit |
