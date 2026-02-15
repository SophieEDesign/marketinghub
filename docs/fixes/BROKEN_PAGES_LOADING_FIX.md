# Broken Pages Loading - Fix Documentation

**Date:** February 2025  
**Related:** [.cursor/rules/broken-pages-loading.mdc](../../.cursor/rules/broken-pages-loading.mdc)  
**Last working:** `868b674` | **First broken:** `6294cdd`

---

## Summary

Pages were not loading on Vercel after the PageActionsContext refactor (commit 6294cdd). Console showed `loadBlocks` called, API returned data, `setBlocks CHECK` ran, but pages remained broken.

## Root Cause Analysis

### Changes in 6294cdd

1. **PageActionsContext introduced** — Edit/View dropdown moved from page header to sidebar
2. **InterfacePageClient** — Removed inline BaseDropdown; now registers handlers via `registerPageActions`
3. **WorkspaceShell** — Wrapped children with `PageActionsProvider`

### Verified Wiring

- **Provider order:** `RightSettingsPanelDataProvider` → `RecordPanelProvider` → `RecordModalProvider` → `PageActionsProvider` → `MainScrollProvider` → `SelectionContextProvider`
- **InterfacePageClient** always renders inside `WorkspaceShell` (via `WorkspaceShellWrapper`) for `/pages/[pageId]` and `/interface/[pageId]`
- **handlePageUpdate** is memoized with `useCallback` to prevent effect loops

### Fixes Applied

1. **handlePageUpdate force reload** — Call `loadBlocks(true)` when refreshing after settings update so blocks reflect config changes immediately
2. **Existing safeguards** — `handlePageUpdate` already uses `useCallback` with correct deps; `InteractionFailsafe` unlocks stuck body styles; mobile sidebar overlay closes on navigation

## Validation Checklist

- [ ] Deploy to Vercel preview
- [ ] Confirm pages load and display data
- [ ] Confirm navigation (sidebar links, back button) works
- [ ] Confirm Edit/View toggle in sidebar BaseDropdown works
- [ ] Confirm page settings panel opens and saves

## References

- [Full App Audit Plan](../../.cursor/plans/full_app_audit_27100f84.plan.md) — Phase 0
- [InterfacePageClient.tsx](../../baserow-app/components/interface/InterfacePageClient.tsx) — Main page client
- [WorkspaceShell.tsx](../../baserow-app/components/layout/WorkspaceShell.tsx) — Provider hierarchy
