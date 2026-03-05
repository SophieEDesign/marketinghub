# React Error #185 Investigation Summary

**Date:** 2025-03-05  
**Context:** ErrorBoundary catches "Maximum update depth exceeded" in production on `app/pages/[pageId]/page` route. Component stack includes Array.map, LoadableComponent, Suspense, RecordEditor, RecordPanel, Canvas, BlockRenderer.

## Findings

### RecordEditor

- **Lines 219–228:** `resolvedFieldLayout` → `localFieldLayout` sync effect uses `resolvedLayoutSignatureRef` to avoid redundant updates. Safe.
- **Lines 324–328:** `interfaceMode` transition effect calls `onLayoutSave(localFieldLayout)` when switching edit→view. Uses `prevInterfaceModeRef` to run only on transition. `onLayoutSave` may update parent state, but the effect does not re-trigger a loop because `prevInterfaceModeRef` is updated before any parent re-render.
- **Lines 167–183:** `contentReady` effect depends on `formData`. `formData` from `useRecordEditorCore` is expected to be stable. `contentReadyRef` guards `setContentReady(true)` to run once.

### RecordPanel

- **Lines 66–74:** Escape-key effect depends on `isEdit` (from `useUIMode`). `isEdit` is memoized with `[state.uiMode, state.editingPageId]`, so it is stable when those values do not change.
- **Lines 35–37:** `interfaceMode` is derived from `state.interfaceMode` and `isEdit()`. No effect loops observed.

### CalendarView / CalendarBlock

- **Existing mitigations:** MemoizedFullCalendar, stable CALENDAR_PLUGINS, `blockConfigRef` for handler identity, `prevCombinedKeyRef` and similar guards. Explicit comment: "DO NOT check rows.length === 0".
- **Lines 331–348:** Table/view change effect uses `prevTableIdRef` and `prevViewIdRef` to skip redundant updates.

### BlockRenderer

- **Lines 208–220:** `safeBlock` is memoized by `block.id`, `block.type`, etc., to avoid new references each render (prevents React #185 in CalendarBlock/GridBlock).
- **Hardening:** ErrorBoundary now uses `resetKeys={[block.id]}` so switching blocks resets the boundary and allows recovery.

### RightSettingsPanelDataContext

- Plan notes: Skip redundant `setData` when references unchanged. Already implemented.

## Recommendations

1. **Reproduce in dev:** Run with `NODE_ENV=development` to get full error text instead of minified #185.
2. **StrictMode:** Consider enabling `React.StrictMode` in dev to surface double-invoke and effect issues earlier.
3. **Array.map usage:** If the error persists, add logging around blocks that map over arrays (e.g. Calendar events, RecordEditor field layout) to trace which map triggers the loop.
