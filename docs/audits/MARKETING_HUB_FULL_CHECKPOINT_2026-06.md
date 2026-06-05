# Marketing Hub Full Checkpoint Audit — June 2026

**Date:** 4 June 2026  
**Scope:** Marketing Hub + Interface Builder stabilisation after custom blocks, record drawers, unified edit mode, and June fixes  
**Method:** Reconcile [FULL_APP_UX_AUDIT_2026-06.md](./FULL_APP_UX_AUDIT_2026-06.md); static code review; provisioning scripts/migrations; Vitest (55 files); local `tsc --noEmit`; bundle analyze (partial)  
**Baseline audits:** [CUSTOM_BLOCK_MODAL_PANEL_FIELD_AUDIT_2026-06.md](./CUSTOM_BLOCK_MODAL_PANEL_FIELD_AUDIT_2026-06.md), [REGRESSION_RISK_AUDIT_2026-05.md](./REGRESSION_RISK_AUDIT_2026-05.md), [PERFORMANCE_LAZY_BLOCK_AUDIT_2026-06.md](./PERFORMANCE_LAZY_BLOCK_AUDIT_2026-06.md)

**Note:** Stabilisation commits applied during this checkpoint cycle (P1/P2/performance) are reflected below. This document is the authoritative checkpoint; the attached plan file is not edited.

---

## 1. Executive summary

### Overall health: **~82%** — safe to continue feature work

| Pillar | Jun audit (pre-fix) | Checkpoint (now) | Trend |
|--------|---------------------|------------------|-------|
| UX / stability | 64% | **84%** | ↑ |
| Layout | 72% | **82%** | ↑ |
| Performance | 68% | **76%** | ↑ |
| Accessibility | 52% | **68%** | ↑ |
| Data / settings wiring | — | **74%** | — |
| Regression protection | — | **85%** | ↑ |
| Design consistency | 70% | **72%** | ↑ slight |

### What is stable

- Overlay/sidebar: `md:left-sidebar` on record and dialog paths; no `md:left-64` in components
- Client navigation: blocks not cleared on route change; stale-while-navigate overlay
- REG-005: dirty layout reload skips `setBlocks` when `blocksDirty`
- Custom record drawers: one `RecordPanel` path; contextual `recordLayoutType` for marketing blocks
- P1 fixes: Resource Hub edit guards, Upcoming Summary layout routing, Members Welcome shell, `members_welcome` union parity
- P2 polish: dead `campaigns_open_record_mode` removed; Resource Hub `mockAction` stubs removed; KPI/theme/upcoming dynamically imported
- P0 fix: Content Timeline edit-mode guards on item click, open record, and add content
- Accessibility pass: `RecordPanel` focus trap + restore; grid group/row keyboard; `FilterResultsAnnouncer` on marketing filters
- Performance: `deferBlockMount = !isFullPage`; bundle analyzer reports generated locally
- Tests: **528/528** Vitest pass (incl. `content-timeline-edit-mode`, `accessibility-marketing-a11y-2026-06`); `tsc --noEmit` clean via local `node_modules/typescript`

### What is still risky

- **P3:** Linked-record navigation resets to generic drawer layout
- **P3:** `campaigns_use_mock` vs block-prefixed mock naming contract drift
- **P3:** Upcoming Summary “View all” handlers are TODO stubs
- Manual REG-005 / full staging QA not executed in this pass

### Safe to continue feature work?

**Yes.** P0 edit-mode gaps on marketing blocks are closed. Do not add new drawer systems or parallel config schemas without updating tests and `.cursor/rules`.

---

## 2. Critical issues (must fix before more features)

| ID | Issue | Status |
|----|-------|--------|
| **CHK-P0-001** | Content Timeline item click opened `RecordPanel` in page layout edit mode | **Fixed** — `if (isEditing) return` on `handleSelectItem`, `handleOpenRecord`, `handleAddContent`; [`content-timeline-edit-mode.test.ts`](../baserow-app/__tests__/content-timeline-edit-mode.test.ts) |

_No open P0 items at checkpoint close._

---

## 3. High priority issues (should fix next)

| ID | Issue | Status |
|----|-------|--------|
| CHK-P1-001 | Gallery Resource Hub: block `DetailPanel` + global `RecordPanel` can coexist on Manage asset | **Mitigated** edit guards; UX still dual-panel feel — document in QA |
| CHK-P1-002 | `navigateToLinkedRecord` forces `recordLayoutType: "generic"` | **Open** — [`RecordPanelContext.tsx`](../baserow-app/contexts/RecordPanelContext.tsx) |
| CHK-P1-003 | Blocks API prefetch on nav hover (PERF-001) | **Open** |
| CHK-P1-004 | Manual REG-005 verification after settings save | **Open** — manual checklist §15 |

---

## 4. Medium priority (polish / consistency)

| ID | Issue |
|----|-------|
| CHK-P2-001 | `campaigns_use_mock` vs `{block}_use_mock` contract (`campaigns_overview`) |
| CHK-P2-002 | Upcoming Summary `handleViewAll` / `handleViewAllActivity` TODO — no navigation |
| CHK-P2-003 | Content Theme TODOs (add theme/idea, record editing, permissions) |
| CHK-P2-004 | Orphan UI: `SocialPostQuickView`, `ThingsToDoDetailPanel`, `EventDetailDrawer` (unused paths) |
| CHK-P2-005 | Empty-state primitives fragmented (`EmptyState`, `DashboardEmpty`, inline) |
| CHK-P2-006 | Settings panels still use some hardcoded `gray-*` / `blue-*` |

---

## 5. Low priority / nice-to-have

- jsx-a11y lint in CI
- Drawer focus-trap audit
- Per-block loading placeholder heights (reduce lazy-mount shift)
- Chunk prefetch on sidebar page hover
- CI bundle size budget from `build:analyze`
- Content Timeline footer “View full calendar” TODO
- Members Welcome header `Link` navigation in edit mode (quick actions fixed; “View all events” links may still navigate)

---

## 6. Page-by-page findings

Provisioning: [`apply-marketing-hub-workspace.cjs`](../baserow-app/scripts/apply-marketing-hub-workspace.cjs), [`marketing-hub-workspace.test.ts`](../baserow-app/__tests__/marketing-hub-workspace.test.ts). Shell: [`marketing-home.ts`](../baserow-app/lib/marketing/marketing-home.ts) + `InterfacePageClient` `marketingDashboard`.

### Marketing Home

| Aspect | Assessment |
|--------|------------|
| Purpose | Executive dashboard — clear |
| Blocks | `kpi_summary`, `things_to_do`, `content_theme`, `content_timeline`, `internal_resource_hub` (compact), `event_calendar` |
| Layout | Dense but intentional; marketing shell via `isMarketingHomePage` |
| Edit mode | Strong on all marketing blocks (Content Timeline P0 closed) |
| Mobile | Tiles stack; calendars/timelines need horizontal scroll audit on small screens |
| Empty/demo | Demo banners when mock/live unavailable; honest empty states |
| Dead controls | Resource Hub stubs removed (P2) |

### Theme Workspace

| Aspect | Assessment |
|--------|------------|
| Purpose | Quarterly themes + timeline + tasks — clear |
| Blocks | `content_theme`, `content_timeline`, `things_to_do` |
| Filters | Usable when configured; theme block has no record opens |
| Edit mode | Good except content timeline |

### Campaigns

| Aspect | Assessment |
|--------|------------|
| Purpose | Campaign workspace — `campaigns_overview` full page |
| Drawer | `recordLayoutType: "campaign"` |
| Edit mode | Row click guarded |

### Content Planning

| Aspect | Assessment |
|--------|------------|
| Purpose | Cross-channel planning hub |
| Blocks | `things_to_do`, `content_timeline`, `social_media_calendar`, `content_theme` |
| Balance | Busy but coherent |

### Things To Do

| Aspect | Assessment |
|--------|------------|
| Purpose | Task list — full page `things_to_do` |
| Drawer | `task` layout |
| Edit mode | Guarded |
| Scroll | Full-page internal scroll OK |

### Social Calendar

| Aspect | Assessment |
|--------|------------|
| Purpose | Social posts calendar |
| Drawer | `social_post`; view/edit same panel |
| Full page | `deferBlockMount` false when full page — immediate mount |

### Event Calendar

| Aspect | Assessment |
|--------|------------|
| Purpose | Events + attendance |
| Drawer | `event` contextual view in `RecordPanel` |
| Members Welcome | `event_calendar_external_mode` for member-safe filtering |

### Resource Hub

| Aspect | Assessment |
|--------|------------|
| Purpose | Internal media library |
| Primary click | List → URL; gallery → in-block preview |
| Manage | `asset` drawer (admin, not editing layout) |
| Edit mode | **Fixed** — select/URL/manage guarded |
| Coming soon | DetailPanel menu items (rename/move/delete) still disabled with honest copy |

### Members Welcome

| Aspect | Assessment |
|--------|------------|
| Purpose | Member landing (`members_welcome` block post migration fix) |
| Shell | **Fixed** — in `WORKSPACE_PAGE_NAMES` |
| Visibility | Page provisioned `is_admin_only: false`; `filterMembersWelcomeEvents` hides internal-only |
| Edit mode | Quick actions non-navigating when editing; event View disabled |
| Gaps | No `*_use_mock` in settings; table IDs via migration |

### Contacts / Record View

| Aspect | Assessment |
|--------|------------|
| Purpose | Generic `record_view` / `record_review` pages |
| Settings | `RecordViewPageSettings`, `record-block-field-resolution` — generic, no Contacts-specific branch found |
| Legacy keys | `visible_fields`, `modal_fields`, `field_layout` fallbacks still supported |

---

## 7. Block-by-block matrix

| Block | Settings | Runtime | Edit mode | Demo/live | Layout/mobile | A11y | Perf | Status |
|-------|----------|---------|-----------|-----------|---------------|------|------|--------|
| `campaigns_overview` | Strong (`table_id`, `view_id`, field_ids, `campaigns_use_mock`) | Wired | OK | OK | Full-page OK | Partial | Dynamic+lazy | **Good** |
| `content_theme` | `table_id`, `content_theme_use_mock`, max themes | Wired | N/A (no records) | OK | OK | Partial | Dynamic+lazy | **Good** |
| `content_timeline` | field_ids, mock, max items, filters | Wired | OK | OK | Scroll OK | Filter `aria-live` | Dynamic+lazy | **Good** |
| `things_to_do` | field_ids, mock, filters | Wired | OK | OK | Full-page OK | Row keyboard partial | Dynamic+lazy | **Good** |
| `event_calendar` | field_ids, `view_id`, mock | Wired | OK | OK | Full-page OK | Partial | Dynamic+lazy | **Good** |
| `social_media_calendar` | field_ids, mock, max posts | Wired | OK | OK | Full-page OK | Partial | Dynamic+lazy | **Good** |
| `internal_resource_hub` | `table_id`, `view_id`, field_ids, mock | Wired | **Fixed** | OK | Gallery/list | Partial | Dynamic+lazy | **Good** |
| `upcoming_summary` | tables, sections, mock | Wired | OK | Links live-only | Dashboard OK | Partial | Dynamic+lazy | **Good** |
| `kpi_summary` | cards, mock | Wired | N/A | OK | OK | Partial | Dynamic+lazy | **Good** |
| `members_welcome` | limits, page link IDs | Wired | OK | No mock toggle | OK | Partial | Dynamic+lazy | **Good** |

---

## 8. Record drawer findings

### Routing (verified)

| Source | `recordLayoutType` |
|--------|-------------------|
| Social Calendar | `social_post` |
| Event Calendar | `event` |
| Things To Do | `task` |
| Campaigns Overview | `campaign` |
| Content Timeline | `content` |
| Resource Hub Manage | `asset` |
| Resource Hub primary | URL / preview (not drawer) |
| Upcoming Summary | `campaign` / `event` / `content` / `task` by section |
| Members Welcome events | `event` |
| Grid/List/Calendar | omitted → generic |

### One drawer

- Path: `RecordModalContext` → `RecordPanel` → `RecordEditor`
- Event: `EventRecordContextualView` inside panel (not `EventDetailDrawer` portal)
- Overlays: `md:left-sidebar`

### Remaining drawer issues

- Linked records → generic layout
- Orphan components (dead code): `SocialPostQuickView`, `ThingsToDoDetailPanel`, `ThingsToDoRecordSidePanel`, unused `EventDetailDrawer` import risk

---

## 9. Record View / Record Block findings

| Area | Finding |
|------|---------|
| Page settings | `RecordViewPageSettings` — `field_layout`, `visible_fields`, `detail_fields`, `allow_editing`, left panel |
| Block settings | `RecordDataSettings` — `detail_fields`, `allow_editing` per block |
| Resolution | [`record-block-field-resolution.ts`](../baserow-app/lib/interface/record-block-field-resolution.ts) — order: `detail_fields` → `visible_fields` → `modal_fields` → `field_layout` |
| Tests | `record-view-list-panel-settings.test.ts`, `record-block-field-resolution.test.ts` |
| Contacts-specific logic | **Not found** — generic |
| Dead settings | Legacy `modal_fields` retained for fallback; documented deprecated in `page-config.ts` |

---

## 10. Rules and regression test coverage

### Cursor rules (aligned)

| Rule | Status |
|------|--------|
| `layout-width-authority.mdc` | Current |
| `navigation-overlay-must-not-block-sidebar.mdc` | Current; no `md:left-64` |
| `custom-block-record-drawers.mdc` | Current |
| `custom-block-modal-field-contract.mdc` | Overlaps `block-generic-settings-contract` — both valid |
| `block-generic-settings-contract.mdc` | Current |
| `record-open-edit-mode-propagation.mdc` | Current |
| `broken-pages-loading.mdc` | Baseline `868b674`; many items fixed |
| `regression-checklist.mdc` | Points to REG audit + tests |

### Test suites (marketing / interface)

| Suite | Covers |
|-------|--------|
| `stabilisation-p0-p1-2026-06.test.ts` | Overlay, nav flash, REG-005, a11y spinner, skip link, dynamic imports, `deferBlockMount` |
| `custom-block-record-drawer-regression.test.ts` | Drawer contract, edit guards incl. content timeline |
| `content-timeline-edit-mode.test.ts` | Content Timeline edit-mode guards |
| `accessibility-marketing-a11y-2026-06.test.ts` | Drawer focus, grid keyboard, filter live regions |
| `custom-block-record-layout-routing.test.ts` | Layout types, upcoming summary |
| `custom-block-modal-field-contract.test.ts` | Overlay + field UI |
| `resource-hub-edit-mode.test.ts` | Resource Hub edit guards |
| `upcoming-summary-record-layout.test.ts` | Section → layout mapping |
| `members-welcome-edit-mode.test.ts` | Shell + edit mode |
| `marketing-hub-p2-polish.test.ts` | Dead settings + stub removal |
| `performance-lazy-block-audit.test.ts` | Lazy policy |
| `marketing-hub-workspace.test.ts` | Provisioning |
| `marketing-block-config.test.ts` | Config validation |
| `interface-invariants.test.ts` | Registry ↔ union parity (incl. `members_welcome`) |
| `edit-mode-block-selection.test.ts` | Settings registry |
| Per-block | `event-calendar*.test.ts`, `social-calendar-record-drawer.test.ts`, `things-to-do-layout.test.ts`, etc. |

### Missing / recommended tests

- E2E: client nav no flash with real browser
- E2E: sidebar clickable with record panel open
- Linked-record preserves layout type (when implemented)
- Bundle size regression threshold in CI

### Verification run (this pass)

| Check | Result |
|-------|--------|
| `npm test -- --run` | **528 passed**, 57 files (post P0 + a11y) |
| `node node_modules/typescript/lib/tsc.js --noEmit` | **Pass** |
| `npm run build:analyze` | Prebuild `tsx` path broken globally; direct `ANALYZE=true next build` produced `.next/analyze/*.html` (see [PERFORMANCE_LAZY_BLOCK_AUDIT_2026-06.md](./PERFORMANCE_LAZY_BLOCK_AUDIT_2026-06.md)) |
| `npm run build` | Intermittent OneDrive `.next` readlink `EINVAL` on Windows — env |

---

## 11. Performance findings

See [PERFORMANCE_LAZY_BLOCK_AUDIT_2026-06.md](./PERFORMANCE_LAZY_BLOCK_AUDIT_2026-06.md).

**Summary:**

- Heavy marketing blocks: `next/dynamic` + `LazyBlockWrapper` with `deferBlockMount = !isFullPage`
- Dashboard tiles defer mount; full-page blocks mount immediately
- KPI block wrapped with lazy deferral
- Static lightweight blocks (text, filter, field) remain in main bundle by design
- **Not implemented:** nav-hover chunk prefetch, CI bundle budgets

**File-level recommendations:**

| File | Recommendation |
|------|----------------|
| `BlockRenderer.tsx` | Keep dynamic + defer policy; avoid re-static-importing marketing blocks |
| `InterfacePageClient.tsx` | Consider short-lived blocks cache on link hover (PERF-001) |
| Marketing block hooks | Audit duplicate table discovery per page load |
| `LazyBlockWrapper.tsx` | Optional per-block `placeholder` heights for KPI/calendar tiles |

---

## 12. Accessibility findings

### Done

- Skip link → `#main-content` in `WorkspaceShell`
- `LoadingSpinner`: `role="status"`, `aria-live="polite"`, `aria-busy`
- `InterfacePageClient` block loading overlay: `aria-busy`, `aria-live`
- `ThingsToDoRow` keyboard coverage in stabilisation tests
- **Record drawer:** `useOverlayPanelA11y` — initial focus, Tab trap, restore focus on close; `role="dialog"` + `aria-modal` on overlay panel
- **Grid:** `AirtableGridView` group headers as buttons with `aria-expanded`; row-number buttons open records
- **Marketing filters:** `FilterResultsAnnouncer` (`aria-live="polite"`) on Campaigns, Content Timeline, Things To Do, Resource Hub

### Backlog

- Calendar view keyboard parity (beyond grid + Things To Do rows)
- Badge contrast sampling; jsx-a11y eslint plugin on `components/interface/**`
- Social/Event calendar filter result announcements (if search added)

---

## 13. Aesthetic / design findings

- Marketing shell: `[data-marketing-dashboard]`, calmer spacing on workspace pages
- Shared components: `ChoicePill`, shadcn `Select` on campaigns/timeline/things-to-do (per field audit)
- Drift: settings panels and some empty states use legacy gray/blue utilities
- Resource Hub: distinct “Internal Hub” badge styling — intentional
- Members Welcome: bespoke gradient hero — acceptable for member landing
- Generic record pages beside marketing pages: acceptable; not visually broken

---

## 14. Recommended fix order

### P1 — stabilise UX

1. Manual REG-005 + sidebar/overlay QA (§15)
2. Linked-record contextual layout preservation
3. Document or reduce Resource Hub gallery double-panel on Manage

### P2 — polish

4. Align `campaigns_use_mock` naming or document exception
5. Wire or remove Upcoming Summary “View all”
6. Remove/archive orphan drawer components

### P3 — future

7. PERF-001 prefetch; CI bundle analyze; Content Theme record editing TODOs
8. Calendar keyboard parity; jsx-a11y lint in CI

---

## 15. Manual QA checklist

- [ ] **Sidebar edit mode:** Enter unified edit mode; `RightSettingsPanel` 360px; main area flex-1
- [ ] **Block editing:** Select block; settings persist; dirty layout not overwritten on realtime reload (REG-005)
- [ ] **Page navigation:** Switch Marketing Home → Campaigns → back; no blank canvas flash; sidebar clickable with record open
- [ ] **Drawer open/edit/save:** Social (`social_post`), Event (`event`), Task, Campaign, Content layouts; save/discard/draft; comments/activity
- [ ] **Event attendance:** RSVP/attendance in event drawer still works
- [ ] **Resource Hub:** List URL open; gallery preview; Manage asset → `asset` drawer; **in edit mode** click selects block only
- [ ] **Member visibility:** Member preview / non-admin cannot open admin-only pages; Members Welcome hides internal-only events/resources
- [ ] **Content Timeline edit mode:** Click item → must select block, **not** open drawer
- [ ] **Mobile:** Marketing Home + one full-page calendar; sidebars/overlays; no horizontal overflow on filters

---

## 16. Suggested next prompts

- **P1 UX:** “Linked-record layout preservation + manual REG-005 verification notes”
- **P2 polish:** “Wire Upcoming Summary view-all or remove controls; align campaigns mock key naming”
- **Cleanup:** “Archive orphan SocialPostQuickView / ThingsToDoDetailPanel / EventDetailDrawer paths”
- **QA:** “Run manual checklist §15 on staging and capture results”

---

## Appendix A — Phase 1 P0/P1 reconciliation (vs June UX audit)

| Original ID | Jun audit state | Checkpoint state |
|-------------|-----------------|------------------|
| LAY-001 overlay | `md:left-64` gap | **Fixed** — `md:left-sidebar` |
| UX-001 nav flash | `setBlocks([])` | **Fixed** — stale blocks + loading overlay |
| REG-005 drift | Dual state race | **Guarded** — skip setBlocks when dirty |
| Skip link | Missing | **Fixed** |
| LoadingSpinner a11y | Missing | **Fixed** |
| ErrorState | Rarely used | **Fixed** for block load errors |
| PERF-003 resource hub dynamic | Missing | **Fixed**; extended to KPI/theme/upcoming |
| members_welcome union | Missing | **Fixed** |
| Resource Hub edit guard | Missing | **Fixed** |
| Upcoming Summary layout | Generic only | **Fixed** — section mapping |
| Members Welcome shell | Missing from workspace set | **Fixed** |
| campaigns_open_record_mode | Dead | **Removed** (P2) |
| mockAction stubs | Misleading | **Removed** (P2) |
| Content Timeline edit guard | Gap | **Fixed** |
| Accessibility pass | Backlog | **Fixed** — drawer focus, grid keyboard, filter live regions |

---

## Appendix B — Work completed during checkpoint (reference)

| Pass | Summary |
|------|---------|
| P1 | Resource Hub edit guards; Upcoming Summary `recordLayoutType`; Members Welcome shell; edit-mode registry tests |
| P2 | Dead setting removal; Resource Hub stub cleanup; dynamic imports for KPI/theme/upcoming |
| Performance | `deferBlockMount`; KPI lazy wrap; `PERFORMANCE_LAZY_BLOCK_AUDIT_2026-06.md`; `DetailPanel` TS fix |
| P0 close-out | Content Timeline edit guards; `content-timeline-edit-mode.test.ts` |
| Accessibility | `useOverlayPanelA11y`, `FilterResultsAnnouncer`, grid keyboard; `accessibility-marketing-a11y-2026-06.test.ts` |

---

*End of checkpoint report.*
