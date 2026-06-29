# Social Calendar + Board views — drop-in for the Content Timeline

Adds two views to the existing **Content Timeline** block: a **Calendar** (month grid of
post cards) and a **Board** (kanban by status). Both reuse the existing model
(`ContentTimelineItem`), helpers (`getContentTimelineStatusClasses`, `getStatusLabel`,
`getChannelLabel`), the `ContentTimelineChannelIcon`, and the existing `ContentTimelineDetailPanel`
via the same `onSelect(id)` flow. No data-layer or schema changes.

## New files (copy into the repo)
| This package | Copy to |
|---|---|
| `components/interface/content-timeline/ContentTimelineCalendar.tsx` | same path |
| `components/interface/content-timeline/ContentTimelineBoard.tsx` | same path |

## Edits to existing files (4 small changes)

### 1. `lib/marketing/content-timeline.ts` — extend the view union
```diff
- export type ContentTimelineView = "month" | "quarter" | "year"
+ export type ContentTimelineView = "calendar" | "board" | "month" | "quarter" | "year"
```
(`month/quarter/year` stay = the Gantt; `calendar` + `board` = the new views.)

### 2. `components/interface/content-timeline/ContentTimelineHeader.tsx` — offer the new views
```diff
  const VIEW_OPTIONS: { value: ContentTimelineView; label: string }[] = [
+   { value: "calendar", label: "Calendar" },
+   { value: "board", label: "Board" },
    { value: "month", label: "Month" },
    { value: "quarter", label: "Quarter" },
    { value: "year", label: "Year" },
  ]
```
The prev/next period buttons already exist — they only make sense for calendar/month/quarter/
year. Optionally hide them when `view === "board"`:
```tsx
{view !== "board" && ( /* …prev / periodLabel / next… */ )}
```

### 3. `components/interface/blocks/ContentTimelineBlock.tsx` — render the new views
Add the imports:
```tsx
import { ContentTimelineCalendar } from "@/components/interface/content-timeline/ContentTimelineCalendar"
import { ContentTimelineBoard } from "@/components/interface/content-timeline/ContentTimelineBoard"
```
Replace the single `<ContentTimelineGrid … />` render with a branch (keep the existing
empty-state check around it):
```tsx
{view === "calendar" ? (
  <ContentTimelineCalendar
    items={visibleItems}
    anchorDate={anchorDate}
    selectedId={selectedId}
    onSelect={handleSelectItem}
    onAddOnDate={canAddContent ? (iso) => handleAddContentOnDate(iso) : undefined}
  />
) : view === "board" ? (
  <ContentTimelineBoard
    items={visibleItems}
    selectedId={selectedId}
    onSelect={handleSelectItem}
  />
) : (
  <ContentTimelineGrid
    items={visibleItems}
    view={view}
    anchorDate={anchorDate}
    groupBy={groupBy}
    selectedId={selectedId}
    compact={compact}
    showStatusBadges={showStatusBadges}
    showOwnerInitials={showOwnerInitials}
    onSelect={handleSelectItem}
  />
)}
```
`handleAddContentOnDate` is optional — wire it to your existing "add content" flow
(RecordModal / RecordEditor) pre-filled with the chosen date, or omit `onAddOnDate` to drop
the per-day "+" affordance.

### 4. (Optional) default view
If you want the block to open on the calendar:
```tsx
const defaultView = (config?.content_timeline_default_view || "calendar") as ContentTimelineView
```

## Notes
- **Placement uses `publishDate ?? startDate`.** Both new views key off the publish date so a
  post lands on the day it goes live; falls back to `startDate`.
- **No image field today.** The Content model has no asset/thumbnail field, so cards are
  channel-icon + title + status (clean and faithful). If you add an asset/cover field to the
  Content table later, drop an `<img>` (or `next/image`) at the top of `PostCard`
  (Calendar) and the board card — both are isolated, single-component edits.
- **Brand channel colours** come from the existing `ContentTimelineChannelIcon`
  (LinkedIn #0A66C2, Instagram pink, Facebook #1877F2, …) so posts stay recognisable.
- **Status colours** come from the existing `getContentTimelineStatusClasses` — change them
  there once and all three views update.
- Palette accents added here: today pill + selected ring use navy `#005b8f`. Everything else
  uses your existing tokens (`border-border`, `text-muted-foreground`, `bg-muted/30`).

## Reference
Visual/interaction reference: `Social Media Calendar.dc.html` (calendar grid + kanban board +
detail slide-over). Look-and-feel only — the drop-ins above adapt it to your React + Tailwind
+ existing helpers.
