# Canvas State Audit Report

## 🔍 Anti-Patterns Found

### ❌ CRITICAL: Block Reload on Mode Change

**Location:** `baserow-app/components/interface/InterfacePageClient.tsx` lines 322-357

**Issue:** Reloads blocks when exiting edit mode
```typescript
useEffect(() => {
  if (prevIsBlockEditingRef.current && !isBlockEditing && page) {
    loadBlocks(true) // Force reload to get latest saved content
  }
}, [isBlockEditing, page?.id])
```

**Violation:** Blocks should NEVER reload on mode toggle
**Impact:** Causes flicker, layout resets, and state loss when switching between edit/view

---

### ⚠️ POTENTIAL: Blocks Update from initialBlocks

**Location:** `baserow-app/components/interface/InterfaceBuilder.tsx` lines 109-142

**Current Logic:** Updates blocks from `initialBlocks` when hash changes
- Uses hash-based comparison (good)
- Only updates when data actually changes (good)
- Does NOT depend on `effectiveIsEditing` (good)

**Status:** ✅ ACCEPTABLE - Only updates on actual data changes, not mode changes

---

### ✅ ACCEPTABLE: Auto-Save on Exit

**Location:** `baserow-app/components/interface/InterfaceBuilder.tsx` lines 433-490

**Current Logic:** Saves layout when exiting edit mode
- Does NOT reload blocks
- Only saves layout to database
- Acceptable pattern

**Status:** ✅ ACCEPTABLE - Saves without reloading

---

## 🎯 Required Fixes

1. ✅ **Remove block reload on exit edit mode** (InterfacePageClient.tsx) - FIXED
2. ✅ **Remove isEditing from Canvas sync dependencies** (Canvas.tsx) - FIXED
3. ✅ **Verify recordId changes don't trigger reloads** (RecordReviewPage.tsx) - VERIFIED OK

## ✅ Fixes Applied

### Fix 1: Removed Block Reload on Exit Edit Mode
**File:** `baserow-app/components/interface/InterfacePageClient.tsx` (lines 322-357)
- **Removed:** Entire useEffect that reloaded blocks when `isBlockEditing` changed from true to false
- **Result:** Blocks no longer reload when switching between edit/view modes
- **Impact:** Eliminates flicker, layout resets, and state loss when toggling modes
- **Code:** Replaced with comment explaining mode changes must never trigger reloads

### Fix 2: Removed isEditing from Canvas Sync Dependencies
**File:** `baserow-app/components/interface/Canvas.tsx` (lines 371, 459)
- **Changed:** Removed `isEditing` from useEffect dependency arrays
- **Result:** Canvas sync effect only runs when blocks actually change, not on mode changes
- **Impact:** Layout syncs are no longer triggered by edit/view mode toggles
- **Note:** `isEditing` is still used to update `previousIsEditingRef` but doesn't trigger effect

### Fix 3: Implemented One-Way Gate for Blocks (CRITICAL FIX)
**File:** `baserow-app/components/interface/InterfaceBuilder.tsx` (lines 69-113)
- **Removed:** Hash-based block replacement logic (`hashBlocks`, `lastLoadedBlockHashRef`)
- **Implemented:** True one-way gate - blocks set from `initialBlocks` ONCE per pageId, never replaced
- **Result:** After first load, `initialBlocks` can never overwrite live state
- **Impact:** Prevents edit/view drift, layout resets from revalidation/navigation
- **Key Rule:** `hasInitializedRef.current` gate ensures blocks are only set on first load per pageId

### Fix 4: Removed Block Reload in handleBlockUpdate
**File:** `baserow-app/components/interface/InterfaceBuilder.tsx` (lines 514-534)
- **Changed:** Replaced full block reload with in-place optimistic update
- **Result:** Block config updates don't cause remounts or cursor loss
- **Impact:** Smoother editing experience, no state loss during config saves

### Fix 5: Verified Record Review Page
**File:** `baserow-app/components/interface/RecordReviewPage.tsx`
- **Status:** ✅ Already correct
- **Verification:** recordId changes only update props, don't trigger block reloads
- **Key:** Uses stable key `record-review-canvas-${page.id}` (not including recordId)
- **Behavior:** Blocks re-render with new recordId context but don't reload

## ✅ Verified Correct Patterns

### InterfaceBuilder Blocks Initialization
- **Status:** ✅ Correct
- **Pattern:** Hash-based comparison, only updates when `initialBlocks` actually change
- **No mode dependency:** Explicitly excludes `effectiveIsEditing` from dependencies

### handleBlockUpdate Reload
- **Status:** ✅ Acceptable
- **Reason:** Triggered by user action (editing block config), not mode change
- **Behavior:** Reloads after save to get latest database state

### Layout Modified Flag Reset
- **Status:** ✅ Acceptable
- **Pattern:** Only resets flag on entering edit mode, doesn't reload blocks
- **Purpose:** Prevents false saves during mount/hydration

---

## ✅ Correct Patterns Found

- InterfaceBuilder uses one-way gate for initialBlocks (ONCE per pageId)
- Canvas sync logic only triggers on block position changes, not mode changes
- RecordReviewPage doesn't reload blocks on recordId change
- All setBlocks calls are user actions (drag, resize, add, delete, duplicate, config update)

## 🎯 Final Architecture

### Single Source of Truth
- **One block array per page** - managed in InterfaceBuilder state
- **Set from initialBlocks ONCE** - on first load per pageId
- **Never replaced** - after initialization, only user actions modify blocks

### Edit vs View = Capability Flag
- **isEditing** controls drag/resize/settings UI only
- **Does NOT** trigger block reloads, state resets, or layout syncs
- **Blocks persist** across all mode changes

### Block Mutations (Allowed)
✅ User drags block → `handleLayoutChange` → updates blocks
✅ User resizes block → `handleLayoutChange` → updates blocks  
✅ User edits config → `handleBlockUpdate` → updates blocks in-place
✅ User adds block → `handleAddBlock` → adds to blocks
✅ User deletes block → `handleDeleteBlock` → removes from blocks
✅ User duplicates block → `handleDuplicateBlock` → adds to blocks

### Block Mutations (Forbidden)
❌ Mode toggle → NO block changes
❌ Navigation back to page → NO block replacement (unless pageId changed)
❌ Revalidation → NO block replacement
❌ initialBlocks hash change → NO block replacement (after first load)
❌ recordId change → NO block reloads (record review pages)
