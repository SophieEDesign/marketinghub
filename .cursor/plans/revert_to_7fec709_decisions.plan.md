---
name: ""
overview: ""
todos: []
isProject: false
---

# Revert to 7fec709 – Per-feature decisions (Add back or leave?)

**Base:** Branch at commit `7fec709` (deployment HuyLAvHUN).  
**Goal:** For each change below, decide **Add back** or **Leave**; then cherry-pick or re-apply only the “Add back” items.

---

## How to use this checklist

- **Add back** = you want this change reapplied on top of 7fec709.
- **Leave** = do not re-apply; stay at 7fec709 behavior for this.

After you decide, we can cherry-pick the “Add back” commits in order, or apply selected file edits by hand.

---

## 1. ViewPage / view page (debug, types, layout)


| #   | Commit     | Summary                                                                             | Add back? | Leave? |
| --- | ---------- | ----------------------------------------------------------------------------------- | --------- | ------ |
| 1   | b544322d66 | Refactor debug logging in ViewPage for improved clarity and type safety             |           |        |
| 2   | 55fb7a7e31 | fix(tsx): use double type assertion to fix TS1005 in view page                      |           |        |
| 3   | 358b21a0fd | fix(tsx): resolve TS1005 by using type aliases instead of inline object assertions  |           |        |
| 4   | 480a3887dd | Refactor type assertions in ViewPage for improved type safety                       |           |        |
| 5   | 0b99a01d96 | Fix formatting issues and enhance error handling in GridView and related components |           |        |
| 57  | 7b6f395fbc | Enhance ViewPage layout and functionality with CoreDataViewTabs integration         |           |        |


---

## 2. Grid / row loading and pagination (cap-aware)


| #   | Commit     | Summary                                                                                                  | Add back? | Leave? |
| --- | ---------- | -------------------------------------------------------------------------------------------------------- | --------- | ------ |
| 6   | b4ae1caacf | Revert grid and row loading to pre-cap-aware version (4828eb91e3)                                        |           |        |
| 7   | 16405d4dc7 | Refactor error handling in GridView for improved type safety                                             |           |        |
| 8   | 7950a21078 | Implement cap-aware pagination across multiple components to enhance data retrieval                      |           |        |
| 9   | 4828eb91e3 | Remove duplicate import of POSTGREST_DEFAULT_MAX_ROWS in CalendarView component                          |           |        |
| 10  | fbd0129de1 | Enhance data retrieval across multiple views with consistent ordering and pagination                     |           |        |
| 11  | c94881472a | Refactor variable declarations in HorizontalGroupedView for improved clarity                             |           |        |
| 12  | 0ab724a22b | Enhance data retrieval in HorizontalGroupedView and ListView with paginated fetching                     |           |        |
| 13  | 3d6d6dfe15 | Enhance data retrieval in AirtableKanbanView and useGridData with paginated fetching                     |           |        |
| 14  | e0a3939190 | Implement explicit row limit in multiple views to enhance data retrieval                                 |           |        |
| 15  | 4bc8d9ebf5 | Update DEFAULT_LIMIT in useGridData to 2000 for improved data visibility and prevent server cap issues   |           |        |
| 30  | 64a53f85dc | Add explicit record limit in AirtableGridView and implement grouping functionality in NonGridViewWrapper |           |        |


---

## 3. Filters (converters, useGridData, UI)


| #   | Commit     | Summary                                                                                    | Add back? | Leave? |
| --- | ---------- | ------------------------------------------------------------------------------------------ | --------- | ------ |
| 16  | 8bf5d953b8 | Update parseFilterValue function to improve type safety and handling of JSON array strings |           |        |
| 17  | 951ffafa82 | Enhance filter value handling in converters and optimize useGridData query logic           |           |        |
| 18  | 21fe233c92 | Enhance ViewPage and useGridData for improved data handling and performance                |           |        |
| 19  | 70ae7adf47 | Refactor useGridData to improve data fetching and filtering logic                          |           |        |
| 20  | 534e308b72 | Enhance InterfaceBuilder and useGridData for improved state management and data fetching   |           |        |
| 21  | 5136e0c519 | fix(ListView): normalize filters to FilterConfig[] for typecheck/build                     |           |        |
| 23  | 4c48a48502 | Enhance filtering and view handling in various components                                  |           |        |
| 24  | 9675c4a025 | Enhance view types and filtering logic in ListView and ViewTopBar                          |           |        |
| 25  | c4f64664b6 | Enhance view functionality and filtering capabilities across multiple components           |           |        |
| 27  | 4a9efe35b2 | Update dbFiltersToFilterTree to accept ViewFilterGroupInput for improved type safety       |           |        |
| 28  | 95f73f7cb3 | Refactor dbFiltersToFilterTree to accept partial filter data and improve type safety       |           |        |
| 29  | 53d2ab973b | Enhance filtering capabilities in Airtable components by integrating view filter groups    |           |        |
| 55  | 47ff7852c8 | Refactor filter components to enhance type handling and operator support                   |           |        |
| 56  | 599daf9a15 | Enhance filter functionality and UI across components                                      |           |        |


---

## 4. Kanban / Calendar / Timeline (views and settings)


| #   | Commit     | Summary                                                                          | Add back? | Leave? |
| --- | ---------- | -------------------------------------------------------------------------------- | --------- | ------ |
| 26  | 5cecbd0820 | Enhance Kanban view functionality and improve layout synchronization             |           |        |
| 36  | 8dd218ec7f | Improve error handling in filter and grid view components                        |           |        |
| 49  | 9c73c1b825 | Refactor modal and navigation diagnostics for improved layout and error handling |           |        |
| 50  | 790afa16a6 | Enhance context menu functionality and sidebar management in grid components     |           |        |
| 53  | 6ed523389d | Enhance layout settings management across components                             |           |        |
| 54  | 5e96696a8c | Enhance modal layout consistency and constraints across components               |           |        |


---

## 5. Lookup / FieldBlock / computeLookupValues


| #   | Commit     | Summary                                                                                   | Add back? | Leave? |
| --- | ---------- | ----------------------------------------------------------------------------------------- | --------- | ------ |
| 31  | 3815147cd6 | Enhance lookup record fetching and error handling in FieldBlock and computeLookupValues   |           |        |
| 32  | 8d3287c32d | Refactor type casting in computeLookupValues and update RLS policies in SQL migration     |           |        |
| 33  | ebad19dc2e | Improve error handling in UnifiedFilterDialog and computeLookupValues                     |           |        |
| 34  | ddd606bdb0 | Enhance error handling in computeLookupValues function                                    |           |        |
| 35  | 7e1d0179cf | Enhance filter and CSV import components with improved error handling and mapping options |           |        |


---

## 6. Linked records / type safety


| #   | Commit     | Summary                                                                                     | Add back? | Leave? |
| --- | ---------- | ------------------------------------------------------------------------------------------- | --------- | ------ |
| 22  | d550a092d3 | Refactor linked record handling and improve type safety across components                   |           |        |
| 39  | 474f1a9d7c | Refactor linkedFields functions for improved clarity and consistency                        |           |        |
| 40  | 8b3cdc73d1 | Enhance ViewPage and NonGridViewWrapper components for improved data handling and filtering |           |        |


---

## 7. Interface / Canvas / HorizontalGrouped


| #   | Commit     | Summary                                                                                                                 | Add back? | Leave? |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------- | --------- | ------ |
| 37  | 0028c78ca0 | Memoize CalendarBlock to prevent excessive re-renders and React error #185                                              |           |        |
| 38  | 7877563827 | Enhance AirtableGridView and GridView components with "click to add" row functionality                                  |           |        |
| 41  | b368554baf | Enhance HorizontalGroupedCanvasModal and HorizontalGroupedView for improved block settings and layout management        |           |        |
| 42  | fd8f0fdccf | Enhance Canvas component to improve editing experience                                                                  |           |        |
| 43  | 1b886264d0 | Enhance InterfaceBuilder and HorizontalGroupedView components for improved block settings and grouping label resolution |           |        |
| 44  | 3fcf04be97 | Enhance InterfaceBuilder and HorizontalGroupedView components for improved block settings and grouping label resolution |           |        |
| 45  | 365f50ea7c | Refactor FieldBuilderModal to improve select options normalization                                                      |           |        |
| 46  | 27b49a58aa | Enhance LookupFieldPicker and FieldBuilderModal components with new display modes and improved option handling          |           |        |
| 47  | d7836e1ac9 | Update BlockConfig interface to clarify image field usage and remove deprecated color field comments                    |           |        |
| 48  | b323aedc34 | Refactor advanced settings and grid appearance components for improved permission handling and clarity                  |           |        |
| 51  | 188bc43096 | Add navigation progress bar and improve field display handling                                                          |           |        |
| 52  | 7050d387a5 | Refactor BlockAppearanceWrapper and related components to streamline appearance settings                                |           |        |


---

## 8. New files / migrations / docs (optional to bring back)


| Item                                    | Description                                                                                                                                                                                                    | Add back? | Leave? |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------ |
| CoreDataViewTabs.tsx                    | Tab UI for Core Data vs other views                                                                                                                                                                            |           |        |
| NavigationProgress.tsx                  | Navigation progress bar                                                                                                                                                                                        |           |        |
| CalendarTimelineViewOptionsDialog.tsx   | Calendar/Timeline options dialog                                                                                                                                                                               |           |        |
| KanbanCardSettingsDialog.tsx            | Kanban card settings                                                                                                                                                                                           |           |        |
| app/api/views/[viewId]/filters/route.ts | Filters API route                                                                                                                                                                                              |           |        |
| lib/debug-log.ts                        | Debug logging utility                                                                                                                                                                                          |           |        |
| Supabase migrations                     | add_filter_groups_support, fix_view_filters_rls, fix_view_filter_groups_rls, add_list_view_type, add_kanban_card_config, add_table_rows_admin_select_policy, create_record_comments, create_view_filter_groups |           |        |
| Docs                                    | ROW_LOADING_AND_STORAGE.md, DATA_ACCESS_ROW_LIMITS.md, VIEWS_AND_CORE_DATA_AUDIT.md                                                                                                                            |           |        |


---

## Next step

Once you’ve marked **Add back** or **Leave** for each row (e.g. by editing this file or replying with your choices), we can:

1. Create branch at 7fec709.
2. Cherry-pick or re-apply only the “Add back” commits in dependency-safe order.
3. Resolve any conflicts and run tests.

Reply with your decisions (e.g. “Add back: 1–5, 37, 38. Leave the rest”) or edit this checklist and say when you’re ready.