# Calendar Block Full-Page Layout Audit

**Date:** 2025-02-23  
**Scope:** Calendar block in full-page mode; week view layouts (4, 6, 8 weeks)

## Executive Summary

The calendar block full-page layout has several issues affecting week alignment, row heights, and viewport usage. Key fixes: add `dateAlignment: 'week'` to custom views, enable `expandRows` for consistent row heights, and ensure full-page height flows correctly.

---

## 1. Week Alignment (Custom Duration Views)

### Issue
Custom views (`dayGridWeek4`, `dayGridWeek6`, `dayGridWeek8`) use `duration: { weeks: N }` but lack explicit `dateAlignment`. FullCalendar may generate a "reasonable default" that doesn't align to week boundaries, especially when crossing month boundaries.

### Impact
- Weeks may not start on Monday (firstDay: 1)
- Cross-month weeks (e.g. Feb 23–Mar 1) can render with inconsistent alignment
- Navigation (prev/next) may jump to non-week boundaries

### Fix
Add `dateAlignment: 'week'` to each custom view config so the view always begins at the start of a week.

```ts
dayGridWeek4: {
  type: "dayGrid",
  duration: { weeks: 4 },
  dateAlignment: "week",  // ADD
  buttonText: "4 weeks",
},
```

---

## 2. Row Heights (Inconsistent Across Weeks)

### Issue
Day cells use `min-h-[3.5rem]` via `dayCellClassNames`, but FullCalendar's default behavior can produce uneven row heights when:
- Some weeks have more events than others
- The calendar height is driven by `aspectRatio` rather than filling the container
- Rows don't expand to fill available space

### Impact
- Some week rows appear taller/shorter than others
- Visual inconsistency across the 4/6/8 week grid
- Empty space at bottom when calendar is shorter than container

### Fix
Add `expandRows: true` so rows expand to fill the calendar's content area, giving consistent row heights.

---

## 3. Full-Page Height / Viewport

### Issue
- Calendar uses `height="auto"` and `aspectRatio={1.4}` — height is derived from width
- Content div has `min-h-[100vh]` for calendar — forces minimum viewport height
- For full-page, the calendar may not optimally fill the viewport; aspect ratio can leave excess whitespace or require excessive scrolling

### Current Flow
```
Canvas (min-h-[100vh])
  → BlockAppearanceWrapper (h-full min-h-0 flex flex-col)
    → GridBlock (h-full flex flex-col)
      → Header bar (flex-shrink-0)
      → Content div (flex-1 min-h-0 min-h-[100vh])
        → CalendarView (h-full flex flex-col)
          → Scroll container (flex-1 min-h-0 overflow-auto)
            → FullCalendar (height="auto" aspectRatio=1.4)
```

### Recommendation
- Keep current structure; `expandRows: true` helps rows fill space
- Consider passing `isFullPage` to CalendarView and using `contentHeight: 'auto'` with `expandRows` when full-page for better viewport usage
- The `min-h-[100vh]` ensures the calendar area is at least viewport height; scroll handles overflow

---

## 4. firstDay (Week Start)

### Status
`firstDay={1}` (Monday) is set at the top level and applies to all views. No change needed.

---

## 5. Cross-Month Spillover Weeks

### Status
FullCalendar's dayGrid with `duration: { weeks: N }` and `dateAlignment: 'week'` will correctly show weeks that span month boundaries (e.g. Mon 24 Feb – Sun 2 Mar). No filtering; full context is maintained.

---

## 6. Scroll Container

### Status
- Single scroll container with `overflow-auto` (horizontal + vertical)
- `min-w-0` on CalendarView and scroll container prevents flex overflow
- Anchor scrolling targets the scroll container, not window

---

## Implementation Checklist

- [x] Add `dateAlignment: 'week'` to dayGridWeek4, dayGridWeek6, dayGridWeek8
- [x] Add `expandRows: true` to FullCalendar
- [ ] (Optional) Pass `isFullPage` to CalendarView for future height tuning
- [ ] Verify in browser: week alignment, row heights, full-page layout

## Changes Applied (2025-02-23)

1. **dateAlignment: 'week'** — Added to all three custom views so each 4/6/8-week view begins on a Monday (firstDay: 1). Fixes cross-month week alignment.
2. **expandRows: true** — Rows now expand to fill the calendar content area, giving consistent row heights across all weeks.
