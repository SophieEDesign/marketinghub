# Stabilisation checkpoint — May 2026

Status tracker for the [Stabilise, Audit & Consistency](../.cursor/plans/stabilise_and_tidy_audit_d786f302.plan.md) program. Does not duplicate [CONSOLIDATED_MASTER_AUDIT.md](./CONSOLIDATED_MASTER_AUDIT.md).

## Program phases

| Phase | PR | Status | Notes |
|-------|-----|--------|-------|
| 0 | Baseline + smoke | Done | `npm test` 219 passed |
| 0b | Regression audit + REG-001 | Done | [REGRESSION_RISK_AUDIT_2026-05.md](./REGRESSION_RISK_AUDIT_2026-05.md) |
| 1a | Interface blocks pipeline | Done | Blocks mirror, load refs, page ErrorBoundary |
| 1b | Record open API | Done | GridBlock → useRecordModal; resolve-record-edit-mode |
| 1c | View error boundaries | Done | ViewErrorBoundary on grid/list/builder/review |
| 1d | Debug/console cleanup | Done | Shell agent logs removed; WorkspaceTab/fields gated |
| 2a | Shell caching + sanitize | Done | `loadShellCoreNav` cache; shared sanitize lib |
| 2b | Blocks SSR prefetch | Done | `fetchPageBlocksForPage` + `initialBlocks` |
| 2c | Linked-field batch | Done | `resolveLinkedFieldDisplayMapsBatch` in 3 views |
| 2d | Render compare tuning | Done | `blockLayoutSignature` in loadBlocks compare |
| 3 | Edit matrix, API, ESLint | Done | EDIT_MODE_MATRIX, API_ROUTES, eslint deps |

## Smoke checklist (manual)

- [ ] `/pages/[pageId]` — blocks load, no permanent empty state
- [ ] `/tables/[tableId]` — core data grid loads
- [ ] Open record (chevron) — no bulk bar with one row
- [ ] Two checkboxes — bulk bar appears
- [ ] Record panel open — sidebar links still work (desktop)
- [ ] Edit mode — right settings panel visible, layout width correct
- [ ] Save block settings with block selected — blocks still visible

## Automated baseline

Run from `baserow-app/`:

```bash
npm test
npm run build
npm run test:e2e   # optional, requires env
```

## Regression invariants

Verified REG-ids are listed in [REGRESSION_RISK_AUDIT_2026-05.md](./REGRESSION_RISK_AUDIT_2026-05.md). Tag PRs with e.g. `REG-001, REG-004`.

## Git baseline (if pages break)

Last known working tag per workspace rule: `868b674`. First broken: `6294cdd` (RecordModal global context).

```bash
git diff 868b674 -- baserow-app/contexts/RecordModalContext.tsx baserow-app/components/interface/InterfacePageClient.tsx baserow-app/components/records/RecordPanel.tsx
```
