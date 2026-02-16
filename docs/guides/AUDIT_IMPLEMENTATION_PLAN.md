# Audit Implementation Plan

**Created:** February 16, 2026  
**Source:** [CONSOLIDATED_MASTER_AUDIT.md](../audits/CONSOLIDATED_MASTER_AUDIT.md)

This plan breaks audit items into executable tickets with steps, dependencies, and acceptance criteria.

---

## Phase 1 – This Week (P0 Critical)

### T1.1 Schema Migration – Foreign Key Indexes

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Estimate** | 2–4 hours |
| **Dependencies** | None |
| **Source** | SCHEMA_AUDIT_REPORT |

**Steps:**
1. Create migration file `supabase/migrations/YYYYMMDD_add_fk_indexes.sql`.
2. Add indexes from SCHEMA_AUDIT_REPORT §1 (automation_logs, automation_runs, entity_activity_log, interface_pages, view_blocks, etc.).
3. Run migration locally; verify no regressions.
4. Document any indexes skipped with rationale.

**Acceptance criteria:**
- [ ] Migration runs without errors.
- [ ] All FK columns in high-traffic tables have indexes.
- [ ] Migration is reversible (down script if needed).

**Files:** `supabase/migrations/`, SCHEMA_AUDIT_REPORT.md (reference)

---

### T1.2 MultiCalendar/MultiTimeline Error Handling

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Estimate** | 2–3 hours |
| **Dependencies** | None |
| **Source** | MULTI_CALENDAR_TIMELINE_AUDIT_REPORT |

**Steps:**
1. Add `try/catch` to `loadAll()` in MultiCalendarView.tsx (lines 220–316).
2. Add `try/catch` to `loadAll()` in MultiTimelineView.tsx (lines 155–243).
3. Check Supabase response `.error`; handle `isAbortError()` (ignore on unmount).
4. Add error state; show user-facing message (e.g. "Unable to load calendar").
5. Implement partial failure: continue loading other sources if one fails.
6. Log errors for debugging (use debugError).

**Acceptance criteria:**
- [ ] No unhandled promise rejections.
- [ ] User sees error message when load fails.
- [ ] Abort errors on unmount are ignored.
- [ ] One failing source does not block others.

**Files:** `baserow-app/components/views/MultiCalendarView.tsx`, `MultiTimelineView.tsx`

---

### T1.3 Remove pageTableId Fallbacks (Block Config)

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Estimate** | 2–3 hours |
| **Dependencies** | None |
| **Source** | INTERFACE_BUILDER_AUDIT_REPORT |

**Steps:**
1. **ChartBlock:** Remove `pageTableId` fallback; require `config.table_id`; show setup state when missing.
2. **KPIBlock:** Same as ChartBlock.
3. **RecordBlock:** Remove `pageTableId` and `pageRecordId` fallbacks; require `config.table_id`; show setup state when missing.
4. Add setup state UI: "Select a table in block settings" for each block.
5. Test existing pages with blocks that have `table_id`; verify no regressions.
6. Document migration for blocks that may lack `table_id` in config.

**Acceptance criteria:**
- [ ] ChartBlock, KPIBlock, RecordBlock never use `pageTableId`.
- [ ] Setup state shown when `table_id` missing.
- [ ] Existing configured blocks continue to work.

**Files:** `baserow-app/components/interface/blocks/ChartBlock.tsx`, `KPIBlock.tsx`, `RecordBlock.tsx`

---

### T1.4 CORS Configuration Verification

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Estimate** | 1–2 hours |
| **Dependencies** | None |
| **Source** | COMPREHENSIVE_APP_AUDIT_2026 |

**Steps:**
1. Check Supabase dashboard → Project Settings → API → CORS.
2. Confirm allowed origins include production domain(s).
3. If PostgREST CORS is separate, verify PostgREST config.
4. Test from production: browser fetch to Supabase; verify no CORS errors.
5. Document any Supabase CORS limitations (see docs/SUPABASE_CORS_SUPPORT_REQUEST_UPDATED.md if present).

**Acceptance criteria:**
- [ ] CORS config documented.
- [ ] Production requests succeed without CORS errors.
- [ ] If unfixable via dashboard, workaround documented.

**Files:** None (config); docs if workaround needed

---

### T1.5 Page Creation Wizard – Settings → Pages Tab

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Estimate** | 3–4 hours |
| **Dependencies** | None |
| **Source** | UX_AUDIT_REPORT |

**Steps:**
1. Locate Settings → Pages tab handler (e.g. SettingsPagesTab.tsx).
2. Replace direct `handleCreatePage()` with flow that opens PageCreationWizard.
3. Ensure wizard collects: page name, page type, anchor (saved_view_id, dashboard_layout_id, etc.).
4. Create page only after valid config; block creation without required anchor.
5. Test: new page from Settings → Pages has valid config and loads correctly.

**Acceptance criteria:**
- [ ] Settings → Pages uses PageCreationWizard.
- [ ] No pages created without required anchor.
- [ ] New pages load without "No data available" when config is valid.

**Files:** `baserow-app/components/.../SettingsPagesTab.tsx`, `PageCreationWizard.tsx`

---

## Phase 2 – This Month (P1 High)

### T2.1 React #185 – TextBlock editorConfig Stability

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Estimate** | 2 hours |
| **Dependencies** | None |
| **Source** | FULL_APP_AUDIT_AIRTABLE_PARITY |

**Steps:**
1. Audit TextBlock.tsx `editorConfig` useMemo dependencies.
2. Ensure `onUpdate` is stable (useRef for callback).
3. Prevent `onUpdate` from firing during init; add guard.
4. Stabilize `readOnlyRef` and `onUpdateRef` dependencies.

**Acceptance criteria:**
- [ ] No React #185 when editing TextBlock.
- [ ] editorConfig stable across renders.

**Files:** `baserow-app/components/interface/blocks/TextBlock.tsx`

---

### T2.2 React #185 – FilterBlock emitSignature

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Estimate** | 2 hours |
| **Dependencies** | None |
| **Source** | FULL_APP_AUDIT_AIRTABLE_PARITY |

**Steps:**
1. Audit FilterBlock.tsx `emitSignature`; remove `emittedFilters` from deps if it changes every update.
2. Fix effect cleanup so it does not cause add/remove loops.
3. Stabilize `updateFilterBlock` dependencies.

**Acceptance criteria:**
- [ ] No React #185 when changing filters.
- [ ] Filter updates apply without loop.

**Files:** `baserow-app/components/interface/blocks/FilterBlock.tsx`

---

### T2.3 React #185 – GridView columnSettingsKey

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Estimate** | 2 hours |
| **Dependencies** | None |
| **Source** | FULL_APP_AUDIT_AIRTABLE_PARITY |

**Steps:**
1. Audit GridView.tsx `columnSettingsKey` computation (lines 822–850).
2. Remove array sorting from render path or memoize with stable deps.
3. Ensure key changes do not trigger effects that update state (which would recalc key).

**Acceptance criteria:**
- [ ] No React #185 when editing grid columns.
- [ ] columnSettingsKey stable when appropriate.

**Files:** `baserow-app/components/grid/GridView.tsx`

---

### T2.4 Request Size Limits

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Estimate** | 2 hours |
| **Dependencies** | None |
| **Source** | COMPREHENSIVE_APP_AUDIT_2026 |

**Steps:**
1. Add middleware or body-parser limit (e.g. 1MB) for JSON bodies.
2. Apply to API routes that accept POST/PATCH/PUT.
3. Return 413 Payload Too Large when exceeded.
4. Document limit in API docs.

**Acceptance criteria:**
- [ ] Requests > 1MB rejected with 413.
- [ ] Normal requests unaffected.

**Files:** `baserow-app/middleware.ts` or route handlers, `next.config.js`

---

### T2.5 Search API – interface_pages Support

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Estimate** | 2–3 hours |
| **Dependencies** | None |
| **Source** | CROSS_PAGE_ISSUES_ANALYSIS |

**Steps:**
1. Open `baserow-app/app/api/search/route.ts`.
2. Add query to `interface_pages` table (id, name, searchable fields).
3. Merge results with `views` table results; deduplicate by ID.
4. Ensure search returns both legacy views and interface pages.

**Acceptance criteria:**
- [ ] Search finds interface pages by name.
- [ ] No regression for views table search.

**Files:** `baserow-app/app/api/search/route.ts`

---

### T2.6 Dashboard Aggregate Request Batching

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Estimate** | 4–6 hours |
| **Dependencies** | None |
| **Source** | VERCEL_LOGS_ANALYSIS |

**Steps:**
1. Create batch endpoint `/api/dashboard/aggregate-batch` accepting array of block configs.
2. Execute aggregate queries in parallel server-side; return single response.
3. Update `usePageAggregates` or block hooks to use batch endpoint when multiple blocks on page.
4. Fallback to single aggregate for standalone blocks.

**Acceptance criteria:**
- [ ] Page with 3 KPI blocks makes 1 batch request instead of 3.
- [ ] Response times improved or unchanged.

**Files:** `baserow-app/app/api/dashboard/`, `baserow-app/lib/dashboard/`, block hooks

---

### T2.7 Console Statements – Production Gate

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Estimate** | 2–3 hours |
| **Dependencies** | None |
| **Source** | COMPREHENSIVE_APP_AUDIT_2026 |

**Steps:**
1. Ensure `debugLog`, `debugWarn`, `debugError` exist and gate on `NODE_ENV` or flag.
2. Replace `console.log` / `console.warn` / `console.error` with debug helpers in high-traffic files.
3. Prioritize: API routes, InterfaceBuilder, Canvas, GridView.

**Acceptance criteria:**
- [ ] No console output in production build (or only via explicit debug flag).
- [ ] Critical paths use debug helpers.

**Files:** `baserow-app/lib/debug.ts`, multiple components

---

### T2.8 Unit Tests – Auth & API Routes

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Estimate** | 6–8 hours |
| **Dependencies** | None |
| **Source** | COMPREHENSIVE_APP_AUDIT_2026 |

**Steps:**
1. Add tests for auth middleware (protected vs public routes).
2. Add tests for `/api/users/invite`, `/api/tables/[tableId]/fields`, `/api/pages/[pageId]/blocks`.
3. Add tests for error handling (404, 401, 413).
4. Target: 70% coverage for API routes.

**Acceptance criteria:**
- [ ] Auth routes tested.
- [ ] Critical API routes have tests.
- [ ] Coverage report shows improvement.

**Files:** `baserow-app/__tests__/`

---

### T2.9 Filter Block Component (or Documentation)

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Estimate** | 2–4 hours (doc) or 8–12 hours (component) |
| **Dependencies** | None |
| **Source** | FILTER_AUDIT_SUMMARY |

**Steps (Option A – Document):**
1. Create FILTER_PRECEDENCE.md documenting block vs page filters.
2. Document how to pass page filters to Grid/Calendar blocks.
3. Add code comments where filter merging happens.

**Steps (Option B – Component):**
1. Create FilterBlock.tsx that emits filter state.
2. Add FilterBlock to block registry.
3. Create FilterContext or prop drilling for blocks to consume.
4. Update GridBlock, CalendarBlock to receive filter block state.

**Acceptance criteria:**
- [ ] Either: Filter precedence documented and Grid/Calendar receive page filters.
- [ ] Or: FilterBlock exists and integrates with blocks.

**Files:** `baserow-app/components/interface/blocks/FilterBlock.tsx` (if component), `docs/guides/FILTER_PRECEDENCE.md`

---

## Phase 3 – Next Quarter (P2/P3)

### T3.1 E2E Tests (Playwright)

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Estimate** | 8–12 hours |
| **Dependencies** | T2.8 |

**Steps:**
1. Add Playwright (`@playwright/test`).
2. Create `e2e/auth.spec.ts` – login, logout.
3. Create `e2e/pages.spec.ts` – create page, add block, navigate.
4. Create `e2e/grid.spec.ts` – open grid, edit cell.

**Acceptance criteria:**
- [ ] E2E suite runs in CI.
- [ ] Critical user flows covered.

---

### T3.2 Legacy Code Cleanup

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Estimate** | 4–8 hours |
| **Dependencies** | None |
| **Source** | LEGACY_CODE_CLEANUP_PLAN |

**Steps:**
1. Verify all imports in baserow-app; none from root `lib/` or `components/`.
2. Verify next.config / routing uses baserow-app only.
3. Remove root `lib/utils.ts` if unused.
4. Remove root `components/ui/*` if unused.
5. Run full test suite and smoke test after each removal.

**Acceptance criteria:**
- [ ] No broken imports.
- [ ] Build succeeds.
- [ ] Manual smoke test passes.

---

### T3.3 API Documentation (OpenAPI)

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Estimate** | 6–8 hours |
| **Dependencies** | None |

**Steps:**
1. Add `next-swagger-doc` or similar.
2. Document `/api/tables`, `/api/pages`, `/api/dashboard/aggregate`.
3. Generate Swagger UI from OpenAPI spec.

**Acceptance criteria:**
- [ ] OpenAPI spec exists.
- [ ] Swagger UI available at /api-docs or similar.

---

### T3.4 Onboarding (Welcome Screen)

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Estimate** | 4–6 hours |
| **Dependencies** | None |

**Steps:**
1. Create WelcomeScreen component.
2. Show on first login for new users (check localStorage or profile flag).
3. Include: "Create your first page", "Add a block", "Invite team" CTAs.
4. Optional: guided tour.

**Acceptance criteria:**
- [ ] New users see welcome screen.
- [ ] Dismissible; does not show again.

---

### T3.5 Undo/Redo – Interface Builder

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Estimate** | 8–12 hours |
| **Dependencies** | None |

**Steps:**
1. Add `useUndoRedo` hook or similar for block state.
2. Track layout changes (drag, resize, add, delete).
3. Cmd+Z / Cmd+Shift+Z for undo/redo.
4. Limit history to 20–50 steps.

**Acceptance criteria:**
- [ ] Undo/redo works for layout changes.
- [ ] Keyboard shortcuts (Cmd+Z, Cmd+Shift+Z).

---

## Ticket Summary

| Phase | Tickets | Est. Total |
|-------|---------|------------|
| Phase 1 (this week) | 5 | 10–16 hours |
| Phase 2 (this month) | 9 | 24–36 hours |
| Phase 3 (next quarter) | 5 | 30–46 hours |

---

## Execution Order

1. **T1.1** (Schema) – No blockers; do first.
2. **T1.2** (MultiCalendar/MultiTimeline) – Low risk.
3. **T1.3** (pageTableId) – Requires config migration plan for existing blocks.
4. **T1.4** (CORS) – Config/verification only.
5. **T1.5** (Page Wizard) – UX improvement.
6. Phase 2 tickets can run in parallel; T2.1–T2.3 (React #185) are independent.
7. Phase 3 after Phase 2 stabilizes.

---

## References

- [CONSOLIDATED_MASTER_AUDIT.md](../audits/CONSOLIDATED_MASTER_AUDIT.md)
- [LEGACY_CODE_CLEANUP_PLAN.md](LEGACY_CODE_CLEANUP_PLAN.md)
- [SCHEMA_AUDIT_REPORT.md](../audits/SCHEMA_AUDIT_REPORT.md)
- [MULTI_CALENDAR_TIMELINE_AUDIT_REPORT.md](../audits/MULTI_CALENDAR_TIMELINE_AUDIT_REPORT.md)
