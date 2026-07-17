# Full App Audit Report - Airtable Parity

## Executive Summary

This audit compares the application's behavior to Airtable and identifies critical issues across performance, React errors, navigation/state management, editing model, right panel implementation, linked records, and grid UX. The audit excludes new view types (kanban/timeline/calendar) as requested.

**Date**: February 9, 2026  
**Scope**: Full application audit vs Airtable behavior  
**Exclusions**: New view types (kanban/timeline/calendar), mobile optimization

---

## 1. Performance Issues (UI Thread Blocked Warnings)

### Issues Found

1. **NavigationDiagnostics.tsx** (lines 454-480)
   - Heavy `getComputedStyle` calls in click handlers
   - Deferred via `requestIdleCallback` but still blocks during critical navigation
   - Multiple style calculations per click event

2. **PerformanceMonitor.tsx** (lines 38-76)
   - Frame rate monitoring detects slow frames (>50ms)
   - Long task observer detects blocking operations
   - No automatic remediation, only warnings

3. **GridView.tsx** (lines 820-850)
   - Column settings key computation runs on every render
   - Memoized but dependencies may cause recalculation
   - Large array sorting operations in render path

4. **TextBlock.tsx** (lines 315-330)
   - TipTap `onUpdate` fires during initialization
   - Multiple state updates per keystroke
   - No debouncing for content saves

5. **FilterBlock.tsx** (lines 256-261)
   - Filter state emission on every filter tree change
   - No debouncing for filter updates
   - Context updates trigger cascading re-renders

### Root Causes

- Missing memoization in render paths
- Heavy computations in event handlers
- Lack of virtualization for large grids
- No chunking for bulk operations
- Synchronous style calculations blocking UI thread

---

## 2. React Error #185 (Maximum Update Depth Exceeded)

### Root Causes Identified

1. **TextBlock.tsx** (lines 257-330)
   - `editorConfig` object recreated on every render despite `useMemo`
   - `onUpdate` callback fires during initialization causing state loops
   - `readOnlyRef` and `onUpdateRef` dependencies cause re-renders

2. **FilterBlock.tsx** (lines 253-261)
   - `emitSignature` includes `emittedFilters` which changes on every filter update
   - Effect cleanup removes filter block, causing add/remove loops
   - `updateFilterBlock` called with unstable dependencies

3. **GridView.tsx** (lines 822-850)
   - `columnSettingsKey` computation includes array sorting
   - Key changes trigger effects that update state
   - State updates cause key recalculation → infinite loop

4. **CalendarBlock.tsx** (memoized but still issues)
   - Props object recreated on every render
   - Calendar view re-renders trigger filter re-evaluation
   - Date field resolution causes repeated updates

5. **InterfaceBuilder.tsx** (lines 169-205)
   - `initialBlocks` dependency causes re-initialization loops
   - Block state updates trigger layout recalculation
   - Layout changes trigger block updates

### Fix Strategy

- Stabilize all config objects with `useMemo` and proper dependencies
- Prevent `setState` in effects that trigger re-renders
- Use refs for callbacks that don't need to trigger re-renders
- Add guards to prevent initialization loops
- Memoize expensive computations outside render path

---

## 3. Navigation/State Correctness Issues

### Issues Found

1. **InterfacePageClient.tsx** (lines 94-130)
   - `pageId` changes don't always trigger remounts
   - Blocks preserved across page navigation (intentional but may cause stale state)
   - Edit mode not always reset on page change

2. **Canvas.tsx** (lines 416-430)
   - `pageId` change resets layout but not always blocks
   - `interfaceMode` changes don't trigger remounts
   - State reset incomplete when `pageId` + `interfaceMode` change together

3. **EditModeContext.tsx** (lines 119-178)
   - Edit mode cleared on page navigation but restoration from localStorage may race
   - `pathname` matching may not catch all navigation cases
   - Block edit mode persists across page changes in some scenarios

4. **RecordPanel.tsx** (line 382)
   - Remount key includes `interfaceMode` but not `pageId`
   - Panel state persists when navigating between pages
   - Manual edit mode state not reset on record change

### Root Causes

- Missing remount keys for critical state changes
- State reset logic incomplete
- Race conditions between navigation and state restoration
- Inconsistent reset triggers across components

---

## 4. Editing Model Failures (interfaceMode Not Authoritative) - P1 FOCUS

### Critical Issue: interfaceMode === 'edit' Can Be Overridden

**Airtable Rule**: If `interfaceMode === 'edit'`, record views MUST be editable everywhere with no fallback to viewer mode.

**Current Violations**:

1. **RecordPanel.tsx** (lines 32-91)
   - ❌ Uses `resolveRecordEditMode` but also has `manualEditMode` state
   - ❌ `effectiveAllowEdit` combines forced and manual modes: `forcedEditMode ? true : (canShowEditButton && isPanelEditing && allowEdit)`
   - ❌ Edit button shown when `!forcedEditMode` allowing override (line 464)
   - ❌ `manualEditMode` can be toggled even when `interfaceMode === 'edit'`

2. **grid/RecordModal.tsx** (lines 73-124)
   - ❌ Similar pattern: `forcedEditMode` + `manualEditMode`
   - ❌ `effectiveEditable` doesn't use `forcedEditMode` at all: `canShowEditButton && isModalEditing`
   - ❌ `isModalEditing` state can override `interfaceMode === 'edit'`
   - ❌ Cancel button disabled when `forcedEditMode` but user can still toggle `isModalEditing`

3. **calendar/RecordModal.tsx** (lines 86-142)
   - ❌ Has `forcedEditMode` but `effectiveEditable` ignores it: `canSave` (permission-based only)
   - ❌ No enforcement of `interfaceMode === 'edit'`
   - ❌ Manual edit mode state exists but not properly integrated

4. **InterfaceBuilder.tsx** (lines 98-106)
   - ✅ `interfaceMode` derived from `effectiveIsEditing`
   - ✅ Synced to RecordPanelContext
   - ⚠️ But not enforced everywhere - record views may not respect it

### Root Causes

- Multiple sources of truth for edit state
- Manual overrides allowed even when `interfaceMode === 'edit'`
- Not all record views use centralized resolver
- Inconsistent enforcement of Airtable rule
- `effectiveEditable` calculations ignore `forcedEditMode` in some components

### P1 Fix Requirements

1. **Single source of truth**
   - Use `resolveRecordEditMode()` everywhere
   - Remove `manualEditMode` or local overrides when `interfaceMode === 'edit'`
   - Delete conditional guards that allow fallback to viewer state

2. **Enforce binary record surfaces**
   - Record views must be either viewer OR editor
   - No hybrid states allowed

3. **Remove edit toggles during forced edit**
   - Hide edit buttons when `interfaceMode === 'edit'`
   - Cancel/Done buttons must not toggle editability, only exit layout editing

4. **Enforce remounting**
   - RecordPanel, RecordModal, inline record views must remount when:
     - `recordId` changes
     - `interfaceMode` changes
   - Use keys that include `recordId` + `interfaceMode`

5. **Linked records**
   - Linked record opens MUST inherit `interfaceMode`
   - Never downgrade to viewer mode during interface editing
   - If inheritance fails, block linked record opening instead

---

## 5. Right Panel Not True Inline Canvas (Gap vs Airtable)

### Issues Found

1. **WorkspaceShell.tsx** (lines 182-183)
   - RecordPanel rendered as separate fixed element
   - Positioned `fixed right-0` overlaying content
   - No integration with main content flow

2. **RecordPanel.tsx** (lines 380-390)
   - Fixed positioning with `translateX` animation
   - No margin/gap handling for main content
   - Content doesn't shift when panel opens

3. **Airtable Comparison**
   - Airtable: Right panel pushes main content left, creating inline canvas
   - Current: Right panel overlays content, no layout shift
   - Gap: Main content doesn't adjust width when panel opens

### Root Causes

- Fixed positioning instead of flex layout
- No main content width adjustment
- Panel treated as overlay rather than layout element
- Missing CSS transitions for smooth layout shifts

---

## 6. Linked Record Behavior Parity

### Current Implementation

1. **LinkedRecordCell.tsx** (lines 107-119)
   - ✅ Preserves `interfaceMode` when opening linked records
   - ✅ Uses `recordPanelState.interfaceMode` correctly
   - ✅ Navigation preserves edit context

2. **RecordFields.tsx** (lines 158-189)
   - ✅ `handleLinkedRecordClick` preserves `interfaceMode`
   - ✅ Uses `navigateToLinkedRecord` with `interfaceMode` parameter
   - ✅ Correctly passes through edit context

3. **RecordPanel.tsx** (line 337)
   - ✅ Duplicate record opens new record with navigation
   - ✅ Preserves `interfaceMode` through navigation

### Status: ✅ Mostly Correct

- Linked records preserve `interfaceMode`
- Navigation maintains edit context
- Minor: Some edge cases may not preserve cascade context

---

## 7. Grid Basics Parity

### Issues Found

1. **Hide Fields** ✅ Implemented
   - `HideFieldsDialog.tsx` exists
   - `ViewBuilderToolbar.tsx` integrates hide fields
   - Saves to `view_fields.visible = false`

2. **Sort** ⚠️ Partial
   - Sort exists but no explicit "Apply" button
   - Changes apply immediately (may be desired)
   - No "Save sort" vs "Cancel" pattern

3. **Filter Apply** ⚠️ Partial
   - `FilterDialog.tsx` has "Save" button
   - `UnifiedFilterDialog.tsx` has "Save" button
   - But toolbar filters apply immediately
   - Inconsistent UX between dialog and toolbar

4. **Row Height** ✅ Implemented
   - `rowHeight` prop exists
   - `grid_view_settings.row_height` persisted
   - `AirtableViewPage.tsx` saves row height

5. **New Record UX** ⚠️ Needs Improvement
   - `handleAddRow` creates record
   - Jumps to new row but may not focus first cell
   - No inline editing mode for new record
   - No "Save" vs "Cancel" for new record

### Gaps vs Airtable

- Filter/sort should have explicit apply buttons in some contexts
- New record should enter inline edit mode immediately
- Row height changes should be more responsive
- Copy/paste exists but may need UX polish

---

## Prioritized Fix Plan

### P0: Correctness/Performance/React Errors (Critical)

1. **Eliminate React #185**
   - Fix TextBlock editor config stability
   - Fix FilterBlock emit signature dependencies
   - Fix GridView column settings key computation
   - Add guards to prevent initialization loops
   - Memoize all expensive computations

2. **Remove UI Thread Blocking**
   - Move heavy computations out of render path
   - Add virtualization for large grids
   - Chunk bulk operations (paste, filter updates)
   - Defer non-critical style calculations
   - Debounce filter/editor updates

3. **Fix Navigation/State Reset**
   - Add remount keys for `pageId` + `interfaceMode` changes
   - Ensure complete state reset on navigation
   - Fix race conditions in EditModeContext
   - Reset RecordPanel state on record change

### P1: Global Mode Authority + Record Open Consistency ⚠️ IN PROGRESS

**Goal**: Make `interfaceMode === 'edit'` the single, absolute authority over all record surfaces.

**Rule (Airtable parity)**: If `interfaceMode === 'edit'`, it must be IMPOSSIBLE for any record view to open in viewer mode.

**Tasks**:

1. **Single source of truth**
   - Use `resolveRecordEditMode()` everywhere
   - Remove `manualEditMode` or local overrides when `interfaceMode === 'edit'`
   - Delete conditional guards that allow fallback to viewer state

2. **Enforce binary record surfaces**
   - Record views must be either:
     a) Viewer surface
     b) Editor surface
   - No hybrid states allowed

3. **Remove edit toggles during forced edit**
   - Hide edit buttons when `interfaceMode === 'edit'`
   - Cancel/Done buttons must not toggle editability, only exit layout editing

4. **Enforce remounting**
   - RecordPanel, RecordModal, inline record views must remount when:
     - `recordId` changes
     - `interfaceMode` changes
   - Use keys that include `recordId` + `interfaceMode`

5. **Linked records**
   - Linked record opens MUST inherit `interfaceMode`
   - Never downgrade to viewer mode during interface editing
   - If inheritance fails, block linked record opening instead

**Files to audit**:
- `RecordPanel.tsx`
- `grid/RecordModal.tsx`
- `calendar/RecordModal.tsx`
- `InterfaceBuilder.tsx`
- `RecordView.tsx`
- `RecordReviewPage.tsx`

**Exit criteria**:
- There is no code path where `interfaceMode === 'edit'` and a record is read-only
- Inline, modal, calendar, and linked record behavior is identical

### P2: Right Panel Inline Canvas Implementation

1. **Layout Integration**
   - Change RecordPanel from fixed to flex layout
   - Adjust main content width when panel opens
   - Add smooth transitions for layout shifts
   - Remove overlay behavior, make it true inline canvas

2. **Gap Handling**
   - Add margin/gap between main content and panel
   - Ensure content doesn't overlap
   - Match Airtable's visual spacing

### P3: Grid UX Polish

1. **Copy/Paste Basics**
   - Improve paste UX (confirmation dialogs)
   - Better error handling for invalid pastes
   - Visual feedback during paste operations

2. **Row Height**
   - More responsive row height changes
   - Better visual feedback
   - Persist per-view settings correctly

3. **New Record UX**
   - Enter inline edit mode immediately
   - Focus first editable cell
   - Better visual indication of new record
   - Optional: "Save" vs "Cancel" pattern

4. **Filter/Sort Apply**
   - Consistent UX across toolbar and dialogs
   - Consider explicit "Apply" buttons where appropriate
   - Better visual feedback for active filters/sorts

---

## Exclusions

- **New view types**: Kanban, Timeline, Calendar (explicitly excluded)
- **Advanced features**: Formula fields, automation, permissions (out of scope)
- **Mobile optimization**: Focus on desktop parity with Airtable

---

## Files to Modify

### P0 Files
- `baserow-app/components/interface/blocks/TextBlock.tsx`
- `baserow-app/components/interface/blocks/FilterBlock.tsx`
- `baserow-app/components/grid/GridView.tsx`
- `baserow-app/components/interface/InterfacePageClient.tsx`
- `baserow-app/components/interface/Canvas.tsx`
- `baserow-app/components/interface/blocks/CalendarBlock.tsx`

### P1 Files ⚠️ CURRENT FOCUS
- `baserow-app/components/records/RecordPanel.tsx`
- `baserow-app/components/grid/RecordModal.tsx`
- `baserow-app/components/calendar/RecordModal.tsx`
- `baserow-app/components/interface/InterfaceBuilder.tsx`
- `baserow-app/components/interface/RecordView.tsx`
- `baserow-app/components/interface/RecordReviewPage.tsx`
- All components that render record views

### P2 Files (Future)
- `baserow-app/components/layout/WorkspaceShell.tsx`
- `baserow-app/components/records/RecordPanel.tsx`
- Main content wrapper components

### P3 Files (Future)
- `baserow-app/components/grid/GridView.tsx`
- `baserow-app/components/grid/GridViewWrapper.tsx`
- `baserow-app/components/grid/Toolbar.tsx`

---

## Testing Checklist

- [ ] React #185 errors eliminated
- [ ] No UI thread blocking warnings
- [ ] Navigation resets state correctly
- [ ] `interfaceMode === 'edit'` enforced everywhere (P1)
- [ ] Record opens consistent across all entry points (P1)
- [ ] Right panel integrates with layout (P2)
- [ ] Grid UX matches Airtable (P3)
