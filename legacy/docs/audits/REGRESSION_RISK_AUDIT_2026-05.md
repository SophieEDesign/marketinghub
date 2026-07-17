# Regression risk audit — May 2026

Ongoing gate for stabilisation PRs. Extends [TESTING_THE_FIXES.md](../guides/TESTING_THE_FIXES.md).

## High-churn files

| File | Risk | Watch |
|------|------|--------|
| `baserow-app/components/grid/AirtableGridView.tsx` | High | Row click, bulk selection, paste/fill |
| `baserow-app/components/interface/InterfacePageClient.tsx` | High | `loadBlocks`, dual state with builder |
| `baserow-app/components/interface/InterfaceBuilder.tsx` | High | Block save, settings panel sync |
| `baserow-app/components/records/RecordPanel.tsx` | High | Edit mode, overlay |
| `baserow-app/components/layout/WorkspaceShellWrapper.tsx` | Medium | Nav payload, serialization |

## Behaviour invariants

| ID | Area | Invariant | Test |
|----|------|-----------|------|
| REG-001 | Core data grid | Bulk bar / bulk edit only when **2+** checkboxes selected | `__tests__/bulk-action-bar.test.ts` |
| REG-002 | Core data grid | Open chevron opens record; no bulk edit | Manual + e2e when authed |
| REG-003 | Core data grid | Row background click does **not** bulk-select | `AirtableGridView` row onClick |
| REG-004 | Interface pages | Sidebar clickable with record panel (`md:left-sidebar`) | Manual |
| REG-005 | Interface pages | Blocks visible after settings save with block selected | Manual |
| REG-006 | Records | Single record open path via modal context → panel | Manual |
| REG-007 | Edit mode | Right panel width from UIMode `isEdit()` only | `.cursor/rules/layout-width-authority.mdc` |

## Known regressions (REG-xxx)

| ID | Status | Repro | Root cause | Fix |
|----|--------|-------|------------|-----|
| REG-001 | **Fixed** | Click record/row in core data → bulk bar with 1 row | Row click called `handleRowSelect`; bar at `count > 0` | `BulkActionBar` min 2; row click no longer selects |
| REG-002 | Fixed (with REG-001) | Open chevron showed bulk bar | Selection from row click | Chevron unchanged; row no longer selects |
| REG-003 | Fixed | Row click selected for bulk | Same as REG-001 | Checkbox column only |

## Per-PR checklist

Copy into PR description:

```
## Regression checklist
- [ ] Listed REG-ids exercised: ___
- [ ] `npm test` green
- [ ] `npm run build` green (if UI/routes touched)
- [ ] No new `fixed inset-0` without `md:left-sidebar` (desktop)
- [ ] No ungated `console.log` in changed files
```

### By change area

| If you changed… | Run REG-ids |
|-----------------|-------------|
| `components/grid/` | REG-001, REG-002, REG-003 |
| `components/interface/` | REG-004, REG-005 |
| `contexts/Record*` | REG-006 |
| `UIModeContext`, `WorkspaceShell`, settings panel | REG-007 |

## Automated coverage

| Layer | Location |
|-------|----------|
| Vitest | `__tests__/bulk-action-bar.test.ts`, `__tests__/interface-invariants.test.ts` |
| Playwright | `e2e/grid.spec.ts` (auth redirects); extend when CI has test user |

## Hotspots (open — fix as new REG-xxx)

- `GridView` vs `AirtableGridView` open/click contract drift
- `InterfacePageClient` stale blocks when builder has selection
- Bulk modal `bulkEditOpen` local state — closes when count &lt; 2 (bar unmounts)
