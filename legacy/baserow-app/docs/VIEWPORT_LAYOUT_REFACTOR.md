# Airtable-Style Viewport Layout Refactor

## Summary

This document explains the viewport layout architecture and which components use `min-h-0` or `min-w-0` to ensure views fit the viewport and scroll correctly.

---

## 1. Root Layout (Viewport Lock)

**File:** `components/layout/WorkspaceShell.tsx`

```
<div className="flex flex-col h-screen min-h-[100dvh] bg-gray-50 overflow-hidden">
  <EditModeBanner />
  <EditModeGuard />
  <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
    <AirtableSidebar />
    <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
      <Topbar />
      <main className="flex-1 min-h-0 min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  </div>
</div>
```

- **h-screen** + **overflow-hidden** at root: locks the app to the viewport and prevents page scrolling
- **min-h-0** on flex children: allows flex items to shrink below their content size so height propagates down
- **min-w-0** on flex children: prevents horizontal overflow from flex items

---

## 2. Page Layout (Single Scroll Area)

### NonGridViewWrapper (Calendar, Kanban, Timeline, Gallery, Form)

**File:** `components/grid/NonGridViewWrapper.tsx`

```
<div className="flex flex-col h-full min-h-0 flex-1 bg-gray-50">
  <div className="shrink-0">
    <ViewTopBar />
  </div>
  <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
    <CalendarView | KanbanView | TimelineView | ... />
  </div>
</div>
```

- **shrink-0** on toolbar: keeps toolbar fixed at top
- **flex-1 min-h-0 overflow-hidden** on view area: constrains the view; the view manages its own internal scroll

### AirtableViewPage (Grid, Kanban)

**File:** `components/grid/AirtableViewPage.tsx`

```
<div className="flex flex-col h-full min-h-0 overflow-hidden bg-gray-50">
  <div className="shrink-0">
    <ViewBuilderToolbar />
  </div>
  <div className="flex-1 min-h-0 min-w-0 overflow-hidden relative">
    <AirtableGridView | AirtableKanbanView />
  </div>
</div>
```

---

## 3. View Wrappers

### CalendarView

**File:** `components/views/CalendarView.tsx`

```
<div className="w-full h-full min-w-0 min-h-0 flex flex-col overflow-hidden bg-white">
  <div className="flex-1 min-h-0 min-w-0 overflow-auto">
    <FullCalendar height="100%" />
  </div>
</div>
```

- **Outer:** `overflow-hidden` constrains the view
- **Inner:** `overflow-auto` is the single scroll container for the calendar

### KanbanView / AirtableKanbanView

```
<div className="w-full h-full min-w-0 min-h-0 flex flex-col overflow-hidden">
  <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
    <div className="flex gap-4 min-w-max p-4">
      {columns.map(col => (
        <div className="w-[280px] flex-shrink-0 flex flex-col">
          <ColumnHeader />
          <div className="flex-1 min-h-0 overflow-y-auto">
            <ColumnCards />
          </div>
        </div>
      ))}
    </div>
  </div>
</div>
```

- **Horizontal scroll:** `overflow-x-auto overflow-y-hidden` for columns
- **Per-column vertical scroll:** `overflow-y-auto` when many cards

### TimelineView

**File:** `components/views/TimelineView.tsx`

```
<div className="flex flex-col h-full min-h-0 overflow-hidden bg-white">
  <div className="shrink-0">Toolbar</div>
  <div className="flex-1 min-h-0 overflow-auto">
    <TimelineContent />
  </div>
</div>
```

### AirtableGridView

**File:** `components/grid/AirtableGridView.tsx`

```
<div className="flex flex-col h-full min-h-0 overflow-hidden">
  <div className="flex-shrink-0">Header</div>
  <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto">
    <TableBody />
  </div>
</div>
```

---

## 4. min-h-0 / min-w-0 Usage

| Container | min-h-0 | min-w-0 | Why |
|-----------|---------|---------|-----|
| Root flex row (Sidebar + MainArea) | Yes | Yes | Allows row to shrink; prevents horizontal overflow |
| InterfaceContainer | Yes | Yes | Height flows to main; prevents overflow |
| main | Yes | Yes | Children receive constrained height |
| Page wrappers (NonGridViewWrapper, AirtableViewPage) | Yes | Yes | Fill parent; pass constraints to views |
| View area (flex-1 div) | Yes | Yes | Constrains the view |
| View roots (Calendar, Kanban, Timeline, Grid) | Yes | Yes | Respect parent constraints |
| Scroll containers (flex-1 overflow-auto) | Yes | Yes | Allows shrinking so overflow-auto can scroll |
| AirtableGridView root | Yes | — | Body scroll works |
| AirtableGridView body | Yes | — | Body scroll works |
| KanbanColumn cards area | Yes | — | Column scroll works |

---

## 5. Card Content Discipline

### Kanban cards

- **Card container:** `max-w-[240px] overflow-hidden`
- **Title:** `truncate font-medium text-xs`
- **Description:** `line-clamp-2 text-xs text-gray-600`
- **Other fields:** `truncate text-xs text-gray-600`

---

## 6. Expected Result

- Sidebar fixed
- Toolbar fixed
- Views fill remaining viewport height
- Kanban columns scroll horizontally
- Calendar expands fully
- Timeline scrolls vertically
- Page never scrolls
- No content clipping
- Single scroll container per view (outer overflow-hidden, inner overflow-auto)
