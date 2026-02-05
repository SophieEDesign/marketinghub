# Reimplement priority: Error fixing first, then new features

**Base branch:** `revert-to-7fec709` (commit 7fec709)  
**Goal:** Apply error-fixing commits first (current features), then reimplement new features in order.

---

## Part 1: Error fixing (current features) — implement first

These fix bugs, type errors, build failures, or improve error handling in existing code. Apply in this order (oldest first) to minimize conflicts.

| Order | Commit     | Summary | Notes |
| ----- | ---------- | ------- | ----- |
| 1     | 4828eb91e3 | Remove duplicate import of POSTGREST_DEFAULT_MAX_ROWS in CalendarView | Lint/cleanup |
| 2     | 358b21a0fd | fix(tsx): resolve TS1005 by using type aliases instead of inline object assertions | ViewPage build fix |
| 3     | 55fb7a7e31 | fix(tsx): use double type assertion to fix TS1005 in view page | ViewPage build fix |
| 4     | 480a3887dd | Refactor type assertions in ViewPage for improved type safety | Type safety |
| 5     | 0b99a01d96 | Fix formatting issues and enhance error handling in GridView and related components | Error handling |
| 6     | 16405d4dc7 | Refactor error handling in GridView for improved type safety | Type safety |
| 7     | 5136e0c519 | fix(ListView): normalize filters to FilterConfig[] for typecheck/build | ListView build fix |
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

## Part 2: New features — reimplement after error fixing

Apply after Part 1 is done and tests pass. Order is approximate (oldest first); some depend on others.

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

**New features (Part 2):** After Part 1 is complete and verified, cherry-pick Part 2 commits in order (or apply in logical groups and test).
