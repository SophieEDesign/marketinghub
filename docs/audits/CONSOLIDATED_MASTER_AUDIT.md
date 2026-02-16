# Consolidated Master Audit - Marketing Hub

**Date:** February 16, 2026  
**Scope:** Merged findings from all 38 audit documents in `docs/audits/`  
**Exclusions:** Broken pages state (6294cdd) - addressed separately

---

## Executive Summary

This document consolidates findings from 38 audit reports into a single master audit with unified priorities and actionable next steps. The Marketing Hub is a Baserow-style interface built with Next.js 14, React, and Supabase.

### Overall Health (from COMPREHENSIVE_APP_AUDIT_2026)

| Domain | Score | Status |
|--------|-------|--------|
| Security | 70% | Good foundation, gaps remain |
| Performance | 65% | Caching implemented, optimization needed |
| Code Quality | 75% | Good structure, duplication issues |
| Architecture | 80% | Solid separation of concerns |
| Testing | 40% | Insufficient coverage |
| Accessibility | 50% | Partial ARIA, keyboard nav incomplete |
| User Experience | 60% | Functional, missing polish |
| Documentation | 85% | Comprehensive guides |

### Issue Counts (Deduplicated)

| Severity | Count | Status |
|----------|-------|--------|
| **P0 (Critical)** | 12 | 4 fixed, 8 open |
| **P1 (High)** | 18 | 6 fixed/partial, 12 open |
| **P2 (Medium)** | 22 | 5 fixed, 17 open |
| **P3 (Low)** | 15 | Backlog |

### Top 5 Actionable Priorities

1. **Fix CORS configuration** - PostgREST not honoring CORS (production errors)
2. **Add comprehensive test coverage** - Only 9 test files for entire app
3. **Address schema critical issues** - 17 critical schema issues (indexes, constraints)
4. **Remove config loading fallbacks** - Blocks inconsistently use `pageTableId`
5. **Implement request batching** - Dashboard aggregate requests (420 in sample period)

---

## Unified Priority Matrix

### P0 (Critical - Fix Immediately)

| # | Issue | Status | Source |
|---|-------|--------|--------|
| 1 | CORS configuration - PostgREST not honoring CORS settings | OPEN | COMPREHENSIVE_APP_AUDIT_2026 |
| 2 | RLS policies too permissive - Table delete restricted to admin (FIXED); other policies need review | PARTIAL | COMPREHENSIVE_APP_AUDIT_2026, schema_audit |
| 3 | React #185 (Maximum Update Depth) - TextBlock, FilterBlock, GridView, InterfaceBuilder | OPEN | FULL_APP_AUDIT_AIRTABLE_PARITY |
| 4 | Schema: Missing indexes on foreign keys (47 critical issues) | PARTIAL | SCHEMA_AUDIT_REPORT |
| 5 | Schema: Missing ON DELETE CASCADE, missing unique/check constraints | OPEN | SCHEMA_AUDIT_REPORT |
| 6 | Insufficient test coverage - Only 9 test files | OPEN | COMPREHENSIVE_APP_AUDIT_2026 |
| 7 | No E2E tests | OPEN | COMPREHENSIVE_APP_AUDIT_2026 |
| 8 | Config loading consistency - Blocks fall back to `pageTableId` (Chart, KPI, Record) | OPEN | INTERFACE_BUILDER_AUDIT_REPORT |
| 9 | Save loop prevention - Audit all blocks for save loops | PARTIAL | INTERFACE_BUILDER_AUDIT_REPORT, TEXTBLOCK_AUDIT |
| 10 | MultiCalendar/MultiTimeline - No error handling, errors silently swallowed | OPEN | MULTI_CALENDAR_TIMELINE_AUDIT_REPORT |
| 11 | Page creation without required config - Settings → Pages tab allows invalid pages | OPEN | UX_AUDIT_REPORT |
| 12 | Incomplete keyboard navigation | PARTIAL | COMPREHENSIVE_APP_AUDIT_2026 |

### P1 (High - Fix Soon)

| # | Issue | Status | Source |
|---|-------|--------|--------|
| 1 | Rate limiting on API routes | FIXED | COMPREHENSIVE_APP_AUDIT_2026 |
| 2 | No request size limits on API routes | OPEN | COMPREHENSIVE_APP_AUDIT_2026 |
| 3 | Missing CSRF protection | OPEN | COMPREHENSIVE_APP_AUDIT_2026 |
| 4 | Excessive dashboard aggregate requests | MITIGATED | VERCEL_LOGS_ANALYSIS, COMPREHENSIVE_APP_AUDIT_2026 |
| 5 | Slow page loads (avg 978ms) | OPEN | VERCEL_LOGS_ANALYSIS |
| 6 | Client-side data loading - Up to 2000 rows, no pagination | OPEN | COMPREHENSIVE_APP_AUDIT_2026 |
| 7 | Console statements in production | OPEN | COMPREHENSIVE_APP_AUDIT_2026 |
| 8 | Excessive `any` types | PARTIAL | COMPREHENSIVE_APP_AUDIT_2026 |
| 9 | Code duplication - ~50+ duplicate files (root vs baserow-app) | PLANNED | CODE_AUDIT_REPORT |
| 10 | Edit mode authority (`interfaceMode === 'edit'`) | FIXED | P1_EDIT_MODE_AUTHORITY_IMPLEMENTATION |
| 11 | Right panel inline canvas | FIXED | P2_INLINE_CANVAS_IMPLEMENTATION |
| 12 | Focus management in modals/dialogs | OPEN | COMPREHENSIVE_APP_AUDIT_2026 |
| 13 | Missing keyboard shortcuts (undo, duplicate, delete) | OPEN | COMPREHENSIVE_APP_AUDIT_2026 |
| 14 | No undo/redo | OPEN | COMPREHENSIVE_APP_AUDIT_2026 |
| 15 | No Filter Block component - Grid/Calendar don't receive page filters | OPEN | FILTER_AUDIT_SUMMARY |
| 16 | InterfaceBuilder state complexity - 10+ state variables | OPEN | COMPREHENSIVE_APP_AUDIT_2026 |
| 17 | Search API - Only searches `views` table, not `interface_pages` | OPEN | CROSS_PAGE_ISSUES_ANALYSIS |
| 18 | Connection exhaustion | FIXED | CONNECTION_EXHAUSTION_FIX_AUDIT |

### P2 (Medium - Fix When Possible)

| # | Issue | Status | Source |
|---|-------|--------|--------|
| 1 | Session management - No explicit timeout, no refresh | OPEN | COMPREHENSIVE_APP_AUDIT_2026 |
| 2 | Audit logging for admin actions | OPEN | COMPREHENSIVE_APP_AUDIT_2026 |
| 3 | Bundle size analysis | OPEN | COMPREHENSIVE_APP_AUDIT_2026 |
| 4 | Image optimization - No Next.js Image component | OPEN | COMPREHENSIVE_APP_AUDIT_2026 |
| 5 | Lazy loading for heavy components | OPEN | COMPREHENSIVE_APP_AUDIT_2026 |
| 6 | API design standardization | OPEN | COMPREHENSIVE_APP_AUDIT_2026 |
| 7 | Color contrast - No WCAG audit | OPEN | COMPREHENSIVE_APP_AUDIT_2026 |
| 8 | Missing onboarding | PLANNED | COMPREHENSIVE_APP_AUDIT_2026 |
| 9 | Poor empty states | PLANNED | COMPREHENSIVE_APP_AUDIT_2026 |
| 10 | View type support in Grid Block - Kanban, Timeline, Gallery disabled | OPEN | INTERFACE_BUILDER_AUDIT_REPORT |
| 11 | Page settings validation - Required fields not enforced | OPEN | INTERFACE_BUILDER_AUDIT_REPORT |
| 12 | Filter format standardization | OPEN | FILTER_AUDIT_SUMMARY |
| 13 | Page creation wizard - Settings → Pages tab still uses old flow | OPEN | UX_AUDIT_REPORT |
| 14 | Modal layout editor - WYSIWYG gap | OPEN | MODAL_LAYOUT_AUDIT |
| 15 | Tabs block - Registered but no component exists | OPEN | DASHBOARD_BLOCKS_AUDIT |
| 16 | SQL view auto-generation - Document or implement | OPEN | INTERFACE_BUILDER_AUDIT_REPORT |
| 17 | Shared query builder utility | OPEN | INTERFACE_BUILDER_AUDIT_REPORT |
| 18 | Canvas state - Block reload on mode change | FIXED | CANVAS_STATE_AUDIT |
| 19 | Page block persistence - Asymmetric save/load | OPEN | PAGE_BLOCK_PERSISTENCE_ANALYSIS |
| 20 | Legacy code cleanup - PageCreationWizard, NewPageModal | OPEN | CLEANUP_SUMMARY |
| 21 | Test coverage reports | OPEN | COMPREHENSIVE_APP_AUDIT_2026 |
| 22 | API documentation (OpenAPI/Swagger) | PLANNED | COMPREHENSIVE_APP_AUDIT_2026 |

### P3 (Low / Backlog)

| # | Issue | Source |
|---|-------|--------|
| 1 | Full-text search indexes | SCHEMA_AUDIT_REPORT |
| 2 | Migration guides in migration files | COMPREHENSIVE_APP_AUDIT_2026 |
| 3 | Component documentation (JSDoc) | COMPREHENSIVE_APP_AUDIT_2026 |
| 4 | Set default view for tables | PROGRESS_AUDIT |
| 5 | Search in Form/Kanban/Calendar views | PROGRESS_AUDIT |
| 6 | Multi-select tag UI enhancement | PROGRESS_AUDIT |
| 7 | Responsive design improvements | COMPREHENSIVE_APP_AUDIT_2026 |
| 8 | Skip links for keyboard navigation | COMPREHENSIVE_APP_AUDIT_2026 |
| 9 | Filter block settings UI | FILTER_AUDIT_SUMMARY |
| 10 | Filter state context | FILTER_AUDIT_SUMMARY |
| 11 | Cache invalidation in useViewMeta | CONNECTION_EXHAUSTION_FIX_AUDIT |
| 12 | Password policy - Require special chars for admin | COMPREHENSIVE_APP_AUDIT_2026 |
| 13 | Help documentation in-app | COMPREHENSIVE_APP_AUDIT_2026 |
| 14 | Performance benchmarks | COMPREHENSIVE_APP_AUDIT_2026 |
| 15 | Pages without group_id - Ungrouped section in Sidebar | CROSS_PAGE_ISSUES_ANALYSIS |

---

## Domain Sections

### 1. Security

**Summary:** Authentication middleware is enabled (bypass only with `AUTH_BYPASS=true`). Rate limiting added for invite endpoint. RLS policies partially hardened. CORS and CSRF remain gaps.

**Open:**
- CORS configuration (PostgREST)
- Request size limits
- CSRF protection
- RLS policy review (beyond table delete)
- SQL injection protection for dynamic queries

**Fixed:**
- Rate limiting (Upstash)
- Table delete restricted to admin
- Auth middleware (LOGIN_AUDIT may be outdated)

**Source:** [COMPREHENSIVE_APP_AUDIT_2026.md](COMPREHENSIVE_APP_AUDIT_2026.md) §1, [PERMISSION_ENFORCEMENT_FINAL.md](PERMISSION_ENFORCEMENT_FINAL.md)

---

### 2. Performance

**Summary:** HTTP caching added for fields, favorites, recents. Connection exhaustion fixed. Dashboard aggregate caching mitigated (10s TTL). Page loads still slow (avg 978ms).

**Open:**
- Parallelize independent API calls
- Pagination/virtual scrolling for large grids
- Request deduplication (SWR/React Query)
- Chart block server-side aggregation
- Bundle size analysis

**Fixed:**
- Connection exhaustion (useViewMeta cache)
- Dashboard aggregate cache TTL
- HTTP cache headers
- Error handling refactoring

**Source:** [COMPREHENSIVE_APP_AUDIT_2026.md](COMPREHENSIVE_APP_AUDIT_2026.md) §2, [VERCEL_LOGS_ANALYSIS.md](VERCEL_LOGS_ANALYSIS.md), [OPTIMIZATION_SUMMARY.md](OPTIMIZATION_SUMMARY.md), [CONNECTION_EXHAUSTION_FIX_AUDIT.md](CONNECTION_EXHAUSTION_FIX_AUDIT.md)

---

### 3. Schema & Database

**Summary:** 47 critical issues identified. Missing indexes on FKs, ON DELETE CASCADE, unique constraints, check constraints, NOT NULL. `schema_audit_fixes.sql` partially addresses indexes.

**Critical:**
- Add indexes on all foreign keys
- Add ON DELETE CASCADE where appropriate
- Fix missing foreign key constraints
- Fix data integrity issues (Section 14)

**High:**
- Unique constraints, check constraints
- Performance indexes, composite indexes

**Source:** [SCHEMA_AUDIT_REPORT.md](SCHEMA_AUDIT_REPORT.md), [CORE_DATA_VIEWS_SCHEMA.md](CORE_DATA_VIEWS_SCHEMA.md)

---

### 4. Code Quality

**Summary:** Main app in `baserow-app/`. Root-level `app/`, `components/`, `lib/` are legacy. ~50+ duplicate files. LEGACY_CODE_CLEANUP_PLAN exists; verify before removing.

**Open:**
- Remove root duplicates (verify imports first)
- Replace `any` types
- Remove console statements
- Catalog TODO/FIXME (525 matches)
- Add error handling to MultiCalendar/MultiTimeline

**Fixed:**
- MultiCalendarView blockConfig: `Record<string, unknown>`
- Core architecture unified (CLEANUP_SUMMARY)

**Source:** [COMPREHENSIVE_APP_AUDIT_2026.md](COMPREHENSIVE_APP_AUDIT_2026.md) §3, [CODE_AUDIT_REPORT.md](CODE_AUDIT_REPORT.md), [CLEANUP_SUMMARY.md](CLEANUP_SUMMARY.md)

---

### 5. Architecture

**Summary:** Three-layer (Data → Pages → Blocks). InterfaceBuilder has complex state. PAGE_BLOCK_PERSISTENCE_ANALYSIS identified asymmetric save/load, state merge issues.

**Open:**
- Simplify InterfaceBuilder state (consider useReducer)
- Fix asymmetric save/load (page_id vs view_id)
- Resolve preview vs persisted state drift

**Fixed:**
- Canvas state - No block reload on mode change
- One-way gate for blocks (InterfaceBuilder)
- Layout mapping unified (layout-mapping.ts)

**Source:** [COMPREHENSIVE_APP_AUDIT_2026.md](COMPREHENSIVE_APP_AUDIT_2026.md) §4, [PAGE_BLOCK_PERSISTENCE_ANALYSIS.md](PAGE_BLOCK_PERSISTENCE_ANALYSIS.md), [CANVAS_STATE_AUDIT.md](CANVAS_STATE_AUDIT.md)

---

### 6. Testing

**Summary:** Vitest configured. 9 test files. No E2E tests. Critical paths (auth, user management, data ops) not tested.

**Open:**
- Add unit tests for critical components
- Integration tests for API routes
- E2E tests (Playwright/Cypress)
- Tests for auth flows, user management
- Performance regression tests
- Test coverage reporting

**Source:** [COMPREHENSIVE_APP_AUDIT_2026.md](COMPREHENSIVE_APP_AUDIT_2026.md) §5

---

### 7. Accessibility

**Summary:** Some ARIA labels. BaseDropdown, sidebar buttons have aria-label. Full keyboard nav incomplete. Focus management in modals needs work.

**Open:**
- Full keyboard navigation audit
- Focus trapping in modals
- Form labels for all inputs
- Color contrast (WCAG AA)
- Skip links

**Fixed:**
- BaseDropdown trigger (aria-label, aria-haspopup)
- Sidebar expand/collapse buttons

**Source:** [COMPREHENSIVE_APP_AUDIT_2026.md](COMPREHENSIVE_APP_AUDIT_2026.md) §6, [UX_AUDIT_REPORT.md](UX_AUDIT_REPORT.md)

---

### 8. UX & Airtable Parity

**Summary:** Pages can exist in invalid states. Settings → Pages tab creates pages without required config. Edit mode authority and inline canvas implemented. Filter/sort apply UX inconsistent.

**Open:**
- Page creation wizard for all flows
- Empty states with actionable guidance
- Filter block component
- Grid block config loading consistency
- New record inline edit mode

**Fixed:**
- Edit mode authority (P1)
- Right panel inline canvas (P2)
- Page anchors system
- Default page redirect
- Layout save hardening

**Source:** [FULL_APP_AUDIT_AIRTABLE_PARITY.md](FULL_APP_AUDIT_AIRTABLE_PARITY.md), [UX_AUDIT_REPORT.md](UX_AUDIT_REPORT.md), [MARKETING_HUB_AUDIT_REPORT.md](MARKETING_HUB_AUDIT_REPORT.md)

---

### 9. Interface System

**Summary:** Block-based architecture. Config loading inconsistencies (pageTableId fallbacks). Save loop prevention in TextBlock and Settings Panel. Filter block missing. Grid block view types (Kanban, Timeline, Gallery) disabled.

**Open:**
- Remove pageTableId fallbacks (Chart, KPI, Record blocks)
- Audit all blocks for save loops
- Create Filter Block
- Enable view types or document why disabled
- Page settings validation

**Fixed:**
- TextBlock save loop prevention
- Settings panel debouncing
- Block config from view_blocks.config

**Source:** [INTERFACE_BUILDER_AUDIT_REPORT.md](INTERFACE_BUILDER_AUDIT_REPORT.md), [CANVAS_STATE_AUDIT.md](CANVAS_STATE_AUDIT.md), [INVARIANTS_AUDIT_REPORT.md](INVARIANTS_AUDIT_REPORT.md)

---

### 10. Record Shells & Edit Mode

**Summary:** Permissions locked. RecordPanel, RecordModal (grid/calendar), RecordDrawer enforce cascadeContext. P1 edit mode authority implemented. Intentionally permissive for core data when cascadeContext absent.

**Fixed:**
- Edit mode authority (interfaceMode === 'edit')
- RecordPanel, RecordModal, RecordDetailPanelInline
- Permission enforcement (PERMISSION_ENFORCEMENT_FINAL)
- Dev-only guardrails

**Source:** [P1_EDIT_MODE_AUTHORITY_IMPLEMENTATION.md](P1_EDIT_MODE_AUTHORITY_IMPLEMENTATION.md), [P2_INLINE_CANVAS_IMPLEMENTATION.md](P2_INLINE_CANVAS_IMPLEMENTATION.md), [RECORD_EDITOR_SHELLS_WIRING_PLAN.md](RECORD_EDITOR_SHELLS_WIRING_PLAN.md), [PERMISSION_ENFORCEMENT_FINAL.md](PERMISSION_ENFORCEMENT_FINAL.md)

---

## Actionable Next Steps

### Immediate (This Week)

1. **Fix CORS** - Verify PostgREST CORS config in Supabase dashboard; test production
2. **Add schema indexes** - Apply migration for FK indexes (schema_audit_fixes.sql)
3. **Fix MultiCalendar/MultiTimeline error handling** - Add catch blocks, user feedback
4. **Remove pageTableId fallbacks** - ChartBlock, KPIBlock, RecordBlock require table_id in config

### Short Term (This Month)

1. **Test coverage** - Add tests for auth, API routes, critical components (target 70%+)
2. **Console statements** - Gate or remove; use debugLog/debugWarn
3. **Request batching** - Implement for dashboard aggregates
4. **Filter Block** - Create component or document page-level filter usage
5. **Page creation** - Wire PageCreationWizard to Settings → Pages tab
6. **React #185** - Fix TextBlock editorConfig, FilterBlock emitSignature, GridView columnSettingsKey

### Long Term (Next Quarter)

1. **E2E tests** - Playwright or Cypress for critical flows
2. **Legacy code removal** - Execute LEGACY_CODE_CLEANUP_PLAN (verify first)
3. **API documentation** - OpenAPI/Swagger
4. **Onboarding** - Welcome screen, guided tour
5. **Undo/redo** - Interface builder, grid editing

---

## Source Audit Index

| File | Domain(s) | Date | Summary |
|------|-----------|------|---------|
| CORE_DATA_VIEWS_SCHEMA.md | Schema | - | view_fields, view_filters, view_sorts schema |
| COMPREHENSIVE_APP_AUDIT_2026.md | Full-stack | Feb 2026 | Security, performance, code, architecture, testing, a11y, UX, docs |
| VERCEL_LOGS_ANALYSIS.md | Performance | Jan 2026 | Dashboard aggregates, slow page loads |
| TEXTBLOCK_AUDIT_REPORT.md | Interface | - | TextBlock save loop, content persistence |
| UX_AUDIT_REPORT.md | UX | - | Page creation, invalid states, Airtable parity |
| SCHEMA_AUDIT_REPORT.md | Schema | - | 47 critical issues, indexes, constraints |
| RECORD_EDITOR_SHELLS_WIRING_PLAN.md | Record | - | Shell-by-shell logic, useRecordEditorCore |
| QA_CHECKLIST_AUDIT_RESULTS.md | QA | - | Canonical UI contracts, sanity tests |
| PROGRESS_AUDIT.md | Progress | Jan 2025 | ~89% complete, feature status |
| PRODUCT_MODEL_CONSOLIDATION_AUDIT.md | Architecture | - | Page types, record view concept |
| PERMISSION_ENFORCEMENT_VERIFICATION.md | Security | - | Surfaces vs permission flags |
| PERMISSION_ENFORCEMENT_FINAL_HARDENING.md | Security | Feb 2025 | Cascade context, guardrails |
| PERMISSION_ENFORCEMENT_FINAL.md | Security | Feb 2025 | Lock confirmed, call-site summary |
| PAGE_BLOCK_PERSISTENCE_ANALYSIS.md | Architecture | - | Save/load asymmetry, state merge |
| P2_INLINE_CANVAS_IMPLEMENTATION.md | UX | - | Right panel inline canvas - FIXED |
| P1_EDIT_MODE_AUTHORITY_IMPLEMENTATION.md | Record | - | interfaceMode authority - FIXED |
| MULTI_CALENDAR_TIMELINE_AUDIT_REPORT.md | Interface | - | Error handling, field resolution |
| OPTIMIZATION_SUMMARY.md | Performance | - | HTTP caching, error handling |
| MODAL_LAYOUT_VERIFICATION.md | UX | - | Modal layout verification |
| MODAL_LAYOUT_AUDIT.md | UX | - | Modal layout edit vs view divergence |
| MODAL_EDITOR_UX_REDESIGN_PLAN.md | UX | - | Modal editor redesign plan |
| MARKETING_HUB_AUDIT_REPORT.md | UX | - | Interface system, core principles |
| MARKETING_HUB_AUDIT.md | UX | - | Interface audit |
| LOGIN_AUDIT_REPORT.md | Security | Jan 2025 | Auth, middleware, RLS |
| LIFECYCLE_AUDIT_REPORT.md | Architecture | - | Mount/unmount, keys, page load |
| INVARIANTS_AUDIT_REPORT.md | Interface | - | Layout, TextBlock, edit mode invariants |
| INTERFACE_PAGE_RESOLUTION_ANALYSIS.md | Architecture | - | pageId resolution, navigation |
| INTERFACE_BUILDER_AUDIT_REPORT.md | Interface | - | Blocks, config, view types |
| FULL_APP_AUDIT_AIRTABLE_PARITY.md | Full-stack | Feb 2026 | Performance, React #185, edit mode, grid UX |
| FULL_APP_ARCHITECTURE_UX_AUDIT.md | Architecture | Feb 2025 | Core constraints, principles |
| FILTER_AUDIT_SUMMARY.md | Interface | - | Filter block, page filters |
| FILTER_AUDIT_REPORT.md | Interface | - | Block vs page filters, precedence |
| DASHBOARD_BLOCKS_AUDIT.md | Interface | - | 11 block types, registry |
| CROSS_PAGE_ISSUES_ANALYSIS.md | Architecture | - | group_id, search API, dual table |
| CONNECTION_EXHAUSTION_FIX_AUDIT.md | Performance | Jan 2025 | useViewMeta cache - FIXED |
| CLEANUP_SUMMARY.md | Code | - | Unified canvas, remaining refs |
| CODE_AUDIT_REPORT.md | Code | Jan 2025 | Duplicates, legacy, ~50 files |
| CANVAS_STATE_AUDIT.md | Architecture | - | Block reload, one-way gate - FIXED |

---

**Report Generated:** February 16, 2026  
**Next Audit Recommended:** May 16, 2026 (3 months)
