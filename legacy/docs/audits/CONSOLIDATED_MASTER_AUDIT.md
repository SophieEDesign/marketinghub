# CONSOLIDATED MASTER AUDIT

Last Updated: February 16, 2026

--------------------------------------------------
1. Executive Summary
--------------------------------------------------

This document is the single source of truth for Marketing Hub app health. It consolidates 38 audit documents in `docs/audits/` plus `docs/guides/LEGACY_CODE_CLEANUP_PLAN.md`. The app is a Baserow-style interface (Next.js 14, React, Supabase).

**Overall health** (from COMPREHENSIVE_APP_AUDIT_2026): Security 70%, Performance 65%, Code Quality 75%, Architecture 80%, Testing 40%, Accessibility 50%, UX 60%, Documentation 85%.

**Total issues by severity (after dedupe):** P0: 12 | P1: 18 | P2: 22 | P3: 15

**Count by status:** FIXED: 8 | PARTIAL: 6 | OPEN: 41 | PLANNED: 6

**Top 5 actionable priorities:**
1. Fix CORS configuration (PostgREST not honoring CORS in production)
2. Add comprehensive test coverage (only 9 test files)
3. Address schema critical issues (missing FK indexes, constraints)
4. Remove config loading fallbacks (Chart, KPI, Record blocks use `pageTableId`)
5. Implement request batching for dashboard aggregates (420 requests in sample)

**Note:** Broken pages (6294cdd) excluded from scope.

--------------------------------------------------
2. Unified Priority Matrix
--------------------------------------------------

## P0 – Critical

| Issue | Domain | Status | Sources | Notes |
|-------|--------|--------|---------|-------|
| CORS configuration – PostgREST not honoring CORS settings | Security | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | Production errors |
| RLS policies too permissive | Security | PARTIAL | COMPREHENSIVE_APP_AUDIT_2026, SCHEMA_AUDIT_REPORT | Table delete restricted to admin; other policies need review |
| React #185 (Maximum Update Depth) – TextBlock, FilterBlock, GridView, InterfaceBuilder | Interface | OPEN | FULL_APP_AUDIT_AIRTABLE_PARITY | Infinite loop risk |
| Missing foreign key indexes (47 critical schema issues) | Schema | PARTIAL | SCHEMA_AUDIT_REPORT | schema_audit_fixes partially addresses |
| Missing ON DELETE CASCADE, unique/check constraints | Schema | OPEN | SCHEMA_AUDIT_REPORT | Data integrity risk |
| Insufficient test coverage (9 test files) | Testing | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | Target 70%+ |
| No E2E tests | Testing | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | Playwright/Cypress |
| Config loading consistency – blocks fall back to `pageTableId` | Interface | OPEN | INTERFACE_BUILDER_AUDIT_REPORT | Chart, KPI, Record blocks |
| Save loop prevention – audit all blocks | Interface | PARTIAL | INTERFACE_BUILDER_AUDIT_REPORT, TEXTBLOCK_AUDIT | TextBlock, Settings Panel done |
| MultiCalendar/MultiTimeline – no error handling, errors swallowed | Interface | OPEN | MULTI_CALENDAR_TIMELINE_AUDIT_REPORT | Add catch blocks, user feedback |
| Page creation without required config – Settings → Pages tab | UX | OPEN | UX_AUDIT_REPORT | Invalid pages created |
| Incomplete keyboard navigation | Accessibility | PARTIAL | COMPREHENSIVE_APP_AUDIT_2026 | BaseDropdown, sidebar done |

## P1 – High

| Issue | Domain | Status | Sources | Notes |
|-------|--------|--------|---------|-------|
| Rate limiting on API routes | Security | FIXED | COMPREHENSIVE_APP_AUDIT_2026 | Upstash, invite endpoint |
| No request size limits | Security | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | DoS risk |
| Missing CSRF protection | Security | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | State-changing ops |
| Excessive dashboard aggregate requests | Performance | PARTIAL | VERCEL_LOGS_ANALYSIS | 10s cache TTL applied |
| Slow page loads (avg 978ms) | Performance | OPEN | VERCEL_LOGS_ANALYSIS | Parallelize API calls |
| Client-side data loading – 2000 rows, no pagination | Performance | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | useGridData |
| Console statements in production | Code | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | Use debugLog/debugWarn |
| Excessive `any` types | Code | PARTIAL | COMPREHENSIVE_APP_AUDIT_2026 | MultiCalendarView fixed |
| Code duplication – ~50+ duplicate files | Code | PLANNED | CODE_AUDIT_REPORT, LEGACY_CODE_CLEANUP_PLAN | Verify before remove |
| Edit mode authority (`interfaceMode === 'edit'`) | Records | FIXED | P1_EDIT_MODE_AUTHORITY_IMPLEMENTATION | RecordPanel, RecordModal |
| Right panel inline canvas | UX | FIXED | P2_INLINE_CANVAS_IMPLEMENTATION | Flex layout |
| Focus management in modals/dialogs | Accessibility | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | Focus trapping |
| Missing keyboard shortcuts (undo, duplicate, delete) | UX | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | |
| No undo/redo | UX | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | Interface builder, grid |
| No Filter Block – Grid/Calendar don't receive page filters | Interface | OPEN | FILTER_AUDIT_SUMMARY | |
| InterfaceBuilder state complexity (10+ state vars) | Architecture | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | Consider useReducer |
| Search API – only searches `views`, not `interface_pages` | Architecture | OPEN | CROSS_PAGE_ISSUES_ANALYSIS | |
| Connection exhaustion | Performance | FIXED | CONNECTION_EXHAUSTION_FIX_AUDIT | useViewMeta cache |

## P2 – Medium

| Issue | Domain | Status | Sources | Notes |
|-------|--------|--------|---------|-------|
| Session management – no timeout, no refresh | Security | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | |
| Audit logging for admin actions | Security | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | |
| Bundle size analysis | Performance | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | |
| Image optimization – no Next.js Image | Performance | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | |
| Lazy loading for heavy components | Performance | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | |
| API design standardization | Architecture | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | |
| Color contrast – no WCAG audit | Accessibility | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | |
| Missing onboarding | UX | PLANNED | COMPREHENSIVE_APP_AUDIT_2026 | Welcome, guided tour |
| Poor empty states | UX | PLANNED | COMPREHENSIVE_APP_AUDIT_2026 | |
| View type support – Kanban, Timeline, Gallery disabled in Grid Block | Interface | OPEN | INTERFACE_BUILDER_AUDIT_REPORT | |
| Page settings validation – required fields not enforced | Interface | OPEN | INTERFACE_BUILDER_AUDIT_REPORT | |
| Filter format standardization | Interface | OPEN | FILTER_AUDIT_SUMMARY | |
| Page creation wizard – Settings → Pages uses old flow | UX | OPEN | UX_AUDIT_REPORT | |
| Modal layout editor – WYSIWYG gap | UX | OPEN | MODAL_LAYOUT_AUDIT | |
| Tabs block – registered but no component | Interface | OPEN | DASHBOARD_BLOCKS_AUDIT | |
| SQL view auto-generation | Architecture | OPEN | INTERFACE_BUILDER_AUDIT_REPORT | Document or implement |
| Shared query builder utility | Architecture | OPEN | INTERFACE_BUILDER_AUDIT_REPORT | |
| Canvas state – block reload on mode change | Architecture | FIXED | CANVAS_STATE_AUDIT | One-way gate |
| Page block persistence – asymmetric save/load | Architecture | OPEN | PAGE_BLOCK_PERSISTENCE_ANALYSIS | page_id vs view_id |
| Legacy code cleanup – PageCreationWizard, NewPageModal | Code | OPEN | CLEANUP_SUMMARY | |
| Test coverage reports | Testing | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | |
| API documentation (OpenAPI/Swagger) | Code | PLANNED | COMPREHENSIVE_APP_AUDIT_2026 | |

## P3 – Low / Backlog

| Issue | Domain | Status | Sources | Notes |
|-------|--------|--------|---------|-------|
| Full-text search indexes | Schema | OPEN | SCHEMA_AUDIT_REPORT | |
| Migration guides in migration files | Code | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | |
| Component documentation (JSDoc) | Code | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | |
| Set default view for tables | UX | OPEN | PROGRESS_AUDIT | |
| Search in Form/Kanban/Calendar views | Interface | OPEN | PROGRESS_AUDIT | |
| Multi-select tag UI enhancement | Interface | OPEN | PROGRESS_AUDIT | |
| Responsive design improvements | UX | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | |
| Skip links for keyboard navigation | Accessibility | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | |
| Filter block settings UI | Interface | OPEN | FILTER_AUDIT_SUMMARY | |
| Filter state context | Interface | OPEN | FILTER_AUDIT_SUMMARY | |
| Cache invalidation in useViewMeta | Performance | OPEN | CONNECTION_EXHAUSTION_FIX_AUDIT | Low priority |
| Password policy – special chars for admin | Security | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | |
| Help documentation in-app | UX | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | |
| Performance benchmarks | Testing | OPEN | COMPREHENSIVE_APP_AUDIT_2026 | |
| Pages without group_id – ungrouped section in Sidebar | Architecture | OPEN | CROSS_PAGE_ISSUES_ANALYSIS | |

--------------------------------------------------
3. Domain Breakdown
--------------------------------------------------

### Security

Auth middleware enabled (bypass only with AUTH_BYPASS=true). Rate limiting on invite. Table delete restricted to admin. CORS and CSRF gaps remain.

**Open:** CORS config, request size limits, CSRF, RLS policy review, SQL injection protection for dynamic queries.

**Fixed:** Rate limiting, table delete to admin, auth middleware.

**Sources:** COMPREHENSIVE_APP_AUDIT_2026 §1, PERMISSION_ENFORCEMENT_FINAL, LOGIN_AUDIT_REPORT

### Performance

HTTP caching for fields, favorites, recents. Connection exhaustion fixed. Dashboard aggregate cache 10s TTL. Page loads avg 978ms.

**Open:** Parallelize API calls, pagination/virtual scroll, SWR/React Query, chart server-side aggregation, bundle analysis.

**Fixed:** Connection exhaustion (useViewMeta), dashboard cache TTL, HTTP cache headers, error handling refactor.

**Sources:** COMPREHENSIVE_APP_AUDIT_2026 §2, VERCEL_LOGS_ANALYSIS, OPTIMIZATION_SUMMARY, CONNECTION_EXHAUSTION_FIX_AUDIT

### Schema & DB

47 critical issues. Missing FK indexes, ON DELETE CASCADE, unique/check constraints, NOT NULL. schema_audit_fixes partially addresses indexes.

**Open:** All critical schema fixes per SCHEMA_AUDIT_REPORT.

**Sources:** SCHEMA_AUDIT_REPORT, CORE_DATA_VIEWS_SCHEMA

### Code Quality

Main app in baserow-app/. Root app/, components/, lib/ legacy. ~50+ duplicates. LEGACY_CODE_CLEANUP_PLAN exists; verify before removing.

**Open:** Remove root duplicates, replace `any`, remove console statements, catalog 525 TODOs, MultiCalendar/MultiTimeline error handling.

**Fixed:** MultiCalendarView blockConfig, core architecture unified.

**Sources:** COMPREHENSIVE_APP_AUDIT_2026 §3, CODE_AUDIT_REPORT, CLEANUP_SUMMARY, LEGACY_CODE_CLEANUP_PLAN

### Architecture

Three-layer (Data → Pages → Blocks). InterfaceBuilder complex state. Asymmetric save/load (page_id vs view_id), preview vs persisted drift.

**Open:** Simplify InterfaceBuilder (useReducer), fix asymmetric save/load, resolve state drift.

**Fixed:** Canvas state (no block reload on mode change), one-way gate, layout-mapping.ts.

**Sources:** COMPREHENSIVE_APP_AUDIT_2026 §4, PAGE_BLOCK_PERSISTENCE_ANALYSIS, CANVAS_STATE_AUDIT, INTERFACE_PAGE_RESOLUTION_ANALYSIS, CROSS_PAGE_ISSUES_ANALYSIS

### Testing

Vitest configured. 9 test files. No E2E. Auth, user mgmt, data ops not tested.

**Open:** Unit tests, integration tests, E2E (Playwright/Cypress), auth flows, coverage reporting.

**Sources:** COMPREHENSIVE_APP_AUDIT_2026 §5

### Accessibility

Some ARIA labels. BaseDropdown, sidebar buttons have aria-label. Full keyboard nav incomplete.

**Open:** Full keyboard audit, focus trapping, form labels, WCAG contrast, skip links.

**Fixed:** BaseDropdown trigger, sidebar expand/collapse.

**Sources:** COMPREHENSIVE_APP_AUDIT_2026 §6, UX_AUDIT_REPORT

### UX & Airtable Parity

Pages can exist in invalid states. Settings → Pages creates pages without config. Edit mode authority and inline canvas implemented.

**Open:** Page creation wizard all flows, empty states, Filter Block, config loading consistency, new record inline edit.

**Fixed:** Edit mode authority, right panel inline canvas, page anchors, default page redirect, layout save hardening.

**Sources:** FULL_APP_AUDIT_AIRTABLE_PARITY, UX_AUDIT_REPORT, MARKETING_HUB_AUDIT_REPORT, P1_EDIT_MODE_AUTHORITY_IMPLEMENTATION, P2_INLINE_CANVAS_IMPLEMENTATION

### Interface System

Block-based. Config loading inconsistencies (pageTableId fallbacks). Save loop prevention in TextBlock and Settings Panel. Filter block missing.

**Open:** Remove pageTableId fallbacks, audit all blocks for save loops, Filter Block, enable view types, page settings validation.

**Fixed:** TextBlock save loop, Settings panel debouncing, block config from view_blocks.config.

**Sources:** INTERFACE_BUILDER_AUDIT_REPORT, CANVAS_STATE_AUDIT, INVARIANTS_AUDIT_REPORT, FILTER_AUDIT_REPORT, FILTER_AUDIT_SUMMARY, DASHBOARD_BLOCKS_AUDIT, TEXTBLOCK_AUDIT_REPORT

### Record Shells & Edit Mode

Permissions locked. RecordPanel, RecordModal (grid/calendar), RecordDrawer enforce cascadeContext. P1 edit mode authority implemented.

**Fixed:** Edit mode authority, RecordPanel, RecordModal, RecordDetailPanelInline, permission enforcement, dev-only guardrails.

**Sources:** P1_EDIT_MODE_AUTHORITY_IMPLEMENTATION, P2_INLINE_CANVAS_IMPLEMENTATION, RECORD_EDITOR_SHELLS_WIRING_PLAN, PERMISSION_ENFORCEMENT_FINAL, PERMISSION_ENFORCEMENT_VERIFICATION, PERMISSION_ENFORCEMENT_FINAL_HARDENING

--------------------------------------------------
4. Actionable Next Steps
--------------------------------------------------

## This Week (P0)

1. Add schema migration for FK indexes (per schema_audit_fixes.sql).
2. Add catch blocks and user feedback to MultiCalendarView and MultiTimelineView loadAll().
3. Remove pageTableId fallbacks from ChartBlock, KPIBlock, RecordBlock; require table_id in config.
4. Verify PostgREST CORS config in Supabase dashboard; test production.
5. Wire PageCreationWizard to Settings → Pages tab to prevent invalid page creation.

## This Month (P1)

1. Add unit tests for auth, API routes, critical components (target 70%+).
2. Gate or remove console statements; use debugLog/debugWarn.
3. Implement request batching for dashboard aggregates.
4. Create Filter Block component or document page-level filter usage.
5. Fix React #185: TextBlock editorConfig, FilterBlock emitSignature, GridView columnSettingsKey.
6. Add request size limits to API routes.
7. Add Search API support for interface_pages table.

## Next Quarter (P2/P3)

1. Implement E2E tests with Playwright or Cypress.
2. Execute LEGACY_CODE_CLEANUP_PLAN (verify imports first).
3. Add OpenAPI/Swagger for API routes.
4. Add onboarding (welcome screen, guided tour).
5. Implement undo/redo for interface builder and grid editing.
6. Add WCAG color contrast audit.
7. Add test coverage reporting to CI.

--------------------------------------------------
5. Source Audit Index
--------------------------------------------------

| Audit File | Domain(s) | Last Updated | One-line Summary |
|------------|-----------|--------------|------------------|
| CORE_DATA_VIEWS_SCHEMA.md | Schema | - | view_fields, view_filters, view_sorts schema |
| COMPREHENSIVE_APP_AUDIT_2026.md | Full-stack | Feb 2026 | Security, performance, code, architecture, testing, a11y, UX, docs |
| VERCEL_LOGS_ANALYSIS.md | Performance | Jan 2026 | Dashboard aggregates, slow page loads |
| TEXTBLOCK_AUDIT_REPORT.md | Interface | - | TextBlock save loop, content persistence |
| UX_AUDIT_REPORT.md | UX | - | Page creation, invalid states, Airtable parity |
| SCHEMA_AUDIT_REPORT.md | Schema | - | 47 critical issues, indexes, constraints |
| RECORD_EDITOR_SHELLS_WIRING_PLAN.md | Records | - | Shell-by-shell logic, useRecordEditorCore |
| QA_CHECKLIST_AUDIT_RESULTS.md | Interface | Jan 2025 | Canonical UI contracts, sanity tests |
| PROGRESS_AUDIT.md | Progress | Jan 2025 | ~89% complete, feature status |
| PRODUCT_MODEL_CONSOLIDATION_AUDIT.md | Architecture | - | Page types, record view concept |
| PERMISSION_ENFORCEMENT_VERIFICATION.md | Security | Feb 2025 | Surfaces vs permission flags |
| PERMISSION_ENFORCEMENT_FINAL_HARDENING.md | Security | Feb 2025 | Cascade context, guardrails |
| PERMISSION_ENFORCEMENT_FINAL.md | Security | Feb 2025 | Lock confirmed, call-site summary |
| PAGE_BLOCK_PERSISTENCE_ANALYSIS.md | Architecture | - | Save/load asymmetry, state merge |
| P2_INLINE_CANVAS_IMPLEMENTATION.md | UX | - | Right panel inline canvas – FIXED |
| P1_EDIT_MODE_AUTHORITY_IMPLEMENTATION.md | Records | - | interfaceMode authority – FIXED |
| MULTI_CALENDAR_TIMELINE_AUDIT_REPORT.md | Interface | Jan 2025 | Error handling, field resolution |
| OPTIMIZATION_SUMMARY.md | Performance | - | HTTP caching, error handling |
| MODAL_LAYOUT_VERIFICATION.md | UX | - | Modal layout verification |
| MODAL_LAYOUT_AUDIT.md | UX | - | Modal layout edit vs view divergence |
| MODAL_EDITOR_UX_REDESIGN_PLAN.md | UX | - | Modal editor redesign plan |
| MARKETING_HUB_AUDIT_REPORT.md | UX | Jan 2025 | Interface system, core principles |
| MARKETING_HUB_AUDIT.md | UX | Jan 2025 | Interface audit |
| LOGIN_AUDIT_REPORT.md | Security | Jan 2025 | Auth, middleware, RLS |
| LIFECYCLE_AUDIT_REPORT.md | Architecture | - | Mount/unmount, keys, page load |
| INVARIANTS_AUDIT_REPORT.md | Interface | - | Layout, TextBlock, edit mode invariants |
| INTERFACE_PAGE_RESOLUTION_ANALYSIS.md | Architecture | - | pageId resolution, navigation |
| INTERFACE_BUILDER_AUDIT_REPORT.md | Interface | Jan 2025 | Blocks, config, view types |
| FULL_APP_AUDIT_AIRTABLE_PARITY.md | Full-stack | Feb 2026 | Performance, React #185, edit mode, grid UX |
| FULL_APP_ARCHITECTURE_UX_AUDIT.md | Architecture | Feb 2025 | Core constraints, principles |
| FILTER_AUDIT_SUMMARY.md | Interface | - | Filter block, page filters |
| FILTER_AUDIT_REPORT.md | Interface | Jan 2025 | Block vs page filters, precedence |
| DASHBOARD_BLOCKS_AUDIT.md | Interface | Jan 2025 | 11 block types, registry |
| CROSS_PAGE_ISSUES_ANALYSIS.md | Architecture | - | group_id, search API, dual table |
| CONNECTION_EXHAUSTION_FIX_AUDIT.md | Performance | Jan 2025 | useViewMeta cache – FIXED |
| CLEANUP_SUMMARY.md | Code | - | Unified canvas, remaining refs |
| CODE_AUDIT_REPORT.md | Code | Jan 2025 | Duplicates, legacy, ~50 files |
| CANVAS_STATE_AUDIT.md | Architecture | - | Block reload, one-way gate – FIXED |
| LEGACY_CODE_CLEANUP_PLAN.md (docs/guides/) | Code | Feb 2026 | Root vs baserow-app cleanup steps |
