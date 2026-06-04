# Performance — LazyBlockWrapper & bundle analysis (June 2026)

**Date:** 4 June 2026  
**Scope:** `BlockRenderer`, `LazyBlockWrapper`, `next/dynamic` splits, `build:analyze`

---

## Executive summary

Marketing Hub uses a **two-layer** load strategy for heavy blocks:

1. **`next/dynamic`** — code-splits block chunks out of the initial client bundle.
2. **`LazyBlockWrapper`** — delays *mounting* until the block nears the viewport (IntersectionObserver, 100px root margin).

Full-page interface blocks (`isFullPage`) now **skip** viewport deferral so dedicated pages (Event Calendar, Things To Do, etc.) mount immediately while still benefiting from dynamic imports.

---

## Bundle analysis (`build:analyze`)

**Command (local):**

```powershell
cd baserow-app
$env:ANALYZE='true'
node .\node_modules\next\dist\bin\next build
```

**Note:** `npm run build:analyze` runs `prebuild` → `predeploy-check` (tsx); that failed in this environment due to a broken global `tsx` path. Direct `next build` with `ANALYZE=true` succeeded for webpack analysis.

**Reports written:**

| Report | Path |
|--------|------|
| Client bundles | `baserow-app/.next/analyze/client.html` |
| Node/server | `baserow-app/.next/analyze/nodejs.html` |
| Edge | `baserow-app/.next/analyze/edge.html` |

Open `client.html` in a browser to inspect chunk sizes. Expect separate async chunks for dynamically imported blocks (e.g. `InternalResourceHubBlock`, `EventCalendarBlock`, `GridBlock`, FullCalendar-related calendar code).

**Build status:** Webpack compile succeeded; typecheck failed on unrelated `DetailPanel.tsx` (`resource` possibly null) — fixed in this pass (`resource?.id` dependency).

---

## LazyBlockWrapper audit matrix

| Block type | `next/dynamic` | `LazyBlockWrapper` | Notes |
|------------|----------------|------------------|-------|
| **grid** | Yes | `enabled={deferBlockMount}` | Full-page grids mount immediately |
| **list** (as grid) | Yes | `enabled={false}` | Mount stability (React #185 guard) |
| **record** | Yes | `enabled={false}` | Mount stability |
| **text** | No (static) | `enabled={false}` | Light; immediate mount |
| **calendar** | Yes | `enabled={false}` | FullCalendar hydration guard |
| **chart, kanban, timeline, gallery, multi_*** | Yes | `deferBlockMount` | Data views |
| **kpi** | Yes | `deferBlockMount` | Added wrapper in perf pass |
| **kpi_summary, content_theme, upcoming_summary** | Yes | `deferBlockMount` | Marketing dashboard tiles |
| **things_to_do, content_timeline, event_calendar, social_media_calendar, campaigns_overview, internal_resource_hub, members_welcome** | Yes | `deferBlockMount` | Marketing blocks |
| **form** | Yes | None | Single form; dynamic split only |
| **filter, field, html, image, …** | No / light | None | Small static components |

`deferBlockMount = !isFullPage` (set in `renderBlock()`).

### Rationale for `enabled={false}` (unchanged)

- **Text / record / calendar / list:** Documented guards against mount loops and hydration issues; lazy deferral would add flicker or empty first paint on primary surfaces.

### Double deferral (intentional)

Dashboard Marketing Home loads many blocks. Dynamic import shrinks the initial JS parse; LazyBlockWrapper avoids running hooks/fetch for below-fold tiles until scroll. First scroll into a tile may show a brief loading placeholder from `dynamic()` — acceptable trade-off.

---

## Recommendations (future, not implemented)

| Priority | Item |
|----------|------|
| P3 | Prefetch dynamic chunks on sidebar hover for target pages |
| P3 | Shared `BlockLoadingPlaceholder` height per block type to reduce layout shift |
| P3 | `optimizePackageImports` audit for `lucide-react`, `date-fns` in marketing blocks |
| P3 | Run `build:analyze` in CI on release branches; track client chunk regression |

---

## Verification

- Static: `baserow-app/__tests__/performance-lazy-block-audit.test.ts`
- Stabilisation: `stabilisation-p0-p1-2026-06.test.ts` (dynamic imports)

Manual: Marketing Home — scroll KPI/timeline tiles; open Event Calendar full page — calendar should render without waiting for intersection.
