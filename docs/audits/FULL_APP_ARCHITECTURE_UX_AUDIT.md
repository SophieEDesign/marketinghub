# Full App Architecture & UX Audit

**Goal:** One system. One truth. One editing model.

**Important:** This is an **AUDIT ONLY** — no refactors, no implementation, no behavioural changes.

**Date:** February 2025

---

## 🔒 Core Constraints (Do Not Violate)

- Do not break anything that currently works  
- No behavioural changes  
- No refactors  
- No renaming  
- No moving files  
- This audit strictly **maps**, **identifies duplication**, and **flags inconsistencies**

---

## 🧭 Locked Principles (Non-Negotiable)

These principles define the intended system. The audit flags every place they are violated.

| # | Principle |
|---|-----------|
| 1 | **One source of truth per concept** |
| 2 | **Fields behave identically everywhere** |
| 3 | **Blocks describe content, not behaviour** |
| 4 | **One Record Editor** |
| 5 | **One Create Record experience** |
| 6 | **Same filters, same fields, same UI primitives everywhere** |
| 7 | **Context changes shell, not logic** |
| 8 | **Permissions cascade correctly (field > block > page)** |

---

## 🔒 Field Labels vs Internal Identifiers

User-facing UI must use field labels, not internal field IDs or raw column names.

Examples:

- ✅ Content Name
- ❌ content_name
- ❌ contentName
- ❌ field UUIDs or IDs

Field labels come from Core Data field definitions and are the canonical display value.

Internal names/IDs may be used internally for storage, queries, and logic, but must not leak into UI.

**Audit instruction:** Flag any UI surface where internal field identifiers are shown instead of field labels.

---

## 🔒 Inline Editing (Explicitly Preserved)

Inline editing of field values is intentional and must remain.

Inline editing:

- edits values only
- uses the same field renderer
- respects field permissions
- saves via the same record pipeline

Inline editing is allowed in:

- grid cells
- cards (kanban / calendar / timeline)
- record editor
- field blocks

Inline editing must not be confused with:

- layout editing
- block configuration
- record creation

Creating a record always escalates to the Record Editor (create mode).

**Audit instruction:** Do not flag inline editing as a problem unless it violates consistency, permissions, or field behaviour.

---

## 🔒 Core Data Mental Model

Core Data should be treated as a spreadsheet-style data surface.

This includes:

- fast inline editing
- dense layout
- keyboard-friendly interaction
- minimal chrome

These behaviours are intentional and should not be flagged as inconsistencies with Interfaces or Pages.

Interfaces are curated experiences; Core Data is a power-user data surface.

**Audit instruction:** Do not recommend removing or softening spreadsheet-like behaviours in Core Data.

---

## 🧱 System Model (INTENDED)

Used as the evaluation framework for the current codebase.

```
┌──────────────────────────┐
│        CORE DATA         │
│ Tables, Fields,          │
│ Field settings, Records  │
└─────────────▲────────────┘
              │ canonical read-only
┌─────────────┴────────────┐
│        INTERFACES         │
│ Navigation, Pages (Canvas) │
│ Page permissions          │
└─────────────▲────────────┘
              │ same canvas engine
┌─────────────┴────────────┐
│          CANVAS          │
│ Layout, Block placement  │
│ Appearance tokens        │
└─────────────▲────────────┘
┌─────────────┴────────────────────────────┐
│                 BLOCKS                     │
│ Data / Record / Visual blocks              │
│ Embedded OR full-page                     │
└─────────────▲────────────────────────────┘
┌─────────────┴────────────┐
│       RECORD EDITOR       │
│ One editor only          │
│ Modes: view / edit / create │
│ Same fields, validation, permissions      │
│ Shells: modal / full-page │
└──────────────────────────┘
```

**Blocks:** Blocks may be embedded in a canvas or marked fullPage: true. Full-page blocks occupy the entire page and disallow other blocks.

---

## 1. Where Is the Single Source of Truth?

### 1.1 Blocks

| Question | Answer |
|----------|--------|
| **Where is the single source of truth for blocks?** | **There is no single source.** Block definition is split across: (1) `lib/interface/registry.ts` (type, label, icon, dimensions, `defaultConfig`), (2) `lib/interface/types.ts` (`BlockConfig` union), (3) `lib/interface/block-config-types.ts` (discriminated configs + validation), (4) `lib/interface/block-validator.ts` and `assertBlockConfig.ts`, (5) `components/interface/settings/blockSettingsRegistry.tsx` (which Data/Appearance settings render per type). Settings UI is **not** derived from registry’s `applicableSettings` / `excludedSettings`. |
| **Additional:** | A **second block system** exists: `components/blocks/BlockRenderer.tsx` uses `ViewBlock` and `view_blocks` table (types: text, image, chart, kpi, html, embed, table, automation). Used only by `components/views/InterfacePage.tsx` for route `tables/[tableId]/views/[viewId]`. So “blocks” have two sources of truth: PageBlock + interface/BlockRenderer vs ViewBlock + blocks/BlockRenderer. |

### 1.2 Fields

| Question | Answer |
|----------|--------|
| **Where is the single source of truth for fields?** | **Core Data:** Field definitions, types, validation, select options, linked relationships come from the database (e.g. `table_fields`, table metadata). That is the intended source. |
| **Violation:** | Field **behaviour** and **rendering** are not unified. Different components render/edit fields: `FieldEditor`, `RecordFields`, `InlineFieldEditor`, grid/card cell renderers, FormBlock, FieldBlock, RecordPanel, RecordModal(s), RecordDrawer, RecordReview left column. Same field type can be rendered or validated differently depending on context (grid vs record editor vs field block vs form). |

### 1.3 Filters

| Question | Answer |
|----------|--------|
| **Where is the single source of truth for filters?** | **Canonical model:** `lib/filters/canonical-model.ts` defines `FilterTree`, `FilterGroup`, `FilterCondition`, `FilterOperator`, `GroupOperator`. Evaluation is in `lib/filters/evaluation.ts`. So **one engine, one schema** for evaluation. |
| **Violation:** | **Inputs** are not single: views use DB format (ViewFilter, ViewFilterGroup) converted via `lib/filters/converters.ts`; blocks use `FilterConfig` (flat) in `lib/interface/filters.ts` converted to FilterTree; automations use FilterTree directly. **Filter UI** differs by feature: FilterDialog, UnifiedFilterDialog, FilterBuilder, QuickFilterBar, BlockFilterEditor, FilterBlockSettings — not one shared primitive set. |

### 1.4 Record editing

| Question | Answer |
|----------|--------|
| **Where is the single source of truth for record editing?** | **There is no single Record Editor.** Multiple implementations: (1) `components/grid/RecordModal.tsx`, (2) `components/calendar/RecordModal.tsx`, (3) `components/records/RecordPanel.tsx`, (4) `components/grid/RecordDrawer.tsx`, (5) record review left column in `RecordReviewLeftColumn.tsx` (custom field list), (6) `RecordDetailsPanel.tsx`, (7) inline editing in grid/cards. When modal layout is used, both RecordModals use `ModalCanvas` + `BlockRenderer`; when not, grid RecordModal uses `RecordFields`, calendar RecordModal uses `FieldEditor` — different content components and different props. |

---

## 2. Where Are Concepts Duplicated?

### 2.1 Map of Duplicated Concepts

| Concept | Location(s) | Notes |
|---------|------------|--------|
| **Block definition** | `registry.ts`, `types.ts`, `block-config-types.ts`, `block-validator.ts`, `assertBlockConfig.ts`, `blockSettingsRegistry.tsx` | Schema, defaults, validation, and “what settings to show” are in different places; not one canonical definition. |
| **Block rendering** | `components/interface/BlockRenderer.tsx` (PageBlock), `components/blocks/BlockRenderer.tsx` (ViewBlock) | Two renderers, two block types, two storage models (page_blocks vs view_blocks). |
| **Record modal** | `components/grid/RecordModal.tsx`, `components/calendar/RecordModal.tsx` | Different props (e.g. isOpen vs open, tableName vs tableFields), different fallback content (RecordFields vs FieldEditor). |
| **Record content (field list)** | `RecordFields`, `FieldEditor`, RecordReview left column custom list, FormBlock | Same “show/edit fields of a record” intent implemented in multiple ways. |
| **Create record** | (1) `CreateRecordModal` (single primary field + API) used in RecordReviewLeftColumn; (2) `RecordModal` (calendar) with `recordId=null`, `initialData`, `onSave` used from FieldBlock, InlineFieldEditor, FieldEditor, LinkedRecordCell, ListView; (3) Grid “add row” / view-specific create (GridView, ListView, KanbanView, CalendarView, TimelineView) | More than one create-record implementation and form. |
| **Filter format** | `FilterConfig` (flat) in `lib/interface/filters.ts`, `FilterTree` in `lib/filters/canonical-model.ts`, DB ViewFilter/ViewFilterGroup | One evaluation model; multiple input formats and UIs. |
| **Layout defaults** | `lib/interface/canvas-layout-defaults.ts` (Canvas vs Modal defaults) | Single file but two layouts (main canvas vs modal); modal cannot add blocks and is edited in a separate ModalLayoutEditor dialog. |
| **Linked / lookup display** | `linked_field_display_mode` in types (compact \| inline \| expanded \| list); FieldBlock and FieldAppearanceSettings use all four; InlineFieldEditor only compact \| inline \| expanded | Schema allows `list`; one consumer does not support it. |

### 2.2 Two Components Solving the Same Problem Differently

| Problem | Component A | Component B | Difference |
|---------|-------------|-------------|------------|
| Open/edit record | Grid: `grid/RecordModal` | Calendar/List/FieldBlock/etc.: `calendar/RecordModal` | Different APIs and fallback content (RecordFields vs FieldEditor). |
| Show record fields | `RecordFields` | `FieldEditor` (+ sectioning) | Different structure and props; used in different shells. |
| Create record (modal) | `CreateRecordModal` (one field, then API) | `RecordModal` (calendar) with null recordId + initialData | Different flows and form surface. |
| Block layout (record modal) | `ModalCanvas` (view-only) | `ModalLayoutEditor` (edit in dialog) | Same blocks rendered, but editing is in a separate dialog, not in the same shell. |
| Filter UI | FilterDialog, FilterBuilder, QuickFilterBar | BlockFilterEditor, FilterBlockSettings | Different entry points and possibly different condition UIs. |

---

## 3. Where Do UI Shells Differ But Logic Should Not?

| Area | Shell(s) | Observation |
|------|----------|-------------|
| **Record open** | RecordPanel (side panel), RecordModal (dialog), RecordDrawer (drawer) | Same intent “open this record”; different shells and different content components (RecordFields vs FieldEditor vs modal layout). Logic (which fields, validation, permissions) should be one; today it is split. |
| **Create record** | CreateRecordModal (minimal), RecordModal (full form), grid/list/kanban/calendar “add” (inline or view-specific) | Create record is not “Record Editor in create mode” everywhere; multiple flows and forms. |
| **Edit block** | Canvas (resize, move, add block) + SettingsPanel (config) vs inline in some blocks (Text, Field) vs ModalLayoutEditor (modal layout only) | “Edit” means different things: layout, config, or content, with different entry points and UIs. |
| **Filter** | View filter UI, Filter block UI, Automation condition UI | Same canonical filter model; UIs are built separately, so behaviour could diverge. |

---

## 4. Where Are Fields Rendered Differently?

| Context | Component(s) | Note |
|---------|--------------|------|
| Grid cells | Cell renderers in AirtableGridView / GridView (e.g. LinkedRecordCell, LookupCell) | Cell-specific rendering and interaction. |
| Cards (Kanban, Gallery, List, etc.) | View-specific card body (e.g. ListView, KanbanView, GalleryView) | Different layout and which fields are shown. |
| Record editor (panel) | RecordPanel → RecordFields | Uses RecordFields. |
| Record editor (grid modal) | grid/RecordModal → RecordFields or ModalCanvas | RecordFields when no modal_layout. |
| Record editor (calendar modal) | calendar/RecordModal → FieldEditor or ModalCanvas | FieldEditor when no modal_layout; supports sectioning. |
| Field block | FieldBlock → FieldEditor or inline display | Single field; can open RecordModal for linked create. |
| Form block | FormBlock | Form-specific field rendering. |
| Record review left column | RecordReviewLeftColumn | Custom list with its own spacing and grouping. |

**Conclusion:** Fields do **not** behave identically everywhere. Rendering and editing paths depend on context (grid vs card vs record modal vs field block vs form vs record review).

---

## 5. Linked Fields & Lookups — Inconsistencies

| Issue | Detail |
|-------|--------|
| **Display modes** | Types allow `linked_field_display_mode`: `'compact' | 'inline' | 'expanded' | 'list'`. InlineFieldEditor only supports `compact | inline | expanded`. So `list` is not supported everywhere. |
| **Where configurable** | FieldAppearanceSettings (field block); not consistently exposed per view or per grid/card. |
| **Create new record** | Linked fields support “add new record” in several places (FieldEditor, InlineFieldEditor, LinkedRecordCell, FieldBlock) via opening RecordModal (calendar) or similar; CreateRecordModal (RecordReview) is a different, minimal flow. Experience is not one “same experience everywhere.” |
| **Bidirectional / read-only** | Lookups are derived and read-only in the data model; linked relationships are stored. Audit does not trace full bidirectional behaviour in UI; multiple components touch linked/lookup behaviour. |

---

## 6. Where Does “Edit” Mean Different Things?

| Context | What “edit” does |
|---------|-------------------|
| **Canvas (page)** | Select block, resize/move, add block, open SettingsPanel for config. |
| **Block inline** | TextBlock / FieldBlock: edit content or value in place; some open modal for create/linked. |
| **Record modal** | Edit record fields; if modal_layout, layout is fixed (no add block in modal). |
| **Modal layout** | Edit which blocks appear in record modal and their positions — in **ModalLayoutEditor** dialog, not in the modal itself. |
| **Record panel** | Edit record via RecordFields in side panel. |
| **Grid/cards** | Inline cell edit vs open record in panel/modal/drawer. |

So “edit” varies by context: structure (canvas), config (settings panel), content (inline block), record data (modal/panel/drawer), or modal layout (separate dialog).

---

## 7. Where Would Changing One Setting Not Propagate?

| Setting | Defined / used where | Risk |
|---------|----------------------|------|
| **Block defaults** | Registry `defaultConfig`; block-defaults.ts uses it. New blocks must be added to registry + BlockRenderer + blockSettingsRegistry. | Adding a block type: if one of these is missed, defaults or settings or rendering break. |
| **Applicable settings (block)** | Registry `applicableSettings` / `excludedSettings`; blockSettingsRegistry maps type → Data/Appearance renderers independently. | Changing “which settings this block has” in registry does not auto-update settings panel. |
| **Filter operators** | canonical-model FilterOperator; field-operators; each filter UI may have its own list. | Adding an operator in one place might not appear in all UIs. |
| **Record action permissions** | page-config record_actions; record-actions.ts; block permissions in block-permissions.ts; page-level pageEditable / editableFieldNames passed into blocks. | Field > block > page cascade is not clearly implemented as a single hierarchy; changing permission in one layer may not be respected everywhere. |
| **Modal layout** | Stored in block config (e.g. record block) `modal_layout`; used by both RecordModals and edited in ModalLayoutEditor. | If one RecordModal reads modal_layout differently from the other, behaviour diverges. |

---

## 8. Red Flags (Explicit Call-Outs)

These are the explicit red flags from the audit brief; every one is present.

| Red flag | Status | Where |
|----------|--------|--------|
| **More than one Record Modal / Record Editor** | ✅ Yes | grid/RecordModal, calendar/RecordModal, RecordPanel, RecordDrawer, RecordReview left column, RecordDetailsPanel; multiple content components (RecordFields, FieldEditor, custom list). |
| **More than one Create Record flow** | ✅ Yes | CreateRecordModal (RecordReview); RecordModal (calendar) with create mode; grid/list/kanban/calendar/view-specific “add record” flows. |
| **Field behaviour branching by context** | ✅ Yes | Different components and behaviour in grid, cards, record editor, field block, form, record review. |
| **Block settings defined in multiple places** | ✅ Yes | Registry (defaults, applicableSettings), blockSettingsRegistry (Data/Appearance renderers), and per-block settings components. |
| **Separate block systems** | ✅ Yes | PageBlock + interface/BlockRenderer (pages) vs ViewBlock + blocks/BlockRenderer (view_blocks, table view page). |
| **Filters implemented differently by feature** | ✅ Yes | One evaluation engine; view filters, block filters, and automation conditions use different input formats and UIs. |
| **Spacing / appearance hardcoded per component** | ✅ Yes | e.g. BlockAppearanceWrapper `p-4`; RecordReviewLeftColumn `w-80`, `p-4`, `paddingLeft: 12 + level * 16`; various dialogs and panels. |
| **Inline “special cases” for individual blocks or views** | ✅ Yes | BlockRenderer merges recordId and builds fieldBlockConfig for field blocks; view-specific create record and open-record behaviour; block-specific settings. |

---

## 9. Canonical Rules — Audit Against Intended Model

### 9.1 Core Data

| Rule | Status | Note |
|------|--------|------|
| Single source for field definitions, select options, linked/lookup relationships | ✅ Intended source is DB/Core Data | Field **behaviour** and rendering are not unified across the app. |
| Fields behave the same in grid, cards, record editor, field blocks | ❌ Violated | Different rendering and editing paths per context. |

### 9.2 Pages

| Rule | Status | Note |
|------|--------|------|
| Only one page type: Canvas | ❌ Violated | Page types: `content`, `record_view`, `record_review` (lib/interface/page-types.ts). Record view pages exist as separate concepts. |
| “Record view pages” should not exist as separate concept | ❌ Violated | record_view and record_review are explicit page types with their own definitions and layout (e.g. RecordReviewPage with fixed left column). |
| Full-page data views = blocks with fullPage: true | ❌ Not implemented | Full-page views are not modelled as “block with fullPage: true”; they are views/pages. |
| If page has full-page block, no other blocks allowed | N/A | fullPage block concept not present. |

### 9.3 Blocks

| Rule | Status | Note |
|------|--------|------|
| One canonical definition, one config schema, one settings model | ❌ Violated | Definition split across registry, types, block-config-types, validator, blockSettingsRegistry. Two block systems (PageBlock vs ViewBlock). |
| Shared settings (filters, fields, appearance) from one place | ❌ Violated | Filters: shared engine, multiple input/UIs. Appearance: appearance-utils + BlockAppearanceWrapper; settings from blockSettingsRegistry. |
| Editing a block’s settings should affect all instances of that block type | ⚠️ Partially | Config is per block instance; no single “template” that all instances share. Changing one block’s settings does not change others. |

### 9.4 Record Editor & Create Record

| Rule | Status | Note |
|------|--------|------|
| Exactly one Record Editor | ❌ Violated | Multiple record editors (two RecordModals, RecordPanel, RecordDrawer, RecordReview left column, etc.). |
| Create record = Record Editor in create mode | ❌ Violated | CreateRecordModal is a different, minimal form; other create flows use RecordModal or view-specific add. |
| Two shells only: Modal and Full page | ❌ Violated | Modal, full page, side panel, drawer all used; logic and content components differ. |
| Editor, fields, validation, layout identical everywhere | ❌ Violated | Different content components and layouts. |
| More than one create-record implementation or form? | ✅ Yes | CreateRecordModal; RecordModal create mode; view-specific add (grid, list, kanban, calendar, timeline). |

### 9.5 Linked & Lookup

| Rule | Status | Note |
|------|--------|------|
| Bidirectional; same behaviour everywhere | ⚠️ Partial | Lookups read-only; linked stored. Behaviour and display modes not fully consistent. |
| Lookup derived, read-only | ✅ Reflected in model | Display/editing paths vary by context. |
| Display modes consistent and fully supported everywhere | ❌ Violated | `list` in schema not supported in InlineFieldEditor. |

### 9.6 Filters

| Rule | Status | Note |
|------|--------|------|
| One canonical filter model, one evaluation engine | ✅ Met | canonical-model.ts + evaluation. |
| UI differences must not imply behavioural differences | ⚠️ At risk | Multiple UIs (view, block, automation); conversion layers could diverge. |

### 9.7 Permissions

| Rule | Status | Note |
|------|--------|------|
| Field > block > page; more specific overrides more general | ⚠️ Partially | Block permissions in block-permissions.ts (mode, allowInlineCreate, etc.); record_actions (create/delete) at page/config level; record-actions.ts for canCreateRecord/canDeleteRecord. No single documented cascade; field-level permissions (e.g. required, read-only per field) not audited here as a single hierarchy. |

---

## 10. List of Inconsistencies

1. **Two block systems:** PageBlock (pages) vs ViewBlock (view_blocks) with different types and renderers.  
2. **Block definition split:** Registry, types, block-config-types, validator, assertBlockConfig, blockSettingsRegistry — no single canonical definition.  
3. **Two RecordModal components** with different APIs and fallback content (RecordFields vs FieldEditor).  
4. **Multiple record content components:** RecordFields, FieldEditor, RecordReview left column custom list.  
5. **More than one Create Record flow:** CreateRecordModal, RecordModal create mode, view-specific add flows.  
6. **Filter input formats and UIs:** FilterConfig vs FilterTree vs DB filters; multiple filter UIs.  
7. **“Edit” means different things** by context (layout, config, content, record data, modal layout).  
8. **Modal layout** edited in a separate ModalLayoutEditor dialog, not in the same shell as the record modal.  
9. **Fields rendered differently** in grid, cards, record editor, field block, form, record review.  
10. **Linked field display mode** `list` in schema but not supported in InlineFieldEditor.  
11. **Record view page types** exist (record_view, record_review) although intended model is “only Canvas.”  
12. **Spacing and appearance** hardcoded per component; no shared tokens.  
13. **Applicable block settings** in registry not driving settings UI.  
14. **Permission cascade** (field > block > page) not implemented as one documented hierarchy.

---

## 11. Safe Consolidation Opportunities

These are **opportunities** to move toward one system/one truth/one editing model. They are listed for planning only; **no refactor or implementation** is implied. The audit does not propose how to implement them.

| # | Opportunity | Rationale |
|---|-------------|------------|
| 1 | **Document and centralise “where truth lives”** for blocks, fields, filters, record editing | No code or behaviour change; reduces risk that one change misses a duplicate. |
| 2 | **Single checklist for “add a new block type”** (and “add a new setting”) | Documentation only; makes it explicit which files must be touched so nothing is missed. |
| 3 | **Align filter UIs** on one set of condition/group primitives | Would reduce risk of behavioural divergence; implementation would be a later phase. |
| 4 | **Unify RecordModal API and fallback content** | Two components could be aligned (same props, same content component when no modal_layout) without yet merging into one component. |
| 5 | **Drive block settings UI from registry** (e.g. applicableSettings) | Would make “which settings this block has” come from one place; requires design so existing behaviour is preserved. |
| 6 | **Introduce shared spacing/layout tokens** and document usage | New tokens and gradual adoption; no requirement to change all components at once. |
| 7 | **Clarify or implement permission cascade** (field > block > page) in one place | Document or refactor so all layers read from one hierarchy; behaviour unchanged. |
| 8 | **Support `list` linked_field_display_mode** in InlineFieldEditor | Single missing option; aligns with schema. |
| 9 | **Resolve role of ViewBlock system** | Decide whether view_blocks/InterfacePage (table view page) is legacy or separate product; then document or plan convergence. |
| 10 | **One create-record entry point** (e.g. “Record Editor in create mode”) | Design only: define single flow and shells; implementation later. |

---

## 12. What This Audit Does Not Do

- **Does not** propose refactors.  
- **Does not** write or change code.  
- **Does not** rename or move files.  
- **Does not** change behaviour.  

This audit **only** maps the current state, identifies duplication, flags inconsistencies against the locked principles and intended system model, and lists safe consolidation opportunities for future review and implementation.

---

*Audit performed against the codebase under `baserow-app/`, `lib/`, `types/`, and related docs. No code or behaviour was modified.*
