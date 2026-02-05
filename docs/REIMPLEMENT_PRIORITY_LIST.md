# Reimplement priority: Error fixing first, then new features

**Base branch:** `revert-to-7fec709` (commit 7fec709)  
**Goal:** Apply error-fixing commits first (current features), then reimplement new features in order.

---

## What's done vs what's left (summary)

**Done:**  
- ViewPage type fixes (TS1005, type aliases, unknown catch).  
- ListView filter normalisation (`normalizeFilter` in useState).  
- CalendarBlock `React.memo`.  
- **Section 1:** BlockConfig types; HorizontalGroupedView already had `const`.  
- **Section 2:** Filter converters type safety (ViewFilterInput, ViewFilterGroupInput).  
- **Section 3:** computeLookupValues `getLookupDisplayValue()` helper.  
- **Section 12:** Navigation progress bar (NavigationProgress.tsx + layout + CSS).

**Skipped:**  
- Section 4 (linkedFields — different file structure).  
- Section 8 (ViewPage debug — no getViews/debug block).  
- Duplicate CalendarView import (not present at 7fec709).

**Left to do (see [REIMPLEMENT_SAFETY_ORDER.md](REIMPLEMENT_SAFETY_ORDER.md) for section order):**  
Sections 5, 6, 7, 9, 10, 11, 13, 14, 15 (GridView, filter dialog/CSV, modal/FieldBuilderModal, filter groups, click to add row, BlockAppearanceWrapper, modal layout, LookupFieldPicker/FieldBuilderModal display modes, interface builder/Canvas).

**Not in plan:** Cap-aware pagination, CoreDataViewTabs, context menu/sidebar.

---

## In simple terms: what to implement

### Part 1 — Fix things that are broken or fragile (do these first)

- **GridView** — Clean up formatting and make error handling safer so the grid doesn’t crash or behave oddly when something goes wrong.
- **Filters** — Make filter code type-safe: how filter values are parsed (including JSON arrays), and how database filters are turned into the internal filter tree, including when data is missing or partial.
- **Linked records** — Safer handling of linked-record data and types so linked fields don’t cause type or runtime errors.
- **Lookups** — Safer lookup value computation (FieldBlock and computeLookupValues): better error handling and type casting; RLS migration if needed.
- **Filter dialog & CSV import** — Better error handling in the filter UI and CSV import so bad data doesn’t break the app.
- **Filter and grid views** — General error-handling improvements so filters and grid views fail gracefully.
- **Linked-fields helpers** — Clearer, more consistent linked-fields logic (no new behaviour, just cleaner code).
- **HorizontalGroupedView** — Clearer variable names and structure (no new behaviour).
- **Filter components** — Stronger types and operator handling so filters work correctly with different operators.
- **Modals and navigation** — Better error handling and layout behaviour in modal and navigation diagnostics.
- **FieldBuilderModal** — Normalise select options so dropdowns and option lists behave consistently.
- **ViewPage debug logging** — Clearer, type-safe debug logging on the view page.

*(Already done: ViewPage type fixes so the view page builds; ListView filter normalisation so filters are always in the right shape; CalendarBlock wrapped in React.memo to fix React error #185. Skip: duplicate CalendarView import — not present at 7fec709.)*

---

### Part 2 — New behaviour (choose what you want, after Part 1)

- **Pagination / row limits** — Respect server row limits and add cap-aware pagination so you don’t hit “too many rows” errors; consistent limits (e.g. 2000) and explicit limits in grid and views.
- **Data loading** — Better data loading: consistent ordering and pagination across List, Calendar, Gallery, Kanban, Timeline, HorizontalGrouped; paginated fetching in useGridData and views.
- **Filter logic** — Richer filter handling in useGridData and converters; filter groups (AND/OR) in Airtable-style components.
- **Kanban** — Better Kanban behaviour and layout sync; optional Kanban card settings dialog.
- **Record limit and grouping** — Explicit record limit in the grid view and grouping support in the non-grid wrapper.
- **“Click to add” row** — Add a row by clicking in the grid (Airtable-style).
- **ViewPage & NonGridViewWrapper** — Better data and filter handling when switching between grid and non-grid views.
- **Interface builder / Canvas** — Better block settings, grouping labels, and editing in HorizontalGroupedView and Canvas; modal layout and layout settings.
- **LookupFieldPicker & FieldBuilderModal** — New display modes and clearer option handling.
- **BlockConfig** — Clearer BlockConfig types (e.g. image field usage; remove deprecated color field comments).
- **Advanced settings & grid appearance** — Permission handling and clearer layout for advanced and grid-appearance settings.
- **Context menu & sidebar** — Improved context menu and sidebar in grid components.
- **Navigation progress bar** — Progress bar and better field display when navigating.
- **Modal layout** — More consistent modal layout and constraints.
- **BlockAppearanceWrapper** — Simpler appearance settings flow.
- **Filter UI** — Richer filter UI and behaviour across components.
- **Core Data tabs** — Tabs on the view page to switch between “Core Data” and other views (CoreDataViewTabs).

**New files you might add when doing Part 2:**  
CoreDataViewTabs, NavigationProgress, Calendar/Timeline options dialog, Kanban card settings dialog, filters API route, debug-log helper, Supabase migrations (filter groups, RLS, list view type, kanban config, etc.), and docs (row limits, data access).

---

## Part 1: Error fixing (current features) — implement first

These fix bugs, type errors, build failures, or improve error handling in existing code. Apply in this order (oldest first) to minimize conflicts.

| Order | Commit     | Summary | Notes |
| ----- | ---------- | ------- | ----- |
| 1     | 4828eb91e3 | Remove duplicate import of POSTGREST_DEFAULT_MAX_ROWS in CalendarView | Lint/cleanup — **skip** (no duplicate at 7fec709) |
| 2–4   | 358b21a0fd, 55fb7a7e31, 480a3887dd | fix(tsx): TS1005 + type assertions in ViewPage | **Applied** (type aliases, unknown catch) |
| 5     | 0b99a01d96 | Fix formatting issues and enhance error handling in GridView and related components | Error handling |
| 6     | 16405d4dc7 | Refactor error handling in GridView for improved type safety | Type safety |
| 7     | 5136e0c519 | fix(ListView): normalize filters to FilterConfig[] for typecheck/build | **Applied** (normalizeFilter in useState) |
| 17    | 0028c78ca0 | Memoize CalendarBlock to prevent excessive re-renders and React error #185 | **Applied** (React.memo) |
| 8     | 8bf5d953b8 | Update parseFilterValue function to improve type safety and handling of JSON array strings | Filter type safety |
| 9     | 95f73f7cb3 | Refactor dbFiltersToFilterTree to accept partial filter data and improve type safety | Filter type safety |
| 10    | 4a9efe35b2 | Update dbFiltersToFilterTree to accept ViewFilterGroupInput for improved type safety | Filter type safety |
| 11    | d550a092d3 | Refactor linked record handling and improve type safety across components | Linked records type safety |
| 12    | 8d3287c32d | Refactor type casting in computeLookupValues and update RLS policies in SQL migration | Lookup + RLS |
| 13    | ddd606bdb0 | Enhance error handling in computeLookupValues function | Error handling |
| 14    | ebad19dc2e | Improve error handling in UnifiedFilterDialog and computeLookupValues | Error handling |
| 15    | 7e1d0179cf | Enhance filter and CSV import components with improved error handling and mapping options | Error handling |
| 16    | 8dd218ec7f | Improve error handling in filter and grid view components | Error handling |
| 17    | 0028c78ca0 | Memoize CalendarBlock to prevent excessive re-renders and React error #185 | React bug fix |
| 18    | 3815147cd6 | Enhance lookup record fetching and error handling in FieldBlock and computeLookupValues | Error handling |
| 19    | 474f1a9d7c | Refactor linkedFields functions for improved clarity and consistency | Clarity/consistency |
| 20    | c94881472a | Refactor variable declarations in HorizontalGroupedView for improved clarity | Clarity |
| 21    | 47ff7852c8 | Refactor filter components to enhance type handling and operator support | Filter type safety |
| 22    | 9c73c1b825 | Refactor modal and navigation diagnostics for improved layout and error handling | Error handling |
| 23    | 365f50ea7c | Refactor FieldBuilderModal to improve select options normalization | Select options fix |
| 24    | b544322d66 | Refactor debug logging in ViewPage for improved clarity and type safety | Debug/type safety |

**Note:** Commit b4ae1caacf (Revert grid and row loading to pre-cap-aware version) is not applied — we are already at 7fec709, which predates cap-aware.

---

## Part 2: New features — reimplement after error fixing **(pause: for you to choose)**

**Leave this section for now.** After Part 1 (error fixing) is done and tests pass, you choose which of these to reimplement and in what order. The list below is for reference only; no need to apply until you decide.

Apply when ready. Order is approximate (oldest first); some depend on others.

| Order | Commit     | Summary |
| ----- | ---------- | ------- |
| 1     | 7950a21078 | Implement cap-aware pagination across multiple components |
| 2     | fbd0129de1 | Enhance data retrieval across multiple views with consistent ordering and pagination |
| 3     | 0ab724a22b | Enhance data retrieval in HorizontalGroupedView and ListView with paginated fetching |
| 4     | 3d6d6dfe15 | Enhance data retrieval in AirtableKanbanView and useGridData with paginated fetching |
| 5     | e0a3939190 | Implement explicit row limit in multiple views |
| 6     | 4bc8d9ebf5 | Update DEFAULT_LIMIT in useGridData to 2000 |
| 7     | 951ffafa82 | Enhance filter value handling in converters and optimize useGridData query logic |
| 8     | 21fe233c92 | Enhance ViewPage and useGridData for improved data handling and performance |
| 9     | 70ae7adf47 | Refactor useGridData to improve data fetching and filtering logic |
| 10    | 534e308b72 | Enhance InterfaceBuilder and useGridData for improved state management and data fetching |
| 11    | 4c48a48502 | Enhance filtering and view handling in various components |
| 12    | 9675c4a025 | Enhance view types and filtering logic in ListView and ViewTopBar |
| 13    | c4f64664b6 | Enhance view functionality and filtering capabilities across multiple components |
| 14    | 5cecbd0820 | Enhance Kanban view functionality and improve layout synchronization |
| 15    | 53d2ab973b | Enhance filtering capabilities in Airtable components by integrating view filter groups |
| 16    | 64a53f85dc | Add explicit record limit in AirtableGridView and implement grouping functionality in NonGridViewWrapper |
| 17    | 7877563827 | Enhance AirtableGridView and GridView with "click to add" row functionality |
| 18    | 8b3cdc73d1 | Enhance ViewPage and NonGridViewWrapper components for improved data handling and filtering |
| 19    | b368554baf | Enhance HorizontalGroupedCanvasModal and HorizontalGroupedView for block settings and layout |
| 20    | fd8f0fdccf | Enhance Canvas component to improve editing experience |
| 21    | 1b886264d0 | Enhance InterfaceBuilder and HorizontalGroupedView block settings and grouping label resolution |
| 22    | 3fcf04be97 | Enhance InterfaceBuilder and HorizontalGroupedView block settings and grouping label resolution |
| 23    | 27b49a58aa | Enhance LookupFieldPicker and FieldBuilderModal with new display modes and option handling |
| 24    | d7836e1ac9 | Update BlockConfig interface (image field usage, deprecated color field comments) |
| 25    | b323aedc34 | Refactor advanced settings and grid appearance components for permission handling and clarity |
| 26    | 790afa16a6 | Enhance context menu functionality and sidebar management in grid components |
| 27    | 188bc43096 | Add navigation progress bar and improve field display handling |
| 28    | 5e96696a8c | Enhance modal layout consistency and constraints across components |
| 29    | 6ed523389d | Enhance layout settings management across components |
| 30    | 7050d387a5 | Refactor BlockAppearanceWrapper and related components to streamline appearance settings |
| 31    | 599daf9a15 | Enhance filter functionality and UI across components |
| 32    | 7b6f395fbc | Enhance ViewPage layout and functionality with CoreDataViewTabs integration |

**New files / assets to add when reimplementing:**  
CoreDataViewTabs.tsx, NavigationProgress.tsx, CalendarTimelineViewOptionsDialog.tsx, KanbanCardSettingsDialog.tsx, app/api/views/[viewId]/filters/route.ts, lib/debug-log.ts, Supabase migrations (filter groups, RLS, list view type, kanban card config, etc.), docs (ROW_LOADING_AND_STORAGE.md, DATA_ACCESS_ROW_LIMITS.md, VIEWS_AND_CORE_DATA_AUDIT.md).

---

## How to apply

**Error fixing (Part 1):** From branch `revert-to-7fec709`, cherry-pick in the order above:

```bash
git cherry-pick 4828eb91e3 358b21a0fd 55fb7a7e31 480a3887dd 0b99a01d96 16405d4dc7
# ... continue with remaining Part 1 commits; resolve conflicts as needed
```

If cherry-pick fails (e.g. `index.lock`, permission denied on `.git/objects`), run the above in a terminal **outside** the IDE and with OneDrive sync paused for this folder, or apply each commit’s changes manually:

- `git show <commit> -- <file>` to see the diff, then edit the file to match.

**Commit 4828eb91e3 (CalendarView):** On 7fec709 there is no duplicate `POSTGREST_DEFAULT_MAX_ROWS` import; no change needed. Skip or resolve any conflict by keeping HEAD.

**New features (Part 2):** Paused — for you to choose after error fixing. When ready, pick which Part 2 items to reimplement, then cherry-pick or apply in the order you prefer.
