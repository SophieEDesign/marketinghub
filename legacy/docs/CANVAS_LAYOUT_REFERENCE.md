# Canvas Layout System - Authoritative Reference

**Last Updated:** 2026-01-26  
**File:** `baserow-app/components/interface/Canvas.tsx`

This document provides a complete reference for the Canvas layout system, including current behavior, confirmed fixes, limitations, source of truth, rules, and safe next steps.

---

## 1. Current Behaviour

### Layout System

**Grid Configuration:**
- Uses `react-grid-layout` (ResponsiveGridLayout) with `compactType: null`
- Grid config is **identical** in edit and view modes (ensures layout consistency)
- Default: 12 columns, 30px row height, [10, 10] margin
- `compactType: null` - Disabled to preserve absolute positions from database
- `preventCollision: false` - Allows blocks to adjust during drag/resize
- `isBounded: false` - Doesn't force blocks back inside bounds

**Layout State Management:**
- Layout state (`layout`) is synced from blocks prop (database is source of truth)
- Blocks prop contains saved positions: `x`, `y`, `w`, `h` from database
- Layout hydration happens on first load and when blocks change
- Position tracking refs prevent unnecessary re-syncs during user interactions

### Snapping

**Smart Snap System:**
- **Priority:** Corner snap > Vertical snap > Horizontal snap
- Corner snap: Aligns to block corners (top-left, top-right, bottom-left, bottom-right)
- Vertical snap: Aligns to block edges (left/right) when dragging vertically
- Horizontal snap: Aligns to block edges (top/bottom) when dragging horizontally
- Snap detection uses drag vector to determine primary direction
- Visual feedback shows snap targets during drag
- Snapping only applies after drag ends (300ms timeout)

**Implementation:**
- `applySmartSnap()` - Main snap function (lines 750-859)
- `applyCornerSnap()` - Corner alignment (lines 680-748)
- `applyVerticalSnap()` - Vertical edge alignment (lines 600-678)
- `applyHorizontalSnap()` - Horizontal edge alignment (lines 500-598)

### Resizing

**Manual Resize (User Dragging Resize Handle):**
- Resize handles work on all 8 directions (se, sw, ne, nw, e, w, s, n)
- Height is tracked during resize to detect growth/shrinkage
- After resize ends (300ms timeout):
  - **If block grew:** `pushBlocksDown()` pushes blocks below down
  - **If block shrunk:** `compactLayoutVertically()` removes gaps
- Resize state is cleared immediately after completion
- Height is **never cached** after resize completes

**Content-Driven Resize (Expand/Collapse):**
- Triggered via `onHeightChange` callback from blocks
- Only updates the changed block's height (no manual Y position adjustments)
- After height change:
  - **If block grew:** `pushBlocksDown()` pushes blocks below down
  - **If block shrunk:** `compactLayoutVertically()` removes gaps
- Updates happen **synchronously** (no useEffect delay) - content-driven only
- Manual resize is protected via `currentlyResizingBlockIdRef`
- **Note:** Manual resize reflow is post-interaction (300ms timeout), not synchronous

### Reflow

**When Blocks Expand:**
1. Block height increases (via `onHeightChange` or manual resize)
2. `pushBlocksDown()` is called with the resized block ID
3. Algorithm:
   - Finds all blocks that overlap horizontally with resized block
   - Pushes blocks below the resized block's bottom edge down
   - Preserves block order (no reordering)
   - Handles cascading pushes correctly

**When Blocks Collapse:**
1. Block height decreases (via `onHeightChange` or manual resize)
2. `compactLayoutVertically()` is called
3. Algorithm:
   - Sorts blocks by Y position (top to bottom)
   - For each block, finds lowest Y where it fits without overlapping
   - Shifts blocks upward to fill gaps
   - Prevents overlapping blocks

**When Blocks Are Deleted:**
- Detected via block count decrease
- Triggers `compactLayoutVertically()` after 100ms delay
- Only runs if layout is hydrated and not currently resizing

**When Blocks Are Dragged:**
- Snapping is applied after drag ends
- Compaction is **NOT** applied (preserves user's intentional positioning)
- Only snap alignment is applied

---

## 2. Confirmed Fixes

### ✅ Height Reflow (Airtable-Matching Behavior)

**Fixed:** Blocks now properly reflow when expanding/collapsing
- **Expand:** Pushes blocks below down immediately (via `pushBlocksDown`)
- **Collapse:** Pulls blocks up immediately, removes gaps (via `compactLayoutVertically`)
- **No phantom gaps:** Gaps are eliminated by compaction
- **No jitter:** Updates are synchronous, no delayed reflows

**Implementation:**
- Lines 2363-2413: `onHeightChange` handler uses declarative reflow
- Uses `pushBlocksDown()` for growth, `compactLayoutVertically()` for shrinkage
- No manual Y position adjustments (removed imperative logic)

### ✅ Height Transitions Removed

**Fixed:** Height CSS transitions disabled to prevent delayed reflow
- Only `transform` and `width` are animated
- Height changes are immediate (no animation delay)
- Matches Airtable's behavior (correctness over animation)

**Implementation:**
- Lines 1620-1649: CSS transitions exclude height
- `.react-grid-item` transitions only `transform` and `width`

### ✅ No Height Caching

**Fixed:** Heights are never cached or stored after collapse
- Height is **derived** from content only
- Old heights are cleared immediately after resize/change
- No `expandedHeight` or `lastHeight` stored in block config

**Implementation:**
- Lines 1337-1342: Resize state cleared immediately
- Lines 1370-1376: State cleared on edit mode exit
- Lines 2410-2412: Explicit comment: "Do NOT store height in block config"

### ✅ Deterministic Layout Recomputation

**Fixed:** Layout recomputation is deterministic, not imperative
- Uses controlled layout algorithms (`pushBlocksDown`, `compactLayoutVertically`)
- No manual Y position adjustments in `onHeightChange`
- Layout behaves like a vertical stack

**Implementation:**
- Lines 2384-2394: Deterministic reflow using controlled layout algorithms (no manual Y mutation)
- Removed all manual Y position adjustment code
- **Note:** `compactLayoutVertically()` is purely declarative (recomputes layout)
- **Note:** `pushBlocksDown()` is procedural but deterministic (mutates based on relative position, not arbitrary siblings)

### ✅ Grid Configuration Consistency

**Fixed:** Grid config is identical in edit and view modes
- Ensures layout matches between edit and public view
- `GRID_CONFIG` is a constant (never depends on `isEditing`)
- Only interactivity differs (`isDraggable`, `isResizable`)

**Implementation:**
- Lines 1596-1618: `GRID_CONFIG` memoized constant
- Lines 1904-1914: Grid props come from `GRID_CONFIG` only

---

## 3. Known Limitations / Regressions

### ⚠️ Manual Resize Has 300ms Delay

**Current Behavior:**
- Manual resize (dragging resize handle) applies reflow after 300ms timeout
- This is intentional to batch rapid resize events
- **Technically not synchronous:** Reflow happens post-interaction, not during resize
- May feel slightly delayed compared to content-driven changes (which are synchronous)

**Status:** Working as intended, but could be optimized if needed

### ⚠️ Block Deletion Compaction Has 100ms Delay

**Current Behavior:**
- When blocks are deleted, compaction happens after 100ms delay
- This allows layout to update before compaction runs
- May cause brief visual gap before blocks shift up

**Status:** Working as intended, minimal impact

### ⚠️ Snapping Only Applies After Drag Ends

**Current Behavior:**
- Snap alignment happens after drag ends (300ms timeout)
- Visual feedback shows snap targets during drag, but alignment is deferred
- This prevents layout thrashing during drag

**Status:** Working as intended, but could provide real-time snapping if needed

### ⚠️ No Real-Time Compaction During Drag

**Current Behavior:**
- Compaction is **not** applied during drag (preserves user intent)
- Only snapping is applied after drag ends
- This means users can intentionally leave gaps

**Status:** Working as intended (matches Airtable behavior)

### ⚠️ Environment-Driven Layout Changes Ignored

**Current Behavior:**
- Window resize, side panel toggles, modal opens don't trigger layout changes
- This prevents unwanted layout mutations from environmental changes
- May cause layout issues if container size changes significantly

**Status:** Working as intended, but may need adjustment for responsive breakpoints

---

## 4. Source of Truth

### Layout Calculation

**Primary File:** `baserow-app/components/interface/Canvas.tsx`

**Key Functions:**
- `compactLayoutVertically()` (lines 1034-1108) - Removes gaps, shifts blocks up
- `pushBlocksDown()` (lines 872-950) - Pushes blocks down when block grows
- `handleLayoutChange()` (lines 1110-1353) - Handles grid layout changes

**State Management:**
- `layout` state (line 117) - Current layout positions
- `blocks` prop - Source of truth from database
- `previousBlockPositionsRef` - Tracks positions to prevent unnecessary syncs

**Declarative vs Imperative:**
- ✅ **Declarative:** `compactLayoutVertically()` - Recomputes layout from current state
- ✅ **Deterministic:** `pushBlocksDown()` - Procedural but deterministic (mutates based on relative position, not arbitrary siblings)
- ✅ **Deterministic:** `onHeightChange` handler - Uses controlled layout algorithms (no manual Y mutation)
- ❌ **Imperative:** Removed - No manual Y position adjustments

### Snapping

**Primary File:** `baserow-app/components/interface/Canvas.tsx`

**Key Functions:**
- `applySmartSnap()` (lines 750-859) - Main snap coordinator
- `applyCornerSnap()` (lines 680-748) - Corner alignment
- `applyVerticalSnap()` (lines 600-678) - Vertical edge alignment
- `applyHorizontalSnap()` (lines 500-598) - Horizontal edge alignment
- `detectSnapTargets()` (lines 420-498) - Finds snap candidates

**State Management:**
- `activeSnapTargets` state (lines 149-153) - Visual feedback
- `dragStartPositionRef`, `dragLastPositionRef` - Track drag vector
- `currentlyDraggingBlockIdRef` - Current drag target

**Declarative vs Imperative:**
- ✅ **Declarative:** Snap functions compute snap position from layout state
- ⚠️ **Imperative:** Applied after drag ends (300ms timeout) - could be real-time

### Height Changes

**Primary File:** `baserow-app/components/interface/Canvas.tsx`

**Content-Driven Height Changes:**
- `onHeightChange` callback (lines 2363-2413) - From blocks via `BlockRenderer`
- Updates only the changed block's height
- Triggers declarative reflow via `pushBlocksDown()` or `compactLayoutVertically()`

**Manual Resize Height Changes:**
- `onResizeStart` (lines 1919-1930) - Tracks initial height
- `onResizeStop` (lines 1931-1940) - Clears state
- `handleLayoutChange` (lines 1200-1350) - Detects growth/shrinkage, applies reflow

**State Management:**
- `blockHeightsBeforeResizeRef` - Tracks heights during manual resize only
- `currentlyResizingBlockIdRef` - Prevents content-driven changes during manual resize
- Heights are **never cached** after resize completes

**Declarative vs Imperative:**
- ✅ **Deterministic:** Content-driven height changes trigger deterministic reflow functions (synchronous)
- ⚠️ **Post-Interaction:** Manual resize height changes trigger reflow after 300ms timeout (not synchronous)
- ❌ **Imperative:** Removed - No manual Y position adjustments

### Reflow

**Primary File:** `baserow-app/components/interface/Canvas.tsx`

**Reflow Functions:**
- `compactLayoutVertically()` (lines 1034-1108) - Declarative compaction
- `pushBlocksDown()` (lines 872-950) - Declarative push-down

**Trigger Points:**
1. Content-driven height change (lines 2384-2394) - Immediate, synchronous
2. Manual resize end (lines 1266-1286) - After 300ms timeout (post-interaction, not synchronous)
3. Block deletion (lines 1379-1447) - After 100ms delay

**Declarative vs Imperative:**
- ✅ **Declarative:** `compactLayoutVertically()` - Pure recomputation
- ✅ **Deterministic:** `pushBlocksDown()` - Procedural but deterministic (no arbitrary mutations)
- ❌ **Imperative:** Removed - No manual position adjustments

---

## 5. Do / Don't Rules

### ✅ DO

1. **Use Controlled Layout Algorithms for Reflow**
   - Always use `compactLayoutVertically()` (declarative) or `pushBlocksDown()` (deterministic)
   - Never manually adjust Y positions
   - **Note:** `pushBlocksDown()` is procedural but deterministic - it mutates based on relative position, not arbitrary siblings

2. **Update Only Changed Block's Height**
   - In `onHeightChange`, only update the changed block
   - Let compaction functions handle sibling positions

3. **Clear Resize State Immediately**
   - Clear `blockHeightsBeforeResizeRef` after resize completes
   - Clear `currentlyResizingBlockIdRef` when resize ends
   - Never cache heights after collapse

4. **Keep Grid Config Constant**
   - `GRID_CONFIG` must never depend on `isEditing`
   - Only `isDraggable` and `isResizable` should differ between modes

5. **Synchronous Updates for Content Changes**
   - Content-driven height changes should update immediately (synchronous)
   - No `useEffect` delays for content-driven reflow
   - **Note:** Manual resize reflow is post-interaction (300ms timeout), not synchronous

6. **Protect Manual Resize**
   - Check `currentlyResizingBlockIdRef` before applying content-driven changes
   - Don't interfere with user's manual resize

### ❌ DON'T

1. **Never Manually Adjust Y Positions**
   - Don't do: `layout.map(l => l.i === blockId ? { ...l, y: newY } : l)`
   - Don't calculate height deltas and shift blocks manually
   - Always use `compactLayoutVertically()` (declarative) or `pushBlocksDown()` (deterministic)
   - **Note:** `pushBlocksDown()` is acceptable because it's deterministic (mutates based on relative position, not arbitrary)

2. **Never Cache Heights**
   - Don't store `expandedHeight`, `lastHeight`, or any height in block config
   - Don't persist heights after resize/change completes
   - Height must be derived from content only

3. **Never Add Height Transitions**
   - Don't add `height` to CSS transitions
   - Height changes must be immediate for proper reflow

4. **Never Use Min-Height for Layout**
   - Don't set `min-height` on block containers
   - Don't use min-height to prevent collapse gaps
   - Height must be derived from content

5. **Never Debounce Content-Driven Changes**
   - Don't debounce `onHeightChange` callback
   - Don't use `useEffect` with delays for reflow
   - Updates must be synchronous

6. **Never Make Grid Config Conditional**
   - Don't make `GRID_CONFIG` depend on `isEditing`
   - Don't change `compactType`, `rowHeight`, `margin` based on mode
   - Only interactivity should differ

7. **Never Apply Compaction During Drag**
   - Don't compact layout while user is dragging
   - Only apply snapping after drag ends
   - Preserve user's intentional positioning

---

## 6. Next Safe Steps

### ✅ Safe to Change

1. **Optimize Resize Timeout**
   - Can reduce 300ms timeout for manual resize if needed
   - Test thoroughly to ensure no layout thrashing

2. **Real-Time Snapping**
   - Could apply snapping during drag (not just after)
   - Would require careful testing to avoid layout thrashing

3. **Block Deletion Delay**
   - Could reduce 100ms delay for block deletion compaction
   - Minimal risk, but test to ensure layout updates first

4. **Visual Feedback Improvements**
   - Can enhance snap target visuals
   - Can add resize preview indicators
   - Low risk, cosmetic only

5. **Performance Optimizations**
   - Can memoize compaction functions if needed
   - Can optimize gap detection if performance issues arise

### ⚠️ Do Not Touch Until Resolved

1. **Grid Configuration**
   - **DO NOT** change `GRID_CONFIG` structure
   - **DO NOT** make it conditional on `isEditing`
   - **DO NOT** change `compactType` from `null`
   - **Risk:** Layout mismatch between edit and view modes

2. **Reflow Functions**
   - **DO NOT** modify `compactLayoutVertically()` algorithm
   - **DO NOT** modify `pushBlocksDown()` algorithm
   - **DO NOT** add manual position adjustments
   - **Risk:** Phantom gaps, broken reflow, jitter

3. **Height Change Handler**
   - **DO NOT** add debouncing to `onHeightChange`
   - **DO NOT** add manual Y position adjustments
   - **DO NOT** cache heights
   - **Risk:** Delayed reflow, phantom gaps, broken collapse

4. **CSS Transitions**
   - **DO NOT** add height to transitions
   - **DO NOT** remove transition exclusions
   - **Risk:** Delayed reflow, jitter

5. **Resize State Management**
   - **DO NOT** persist heights after resize
   - **DO NOT** skip clearing resize state
   - **Risk:** Cached heights, broken collapse

6. **Layout Sync Logic**
   - **DO NOT** modify hydration logic (lines 224-470)
   - **DO NOT** change position tracking refs
   - **Risk:** Layout desync, blocks jumping, position loss

---

## Summary

The Canvas layout system is now **stable and matches Airtable behavior**:

- ✅ **Expand/Collapse:** Works correctly, no phantom gaps
- ✅ **Manual Resize:** Fully functional, smooth interactions
- ✅ **Snapping:** Smart alignment after drag
- ✅ **Reflow:** Declarative, predictable, no jitter
- ✅ **Height Management:** Derived from content, never cached

**Key Principle:** All layout changes use **controlled algorithms** - we compute new positions from current state using deterministic functions (`compactLayoutVertically` is declarative, `pushBlocksDown` is procedural but deterministic), never manually adjust individual block positions arbitrarily.

**Critical Rule:** Never manually adjust Y positions. Always use `compactLayoutVertically()` or `pushBlocksDown()`.
