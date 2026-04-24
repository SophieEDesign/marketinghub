# Block Settings Audit

## Executive summary

Main issues found:
- Several settings are surfaced in UI but are not currently wired to rendering (`appearance.gallery_rows_per_page`, `appearance.gallery_display_field_names`, `appearance.calendar_preview_field_count`, `appearance.timeline_layout`, `appearance.number_format`, `appearance.show_trend`, `appearance.wrap_headers`, `appearance.show_field_descriptions`, `appearance.kanban_hide_empty_stacks`).
- Some settings are partially effective by block/view (notably `appearance.row_height`, and `display_mode`/`record_limit`/`overflow_behaviour` parity across grid/list/gallery vs timeline/calendar).
- Color controls are conceptually duplicated and confusing: generic `Color` in view appearance, `Data Colors` in common appearance, and fallback legacy `config.color_field` paths in some renderers.
- Legacy key compatibility is actively required in saved data (`row_limit`, `displayMode`, `show_title`, `list_*` aliases, `title_field`, `image_field`, `text_content`/`content`), so unused-in-render alone is not a safe removal signal.

Highest-priority broken settings (fix first):
1. `appearance.gallery_rows_per_page` (UI present, no render consumer).
2. `appearance.gallery_display_field_names` (UI present, no render consumer).
3. `appearance.calendar_preview_field_count` (UI present, no render consumer).
4. `appearance.timeline_layout` (UI present, no render consumer).
5. KPI appearance `appearance.number_format` and `appearance.show_trend` (UI present, no render consumer).

Duplicate/unclear settings:
- `showTitle` vs `show_title` (both currently written/read in places).
- `displayMode` vs `display_mode` (record context compatibility).
- `row_limit` vs `record_limit` (legacy + canonical).
- `group_by` vs `group_by_field` vs `group_by_rules` (legacy + modern nested grouping).
- `image_field` vs `appearance.image_field` vs `list_image_field`.
- `title_field` vs `list_title_field` vs `gallery_title_field`.

Settings likely to move to Advanced:
- Most legacy compatibility toggles/aliases.
- Less frequently used visual controls: `shadow`, `margin`, `card_text_behaviour`, fixed card height px, advanced grouping defaults.
- Potentially `ConditionalFormattingEditor` controls in grid appearance (already advanced behavior).

Guardrail applied:
- No setting is marked safe to remove based solely on current render non-usage. Saved-config prevalence and fallback normalization paths are considered first.

## Saved-config evidence (existing blocks)

Source: live `view_blocks.config` sampling from current project data and key frequency queries.

Observed legacy keys still present in saved blocks:
- Top-level: `row_limit` (27 blocks), `display_mode` (1), `image_field` (2), `list_image_field` (2), `title_field` (3), `list_title_field` (28).
- Appearance: `appearance.showTitle` (35), `appearance.show_title` (1), `appearance.row_height` (6), `appearance.color_field` (15), `appearance.image_field` (3), `appearance.kanban_hide_empty_stacks` (2).

Representative saved-config examples (abridged):
- `grid` block with list view stores `row_limit`, `view_type: "list"`, `list_title_field`, and `appearance.color_field`.
- `record_context` stores both `displayMode` and `display_mode`, plus `list_*` fields and `image_field`.
- `text` stores `content_json` plus legacy `text_content`.
- `link_preview` stores both `url` and `link_url`, plus `link_description`.
- `timeline` stores `date_from`/`date_to` plus `start_date_field`/`end_date_field`, plus `timeline_*` aliases.

Compatibility conclusion:
- Legacy keys are actively present in current saved configs; they should be migrated/deprecated deliberately, not removed abruptly.

## Settings inventory table

| Setting | Config key | Block types | Works? | Current behaviour | Recommended action | Recommended group | Suggested label |
|---|---|---|---|---|---|---|---|
| Display height | `display_mode` | grid, list, gallery, calendar, kanban, timeline | Partially works | Strong effect in grid/list/gallery; weak/inconsistent in timeline/calendar containers | Keep; clarify per-view behavior | Display | Display height |
| Record limit / Rows shown | `record_limit` + `row_limit` | grid-family views | Works | Limits fetched/rendered rows with fallback default | Keep canonical `record_limit`; retain `row_limit` compatibility | Content | Records shown |
| When records exceed limit | `overflow_behaviour` | grid-family views | Partially works | `view_all`/`scroll` works in list/grid/gallery; `paginate` mostly placeholder | Keep; hide unsupported modes per view | Display | Overflow behaviour |
| View type | `view_type` | grid block family | Works | Switches renderer path and per-view settings | Keep | Content | View type |
| Filter mode / Records to show | `filter_mode` | grid-family, record_context | Works | Selects all/viewer/specific path | Keep | Content | Records to show |
| Filters | `filters`, `filter_tree` | many data blocks | Works | Query constraints applied via filter engine | Keep | Content | Filter conditions |
| Sort | `sorts` | grid-family, horizontal_grouped, record_context | Works | Applied in views and query | Keep | Content | Sort |
| Group by | `group_by_field`, `group_by`, `group_by_rules` | grid/list/gallery/kanban/timeline/horizontal_grouped/record_context | Works | Nested and legacy grouping paths both supported | Keep; consolidate UX toward `group_by_rules` | Content | Group records by |
| Groups on load | `*_groups_default_collapsed` keys | grid/gallery/list/horizontal_grouped | Works | Controls initial collapsed state | Keep in Advanced | Display | Groups open on load |
| Row height | `appearance.row_height` | grid/list/gallery/calendar/kanban/timeline settings UI | Partially works | Effective in grid/table density and timeline compact fallback; limited impact elsewhere | Keep but relabel per-view; hide where ineffective | Display | Density |
| Wrap long cell values | `appearance.wrap_text` | list, grid, kanban | Partially works | Used in some views; semantics vary | Keep | Display | Wrap text |
| Wrap headers | `appearance.wrap_headers` | grid | Does nothing | No render consumer found in grid header rendering | Wire up or hide | Display | Wrap column headers |
| Field descriptions | `appearance.show_field_descriptions` | grid | Does nothing | No render consumer found | Wire up or hide | Display | Show field descriptions |
| Cover image field | `appearance.image_field` | gallery | Works | Selects cover source; warning shown when empty | Keep | Content | Cover image field |
| Fit image size | `appearance.fit_image_size` | gallery/kanban/calendar | Works | Passed into card/event image rendering | Keep | Display | Fit images to frame |
| Title field (gallery card title) | `appearance.gallery_title_field` | gallery | Partially works | Read in gallery view, fallback to first visible field | Keep; explain fallback | Content | Card title field |
| Rows per page (gallery) | `appearance.gallery_rows_per_page` | gallery | Does nothing | UI writes key; no consumer in gallery render | Wire up or hide | Display | Cards per page |
| Display field names (gallery) | `appearance.gallery_display_field_names` | gallery | Does nothing | UI writes key; no consumer in gallery render | Wire up or hide | Display | Show field labels |
| Image field (kanban/calendar) | `appearance.image_field` | kanban, calendar | Works | Consumed by views for thumbnail/media context | Keep | Content | Image field |
| Hide empty stacks | `appearance.kanban_hide_empty_stacks` | kanban | Does nothing | UI writes key; no kanban consumer found | Wire up or hide | Display | Hide empty columns |
| Show field labels (kanban cards) | `appearance.kanban_show_field_labels` | kanban | Works | Passed to kanban card rendering | Keep | Display | Show field labels |
| Preview field count (calendar) | `appearance.calendar_preview_field_count` | calendar | Does nothing | UI writes key; no calendar consumer found | Wire up or hide | Display | Fields shown per event |
| Timeline layout | `appearance.timeline_layout` | timeline | Does nothing | UI writes key; no timeline consumer found | Wire up or hide | Display | Timeline layout |
| Timeline compact mode | `timeline_compact_mode` | timeline | Works | Explicitly toggles compact card height behavior | Keep | Display | Compact cards |
| Title field (list override) | `list_title_field`, `title_field` | list (plus legacy others) | Works | Determines list row title field | Keep canonical `list_title_field`; keep alias support | Content | List title field |
| List image field | `list_image_field` (+ fallback `image_field`) | list | Works | Used as list media source via fallback chain | Keep | Content | List image field |
| List subtitle fields | `list_subtitle_fields` | list | Works | Drives subtitle display fields | Keep | Content | Subtitle fields |
| List pill fields | `list_pill_fields` | list | Works | Select/multi-select chips | Keep | Content | Pill fields |
| List meta fields | `list_meta_fields` | list | Works | Extra metadata columns | Keep | Content | Metadata fields |
| Color field (view appearance) | `appearance.color_field` | grid/list/gallery/calendar/kanban/timeline | Works | Used for row/card/event colors in views | Keep as canonical | Colour | Colour by field |
| Data Colors (common appearance) | `appearance.color_field` | many data blocks | Duplicate/overlaps another setting | Same key/function as view-level Color in many blocks | Merge into single control per block | Colour | Colour by field |
| Accent colour | `appearance.accent` | most blocks | Works | Used by wrapper/header accents | Keep | Colour | Accent colour |
| Show label | `appearance.showTitle` + `appearance.show_title` | many blocks | Works (with overlap) | Both keys written/read for compatibility | Keep one canonical key + migration | Header | Show title |
| Header title | `appearance.title` (fallback `config.title`) | most blocks | Works | Displayed in wrapper/header | Keep | Header | Title |
| Title size | `appearance.titleSize` | most blocks | Works | Header typography size | Keep | Header | Title size |
| Title alignment | `appearance.titleAlign` | most blocks | Works | Header alignment | Keep | Header | Title alignment |
| Divider below title | `appearance.showDivider` | most blocks | Works | Header divider toggled | Keep | Header | Divider below title |
| Background | `appearance.background` | most blocks | Works | Container style variants | Keep | Advanced appearance | Background style |
| Border | `appearance.border` | most blocks | Works | Wrapper border style | Keep | Advanced appearance | Border style |
| Corner radius | `appearance.radius` | most blocks | Works | Wrapper rounding | Keep | Advanced appearance | Corner radius |
| Shadow | `appearance.shadow` | most blocks | Works | Wrapper shadow | Keep (Advanced) | Advanced appearance | Shadow |
| Padding | `appearance.padding` | most blocks | Works (legacy mixed types) | String scale; legacy numeric values also encountered | Keep with normalization | Advanced appearance | Inner spacing |
| Margin | `appearance.margin` | most blocks | Works | Outer spacing | Keep (Advanced) | Advanced appearance | Outer spacing |
| KPI number format | `appearance.number_format` | kpi | Does nothing | UI key not consumed by KPI render | Wire up or hide | Display | Number format |
| KPI show trend | `appearance.show_trend` | kpi | Does nothing | UI key not consumed by KPI render | Wire up or hide | Display | Show trend indicator |
| Link preview display mode | `appearance.display_mode` | link_preview | Works | Affects compact/card preview mode | Keep | Display | Display mode |

## List of settings that currently do nothing

- `appearance.wrap_headers`
- `appearance.show_field_descriptions`
- `appearance.gallery_rows_per_page`
- `appearance.gallery_display_field_names`
- `appearance.kanban_hide_empty_stacks`
- `appearance.calendar_preview_field_count`
- `appearance.timeline_layout`
- `appearance.number_format` (KPI)
- `appearance.show_trend` (KPI)

Note:
- These are no-op in current rendering, but not automatically safe to remove due to potential saved-config compatibility and in-flight feature expectations.

## Duplicate/confusing settings list

- `appearance.color_field` surfaced in both view-specific "Color" and shared "Data Colors".
- `appearance.showTitle` and `appearance.show_title`.
- `displayMode` and `display_mode`.
- `record_limit` and `row_limit`.
- `group_by`, `group_by_field`, `group_by_rules`.
- `image_field` / `list_image_field` / `appearance.image_field`.
- `title_field` / `list_title_field` / `gallery_title_field`.
- `content_json` with legacy `content` and `text_content`.
- `url` with legacy `link_url`; `link_description` with `description`.

## Block-by-block recommendations

### KPI / Metric
- Keep in simple mode: metric type (`kpi_aggregate`), field, label, filters, click-through.
- Move to Advanced: comparison/target details, icon details.
- Hide/remove candidate: KPI appearance `number_format`, `show_trend` until wired.
- Needs wiring: number format and trend toggle to actual KPI renderer.

### Gallery / Card
- Keep in simple mode: cover image field, title field, visible fields, sort, color field.
- Move to Advanced: card text behavior, fixed card height, show empty fields.
- Hide/remove candidate: rows per page and display field names until implemented.
- Needs wiring: `gallery_rows_per_page`, `gallery_display_field_names`.

### List
- Keep in simple mode: title field, subtitle/pill/meta fields, sort, filters, color.
- Move to Advanced: grouping defaults, card display fine controls.
- Hide/remove candidate: none immediately; alias keys still in saved configs.
- Needs wiring: clarify row-height semantics for list rows.

### Table / Grid
- Keep in simple mode: visible fields, filters, sorts, group by, record limit.
- Move to Advanced: highlight rules, wrap variants, modal layout controls.
- Hide/remove candidate: wrap headers/field descriptions toggles if not wired soon.
- Needs wiring: `wrap_headers`, `show_field_descriptions`.

### Calendar
- Keep in simple mode: start/end date field, visible fields, color field.
- Move to Advanced: default scroll target, visible week span.
- Hide/remove candidate: preview field count until wired.
- Needs wiring: `calendar_preview_field_count` if intended.

### Kanban
- Keep in simple mode: group by, fields on cards, color field, image field.
- Move to Advanced: wrap text, card display controls.
- Hide/remove candidate: hide empty stacks until wired.
- Needs wiring: `kanban_hide_empty_stacks`.

### Timeline
- Keep in simple mode: date fields, title field, tag field, group by, color field.
- Move to Advanced: compact mode and dense appearance controls.
- Hide/remove candidate: timeline layout selector until wired.
- Needs wiring: `timeline_layout`; align row-height UI with compact mode semantics.

### Filter block
- Keep in simple mode: connected elements, allowed fields/operators, defaults.
- Move to Advanced: compact year mode.
- Hide/remove candidate: none.
- Needs wiring: verify appearance fields are intentional for filter block (currently mostly common wrapper styling).

### Text / Content blocks
- Keep in simple mode: content editor, title, basic text style.
- Move to Advanced: container styling controls.
- Hide/remove candidate: none.
- Needs wiring: maintain legacy read fallback (`content`, `text_content`) until migration complete.

### Other custom blocks

Record context:
- Keep in simple mode: display mode, source table/view, key list fields.
- Move to Advanced: selection mode, add-record visibility, deep field layout.
- Hide/remove candidate: none due to heavy legacy key coexistence.
- Needs wiring: none critical; maintain dual-key compatibility (`displayMode`/`display_mode`).

Horizontal grouped:
- Keep in simple mode: table, group by, record fields.
- Move to Advanced: default collapsed behavior details.
- Hide/remove candidate: none.
- Needs wiring: none critical identified.

Field/number blocks:
- Keep in simple mode: field selector, inline edit permissions.
- Move to Advanced: attachment/link display modes.
- Hide/remove candidate: none.
- Needs wiring: none critical identified.

## Refactor plan (prioritised phases)

### Phase 1: fix dead/broken settings
1. Wire or suppress known no-op settings (`gallery_rows_per_page`, `gallery_display_field_names`, `calendar_preview_field_count`, `timeline_layout`, KPI trend/format, grid wrap headers/field descriptions, kanban hide empty stacks).
2. Add audit logging/tests proving each retained setting changes render output.
3. Keep compatibility reads for legacy keys during phase 1.

### Phase 2: simplify grouping and labels
1. Consolidate duplicate controls (single color-field control per block).
2. Standardize labels in plain English (e.g., "Records shown", "Colour by field", "Density").
3. Normalize header naming (`Show title`, not label/title mix).

### Phase 3: block-specific settings visibility
1. Show only settings relevant to current block/view.
2. Move low-frequency/technical options to Advanced.
3. Hide legacy alias controls from UI while preserving backend reads.

### Phase 4: visual polish
1. Tighten section hierarchy: Content, Display, Colour, Header, Advanced appearance.
2. Reduce verbosity for simple mode.
3. Add helper text only where behavior is non-obvious.

## Risk notes

High compatibility risk keys:
- `row_limit`, `displayMode`, `show_title`, `group_by`, `title_field`, `image_field`, `text_content`, `content`, `link_url`, `description`.

Why risky:
- These keys are still present in existing saved `view_blocks.config` records.
- Multiple renderers/settings components intentionally include fallback read paths.
- Removing fallback reads can silently change behavior (blank titles, missing colors, missing list media/title, lost limits/display mode).

Safe-change criteria before any removal:
1. Confirm key absent in live saved configs (not just absent in current renderer).
2. Confirm no fallback readers in code paths.
3. Add migration that rewrites old keys to canonical equivalents.
4. Ship with temporary telemetry/assertions to detect residual legacy configs.
