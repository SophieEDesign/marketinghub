# Full App Architecture & UX Audit

**Goal:** One system, one truth, one editing model.

**Date:** February 2025

---

## 0. Audit Principles (Locked In)

These principles guide every decision and every flag in this audit.

| Principle | Short |
|-----------|--------|
| **One source of truth per concept** | No duplicated definitions; one canonical place. |
| **One editing experience per entity type** | Block editing, record editing, filter editing: one model each. |
| **One visual language per interaction** | Shared spacing, chrome, layout tokens. |
| **No special-case UI paths unless explicitly justified** | Avoid "this one component" fixes. |
| **Blocks describe content, not behaviour** | Config = what to show; behaviour comes from type + engine. |
| **Editors reflect the live view as closely as possible** | Edit in context; no "settings panel" that looks unrelated. |

**Rule:** The audit flags every place these are violated.

---

## 1. Sources of Truth Audit

### 1.1 Blocks — Ownership & Duplication

**Where is the canonical definition of a block?**

- **Schema / default config:** Largely in one place: `lib/interface/registry.ts` (`BLOCK_REGISTRY` + `defaultConfig` per type) and `lib/interface/types.ts` (`BlockConfig`). `lib/core-data/block-defaults.ts` correctly delegates to the registry.  
- **Editable settings:** Split. **Data** and **appearance** settings are in `components/interface/settings/blockSettingsRegistry.tsx` (`DATA_SETTINGS_RENDERERS`, `APPEARANCE_SETTINGS_RENDERERS`) — one component per block type. So “what can be edited” is defined there, not derived from the block definition.  
- **Appearance:** `lib/interface/appearance-utils.ts` maps appearance config to classes; `BlockAppearanceWrapper` applies them. Container/spacing from appearance was intentionally removed (fixed `p-4` in wrapper).  
- **Behaviour:** Implemented per block in `components/interface/blocks/*.tsx` and dispatched by `components/interface/BlockRenderer.tsx` (single switch on `block.type`).

**Duplication and red flags**

| Issue | Location | Violation |
|-------|----------|-----------|
| **Two block systems** | `components/interface/BlockRenderer.tsx` (PageBlock, page_blocks) vs `components/blocks/BlockRenderer.tsx` (ViewBlock, view_blocks) | Two sources of truth for “block”. ViewBlock uses different types (text, image, chart, kpi, html, embed, table, automation) and is used only by `components/views/InterfacePage.tsx` for table view pages (`/tables/[tableId]/views/[viewId]`). |
| **Block config shape** | `BlockConfig` in `types.ts` is a large union; `block-config-types.ts` adds discriminated unions and validation. Defaults live in registry; validation in block-validator + assertBlockConfig. | Schema is “one place” but spread across types, registry, and validator — no single file that defines “block X = this schema + these defaults + this validation”. |
| **Settings not derived from block definition** | blockSettingsRegistry maps block type → Data/Appearance renderers. Registry has `applicableSettings` / `excludedSettings` but settings UI does not drive from it. | Which settings exist is duplicated: registry says what applies; settings panel has its own mapping. |
| **Inline config merging in BlockRenderer** | BlockRenderer merges `recordId`, builds `fieldBlockConfig` for field blocks (e.g. `allow_inline_edit`). | Behaviour-affecting config is patched at render time rather than coming from a single config shape. |

**Target state (not yet met)**

- A block is defined once (type, schema, default config, editable settings, validation).
- All renderers (Canvas, ModalCanvas, ModalLayoutEditor) consume that definition.
- All editors edit the same schema; no render-time-only patches for “who can edit”.

---

### 1.2 Filters & Conditions

**How many filter systems exist?**

- **Views:** DB tables `ViewFilter`, `ViewFilterGroup`; converted to canonical model via `lib/filters/converters.ts` (`dbFiltersToFilterTree`).  
- **Blocks:** Block-level filters in `BlockConfig.filters` (flat); Filter blocks emit state; merged in `lib/interface/filters.ts` and converted to `FilterTree` for evaluation.  
- **Interfaces:** Page/block filters flow through same merge and evaluation.  
- **Automations:** Use `FilterTree` from `lib/filters/canonical-model.ts`; `evaluate-conditions.ts` and `condition-formula.ts` consume it.

**Are operators, condition groups, AND/OR consistent?**

- **Canonical model:** One schema in `lib/filters/canonical-model.ts` (`FilterTree`, `FilterGroup`, `FilterCondition`, `FilterOperator`, `GroupOperator`).  
- **Representations:** Views use DB format → converted to FilterTree. Blocks use `FilterConfig` (flat) in `lib/interface/filters.ts` → converted to FilterTree. Automations use FilterTree directly.  
- So: one evaluation engine, one condition schema; multiple input shapes (DB, FilterConfig, FilterTree).

**Red flags**

| Issue | Detail |
|-------|--------|
| **Two input formats** | FilterConfig (flat, field/operator/value) vs FilterTree (groups, AND/OR). Conversion is explicit but UIs differ: view filter UI vs Filter block UI vs automation condition UI. |
| **Filter UI differs by context** | FilterDialog, UnifiedFilterDialog, FilterBuilder, QuickFilterBar, BlockFilterEditor, FilterBlockSettings — not all necessarily use the same condition component set. |
| **Legacy applyFiltersToQuery** | `lib/interface/filters.ts` has `applyFiltersToQuery` marked deprecated in favour of `lib/filters/evaluation`; both paths exist. |

**Target state (partially met)**

- One filter engine and one condition schema (canonical model).  
- Many UIs can consume it; goal is one shared filter UI primitive set for building views, blocks, and automations.

---

## 2. Editing Models Audit

### 2.1 Canvas vs Modal vs Inline

**What does “editing” mean in each context?**

| Context | What is edited | Authority |
|---------|----------------|-----------|
| **Canvas (InterfaceBuilder)** | Layout (x,y,w,h), add/remove blocks, block config via SettingsPanel | Layout + block config. |
| **Block edit (e.g. TextBlock, FieldBlock)** | Inline content or field value; some blocks open Settings or modals. | Block config or record data. |
| **Record modal** | Record fields; layout if modal_layout is used (ModalCanvas). | Record data; modal layout is block-level config. |
| **ModalLayoutEditor** | Which blocks appear in record modal and their positions (field, text, divider, image only). | Same modal_layout as used by RecordModal/ModalCanvas. |

**Problems identified**

- **Canvas editor vs block editor:** Clicking a block can select for layout vs open settings vs inline-edit. Multiple entry points; behaviour varies by block type.  
- **Edit modal disconnected from live view:** Record modals use either a simple field list (RecordFields) or ModalCanvas. ModalCanvas uses the same BlockRenderer and BlockAppearanceWrapper but with `isEditing={false}`, no drag/resize, no add block. So “live” modal layout matches what you see, but the *editor* for that layout (ModalLayoutEditor) is a separate dialog with its own preview — not in-place.  
- **Modal layout ≠ canvas layout:** Modal uses `MODAL_CANVAS_LAYOUT_DEFAULTS` (e.g. margin [0,0], 8 cols) and `MODAL_CANVAS_LAYOUT_CONSTRAINTS`; main Canvas uses `CANVAS_LAYOUT_DEFAULTS` (margin [10,10], 12 cols). Shared file `canvas-layout-defaults.ts` keeps numbers in one place but the *experience* (no add block in modal, no resize in modal) differs.  
- **Can’t add blocks in modal:** In ModalCanvas you only see the blocks already in modal_layout; there is no “add block” in the modal itself. Adding/removing blocks is only in ModalLayoutEditor.

**Red flags**

- Multiple edit entry points with different rules (click block → settings vs inline vs nothing).  
- Modals that look like the live view in content but are edited in a separate “layout editor” dialog.  
- Editors that feel like “settings panels” (SettingsPanel, ModalLayoutEditor) rather than editing in the same shell as the live view.

**Target state**

- One editing shell; same layout logic, same blocks, same controls.  
- Context (page vs record modal) determines what is editable, not a different UI or different rules.

---

### 2.2 Record Modals & Record Editors

**How many record editors exist?**

| Editor | Location | Used by | Layout |
|--------|----------|--------|--------|
| **RecordModal (grid)** | `components/grid/RecordModal.tsx` | GridView | RecordFields or ModalCanvas (if modal_layout). Props: isOpen, tableName, modalFields, modalLayout. |
| **RecordModal (calendar)** | `components/calendar/RecordModal.tsx` | CalendarView, ListView, FieldBlock, InlineFieldEditor, etc. | FieldEditor + ModalCanvas (if modal_layout). Props: open, tableFields, modalFields, modalLayout, showFieldSections, initialData, onSave. |
| **RecordPanel** | `components/records/RecordPanel.tsx` | Side panel (WorkspaceShell) | RecordFields only (no block layout). |
| **RecordDrawer** | `components/grid/RecordDrawer.tsx` | AirtableKanbanView | Own layout. |
| **Record review left column** | `components/interface/RecordReviewLeftColumn.tsx` | RecordReviewPage | Custom field list / grouping, not BlockRenderer. |
| **RecordDetailsPanel** | `components/interface/RecordDetailsPanel.tsx` | — | RecordFields. |
| **CreateRecordModal** | `components/records/CreateRecordModal.tsx` | RecordReviewLeftColumn | Create flow. |

**Are field layouts consistent?**

- **No.** When no modal_layout: grid RecordModal uses RecordFields; calendar RecordModal uses FieldEditor (with sectioning). RecordPanel and RecordDetailsPanel use RecordFields. Record review left column uses its own list and spacing (e.g. `w-80`, `p-4`, `paddingLeft: 12 + level * 16`).  
- **With modal_layout:** Both RecordModals use ModalCanvas + BlockRenderer; layout is consistent for that path, but the two RecordModal components have different APIs and different fallbacks (RecordFields vs FieldEditor).

**Red flags**

- **Two RecordModal components** with different props and different default content (RecordFields vs FieldEditor).  
- **Spacing/layout:** Left sidebar and field groups use local classes/values (e.g. `p-4`, `gap-2`, `w-80`) rather than shared tokens.  
- **Different record editors look like different products** (panel vs drawer vs modal vs left column).

**Target state**

- One record editor system; configurable layout, consistent feel.  
- One modal/drawer/panel shell that can show either simple field list or block-based layout from one config.

---

## 3. UI & Appearance Unification

**Are paddings, gaps, borders consistent?**

- **Block chrome:** `BlockAppearanceWrapper` uses fixed `contentPadding = 'p-4'`; container styling from appearance was removed (`getAppearanceClasses` returns `""`). So block-level spacing is not driven by tokens.  
- **Record / left column:** `RecordReviewLeftColumn` uses `w-80`, `p-4`, `px-4 py-3`, inline `paddingLeft: 12 + level * 16`.  
- **Modals / dialogs:** Various DialogContent and layout classes; no single spacing system.  
- **Canvas:** `canvas-layout-defaults.ts` defines margin and row height; good for grid, not for general “spacing tokens”.

**Red flags**

- Hardcoded spacing per component (p-4, gap-2, etc.).  
- No shared spacing tokens or layout primitives for record containers, sidebars, field groups, block chrome, modal chrome.  
- Visual tweaks done locally; no single place to change “all record sidebars” or “all block padding”.

**Target state**

- Shared spacing tokens and layout primitives; predictable visual rhythm everywhere.

---

## 4. Linked Records

**How many display modes exist for linked records?**

- In types: `appearance.linked_field_display_mode`: `'compact' | 'inline' | 'expanded' | 'list'` (FieldBlock, FieldAppearanceSettings).  
- InlineFieldEditor: `displayMode?: 'compact' | 'inline' | 'expanded'` — no `'list'`.  
- So: config allows four modes; one consumer only supports three.

**Are they configurable per field, per view, per block?**

- Configurable per **field block** (appearance) and in FieldAppearanceSettings. Not consistently exposed per view or per generic “linked record field” in grid/cards.

**Red flags**

- Linked records can look different in grid vs field block vs inline editor.  
- Display mode option `'list'` exists in schema but not in InlineFieldEditor.  
- No single “linked record field” component with one data model + one display mode + one interaction model used everywhere.

**Target state (Airtable-inspired)**

- Linked record field has: one data model, one display mode (configurable), one interaction model — consistent across blocks and views.

---

## 5. Interaction Model & Entry Points

**How many ways can a user “edit” something?**

- **Page/canvas:** Enter edit mode → resize/move blocks, click block → SettingsPanel, add block via FloatingBlockPicker.  
- **Block:** Click to select; some blocks have inline edit (Text, Field), some open modal (e.g. create record).  
- **Record:** Click row/card → RecordPanel or RecordModal (or RecordDrawer in Kanban). In record: edit fields inline or in modal.  
- **Filter:** View filter UI, Filter block UI, automation condition UI.  
- **Modal layout:** Open ModalLayoutEditor from block/page settings → edit modal layout in dialog.

**Red flags**

- Many ways to do the same thing (e.g. open record: panel vs modal vs drawer depending on view).  
- Context switching without clarity (editing layout in one place, record in another, filter in another).  
- Users may be unsure “where” they are editing (page vs block vs record).

**Target state**

- Clear modes: View → Edit → Configure; not mixed unintentionally.  
- Consistent “open record” and “edit record” entry points across views.

---

## 6. Developer Experience

**If you add a new block, how many files do you touch?**

- **Minimum:** registry (type, label, icon, dimensions, defaultConfig), types (BlockConfig if new keys), BlockRenderer (case + import), blockSettingsRegistry (Data + Appearance renderers), and the new block component. Optional: block-config-types, block-validator, assertBlockConfig.  
- So: at least **4–5 files**; up to **7+** if you want full validation and typed config.

**If you change a setting, how many components break?**

- Changing a **block default** in registry is safe (block-defaults uses it).  
- Adding a **new appearance option** touches types, appearance-utils (if new class mapping), BlockAppearanceWrapper (if new behaviour), and possibly blockSettingsRegistry.  
- So: one conceptual change can require edits in several places.

**Can a developer tell where truth lives?**

- **Blocks:** Truth is split: registry (defaults), types (schema), blockSettingsRegistry (what to show in settings), BlockRenderer (what to render).  
- **Filters:** Truth is in canonical-model; converters and filters.ts are the bridges.  
- **Record editors:** No single “record editor” module; multiple components own different parts.

**Red flags**

- Same setting defined or implied in multiple places (e.g. applicableSettings in registry vs which tabs/settings exist in blockSettingsRegistry).  
- “Just tweak this one component” fixes that don’t align with a single source of truth.  
- Refactoring is risky because behaviour is spread across many files.

**Target state**

- Predictable architecture: one place per concept.  
- Adding a block or a setting has a clear, minimal checklist.  
- Safe refactors because truth is explicit and localised.

---

## 7. Final Output

### 7.1 Duplicated Concepts

| Concept | Duplicated in / as |
|--------|---------------------|
| **Blocks** | Two systems: PageBlock + interface/BlockRenderer (pages) vs ViewBlock + blocks/BlockRenderer (table view pages). |
| **Block schema/defaults** | Registry + types + block-config-types + block-validator; settings UI in blockSettingsRegistry not derived from registry. |
| **Editors** | SettingsPanel (block config), ModalLayoutEditor (modal layout), various block-inline editors. |
| **Filters** | FilterConfig (flat) vs FilterTree (canonical); view filters vs block filters vs automation conditions — one engine, multiple input UIs. |
| **Record views** | grid/RecordModal, calendar/RecordModal, RecordPanel, RecordDrawer, RecordReview left column, RecordDetailsPanel, CreateRecordModal. |

### 7.2 Conflicting Editing Models

| Conflict | Description |
|----------|-------------|
| **Canvas vs modal** | Canvas: resize, add block, settings. Modal: view-only layout; editing modal layout is in ModalLayoutEditor dialog, not in-context. |
| **Canvas vs inline** | Some blocks support inline edit (text, field); others only settings or modal. No single rule for “click = edit content” vs “click = select for layout”. |
| **Record: panel vs modal vs drawer** | Same “open record” intent, different UX (side panel, dialog, drawer) depending on view. |
| **Record modal content** | With modal_layout: BlockRenderer + ModalCanvas. Without: grid uses RecordFields, calendar uses FieldEditor — different fallbacks. |

### 7.3 UI Inconsistencies

| Area | Issue |
|------|--------|
| **Spacing** | Hardcoded p-4, gap-2, px-4 py-3, w-80, etc.; no shared tokens. |
| **Layout** | Canvas margin [10,10], modal margin [0,0]; shared defaults file but different “feel”. |
| **Chrome** | Block header/padding fixed in BlockAppearanceWrapper; record sidebars and modals each do their own. |
| **Field groups** | RecordFields vs FieldEditor vs RecordReview left column each structure fields differently. |

### 7.4 Missing or Inconsistent Configuration

| Item | Gap |
|------|-----|
| **Linked record display** | `list` mode in schema not supported in InlineFieldEditor; display mode not consistently configurable per view. |
| **Editor layout** | No single “record editor layout” config that drives panel, modal, and drawer from one place. |
| **Filter UI** | One engine, multiple UIs; no single “filter condition” component set for views, blocks, and automations. |

### 7.5 One-Sentence Problem Statements

1. **Blocks are defined in multiple places (registry, types, settings registry, two BlockRenderers) and edited inconsistently.**  
2. **Two block systems exist (PageBlock vs ViewBlock) with different types and storage.**  
3. **Filters have one engine and one canonical schema but multiple input formats and UIs (views, blocks, automations).**  
4. **Record editing is split across two RecordModal components, RecordPanel, RecordDrawer, and record review left column with different layouts and APIs.**  
5. **Modal layout is edited in a separate dialog (ModalLayoutEditor), not in the same shell as the live record modal.**  
6. **Canvas editing (layout + settings) and block inline editing and record editing have different entry points and rules.**  
7. **Spacing and chrome are hardcoded per component; there are no shared layout/spacing tokens.**  
8. **Linked record display mode is not fully consistent (e.g. `list` in schema but not in InlineFieldEditor).**  
9. **Adding a new block or a new setting requires touching many files with no single checklist.**

---

## 8. Recommended Next Steps

1. **Unify block definition:** Single block schema (type + config shape + defaults + validation + applicable settings); registry as source; settings UI and BlockRenderer consume it.  
2. **Resolve two block systems:** Decide whether ViewBlock/view_blocks is legacy or a separate product; if legacy, plan migration to PageBlock/page_blocks and one BlockRenderer.  
3. **One record editor shell:** Single component (or small set) for “show/edit record” with configurable layout (field list or modal_layout); reuse for panel, modal, and drawer.  
4. **One filter UI primitive set:** Shared condition/group components for view filters, filter blocks, and automation conditions.  
5. **Unified editing shell:** Same layout and block set for canvas and record modal; context (page vs record) only gates what’s editable, not how it looks.  
6. **Design system:** Introduce spacing and layout tokens; refactor block chrome, record containers, and modals to use them.  
7. **Document “add a block” and “add a setting” checklists** so DX is predictable and refactors are safe.

---

*Audit performed against the codebase under `baserow-app/` and related `lib/`, `types/`, and `docs/`.*
