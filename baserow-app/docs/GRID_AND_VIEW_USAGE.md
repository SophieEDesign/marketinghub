# Grid and view usage guide

Use this to choose the right grid or view component and avoid wrong imports or duplicate behavior.

## Core Data table view page (`/tables/[tableId]/views/[viewId]`)

- **Grid view type** → [AirtableViewPage](components/grid/AirtableViewPage.tsx), which renders [AirtableGridView](components/grid/AirtableGridView.tsx). Use this path for the Core Data “spreadsheet” experience (view fields, filters, sorts from the view).
- **Other view types** (kanban, calendar, list, gallery, timeline, form, horizontal_grouped) → [NonGridViewWrapper](components/grid/NonGridViewWrapper.tsx), which delegates to the matching view in `components/views/` (e.g. KanbanView, CalendarView, ListView).

## Interface builder (canvas / block-based pages)

- **Grid block** → [GridBlock](components/interface/blocks/GridBlock.tsx) → [GridViewWrapper](components/grid/GridViewWrapper.tsx) → [grid/GridView.tsx](components/grid/GridView.tsx). This is the full-featured grid (inline edit, grouping, filters, etc.) used inside interface pages.

## Do not use

- **components/views/GridView.tsx** – Deprecated and not imported anywhere. It was a simpler paginated grid; Core Data uses AirtableGridView, and the interface uses `components/grid/GridView.tsx`. See the `@deprecated` JSDoc on that file.

## Summary

| Context | Component to use |
|--------|-------------------|
| Core Data, grid view | AirtableViewPage → AirtableGridView |
| Core Data, other views | NonGridViewWrapper → KanbanView / CalendarView / ListView / etc. |
| Interface builder, grid block | GridBlock → GridViewWrapper → grid/GridView.tsx |
| Any new grid UI | Prefer reusing one of the above; do not use `components/views/GridView.tsx`. |
