# Page and Block Edit Persistence Analysis Report

## Executive Summary

This report identifies why page and block edits (text, layout, size, columns) persist in preview but revert after navigation or reload. The root cause is **asymmetric save/load paths** and **state management conflicts** between preview state (client-side React state) and persisted state (database).

---

## 1. ALL DATA SOURCES

### 1.1 Database Tables

#### Primary Tables (Active System)
- **`view_blocks`** (supabase/schema.sql:224-240)
  - **Columns**: `id`, `view_id`, `page_id`, `type`, `position_x`, `position_y`, `width`, `height`, `config` (JSONB), `order_index`, `created_at`, `updated_at`
  - **Purpose**: Stores all block data (layout positions, content, configuration)
  - **Dual Reference**: Blocks can reference either `view_id` (old system) OR `page_id` (new `interface_pages` system)
  - **File**: `supabase/schema.sql:224`

- **`interface_pages`** (supabase/schema.sql:272-293)
  - **Columns**: `id`, `name`, `page_type`, `source_view`, `base_table`, `config`, `group_id`, `saved_view_id`, `dashboard_layout_id`, `form_config_id`, `record_config_id`, etc.
  - **Purpose**: New page system (replaces old `views` table for interface pages)
  - **File**: `supabase/schema.sql:272`

#### Legacy Tables (May Still Exist)
- **`pages`** (supabase/migrations/create_pages_tables.sql:4-12)
  - **Status**: Old system, may not be actively used
  - **File**: `supabase/migrations/create_pages_tables.sql:4`

- **`page_blocks`** (supabase/migrations/create_pages_tables.sql:15-29)
  - **Status**: Old system, may not be actively used
  - **File**: `supabase/migrations/create_pages_tables.sql:15`

### 1.2 API Routes

#### GET `/api/pages/[pageId]/blocks` (Load Blocks)
- **File**: `baserow-app/app/api/pages/[pageId]/blocks/route.ts:13-122`
- **Function**: `GET(request, params)`
- **Data Source**: `view_blocks` table
- **Query Logic**:
  - Checks if `pageId` is `interface_pages.id` → uses `page_id` filter
  - Otherwise assumes `views.id` → uses `view_id` filter
- **Returns**: Array of blocks with mapped layout (`position_x` → `x`, `width` → `w`, etc.)
- **Cache Headers**: `no-store, no-cache, must-revalidate` (line 110)

#### PATCH `/api/pages/[pageId]/blocks` (Save Blocks)
- **File**: `baserow-app/app/api/pages/[pageId]/blocks/route.ts:127-311`
- **Function**: `PATCH(request, params)`
- **Handles**:
  - Layout updates (`layout` array) → calls `saveBlockLayout()`
  - Block config updates (`blockUpdates` array) → updates `view_blocks.config`
- **Data Target**: `view_blocks` table

#### POST `/api/pages/[pageId]/blocks` (Create Block)
- **File**: `baserow-app/app/api/pages/[pageId]/blocks/route.ts:316-360`
- **Function**: `POST(request, params)`
- **Data Target**: `view_blocks` table

### 1.3 Server-Side Functions

#### `loadPageBlocks(pageId: string)`
- **File**: `baserow-app/lib/pages/loadPage.ts:50-82`
- **Data Source**: `view_blocks` table
- **Query**: `.eq('view_id', pageId)` (ONLY uses `view_id`, never `page_id`)
- **Issue**: **ASYMMETRIC** - Save can use `page_id`, but load only uses `view_id`
- **Returns**: `PageBlock[]` with mapped layout

#### `saveBlockLayout(pageId: string, layout: LayoutItem[])`
- **File**: `baserow-app/lib/pages/saveBlocks.ts:22-128`
- **Data Target**: `view_blocks` table
- **Query Logic**:
  - Checks if `pageId` is `interface_pages.id` → uses `page_id` filter
  - Otherwise uses `view_id` filter
- **Updates**: `position_x`, `position_y`, `width`, `height`, `order_index`

#### `saveBlockConfig(blockId: string, config: Partial<PageBlock['config']>)`
- **File**: `baserow-app/lib/pages/saveBlocks.ts:130-165`
- **Data Target**: `view_blocks.config` (JSONB column)
- **Updates**: Merges config, preserves layout columns

### 1.4 Client-Side State

#### `InterfaceBuilder` Component
- **File**: `baserow-app/components/interface/InterfaceBuilder.tsx`
- **State**: `const [blocks, setBlocks] = useState<PageBlock[]>(initialBlocks)` (line 50)
- **Purpose**: Manages block state during editing
- **Initialization**: Receives `initialBlocks` prop, syncs via `useEffect` (lines 75-148)
- **Merge Logic**: 
  - First load: Sets blocks directly (line 99)
  - Subsequent: Merges with existing state, **preserves current layout** unless `updated.x != null` (lines 119-122)
  - **Issue**: In edit mode, merges config to "preserve user state" (line 125), which can prevent saved content from appearing

#### `InterfacePageClient` Component
- **File**: `baserow-app/components/interface/InterfacePageClient.tsx`
- **State**: `const [blocks, setBlocks] = useState<any[]>([])` (line 51)
- **Load Function**: `loadBlocks(forceReload = false)` (line 517)
- **Load Trigger**: 
  - On mount for dashboard/overview/content/record_review pages (line 182-190)
  - On exiting edit mode (line 196-222) with 500ms delay
- **Merge Logic**: 
  - `forceReload = false`: Merges blocks, preserves layout from current state (line 615)
  - `forceReload = true`: Replaces blocks entirely (line 595-607)
  - **Issue**: Merge logic may preserve stale layout values

### 1.5 Context Providers

#### `EditModeContext`
- **File**: `baserow-app/contexts/EditModeContext.tsx`
- **Purpose**: Manages edit mode state (page, block, record, sidebar scopes)
- **Persistence**: Saves to `localStorage` (lines 96-142)
- **Not Related**: Edit mode state is separate from block data persistence

---

## 2. SAVE FLOW

### 2.1 Layout Changes (Position, Size)

**User Action**: Drag/resize block in edit mode

**Flow**:
1. **Canvas** (`baserow-app/components/interface/Canvas.tsx`)
   - `react-grid-layout` fires `onLayoutChange` callback
   - Passes `LayoutItem[]` with `{i, x, y, w, h}`

2. **InterfaceBuilder.handleLayoutChange** (line 293-337)
   - Updates local `blocks` state immediately (line 306-320)
   - Stores pending layout in `pendingLayout` state (line 323)
   - Debounces save with 500ms timeout (line 332)

3. **InterfaceBuilder.saveLayout** (line 183-277)
   - Checks `layoutModifiedByUserRef.current` flag (line 200)
   - Calls `/api/pages/${page.id}/blocks` PATCH with `{ layout }` (line 239-243)

4. **API Route PATCH** (`baserow-app/app/api/pages/[pageId]/blocks/route.ts:127`)
   - Receives `layout` array (line 134)
   - Calls `saveBlockLayout(pageId, layout)` (line 158)

5. **saveBlockLayout** (`baserow-app/lib/pages/saveBlocks.ts:22`)
   - Determines if `pageId` is `interface_pages.id` or `views.id` (lines 29-35)
   - Maps `LayoutItem` → DB format: `{position_x: x, position_y: y, width: w, height: h}` (lines 39-46)
   - Updates `view_blocks` table (lines 62-80)
   - **SAVES TO**: `view_blocks.position_x`, `position_y`, `width`, `height`

**On Exit Edit Mode**:
- `handleExitEditMode` (line 350-424) saves layout immediately (line 395)
- Waits 300ms before allowing exit (line 403)

### 2.2 Block Content Changes (Text, Config)

**User Action**: Edit text block content or block settings

**Flow**:
1. **TextBlock Component** (`baserow-app/components/interface/blocks/TextBlock.tsx`)
   - User edits content → updates local state
   - Calls `onUpdate(blockId, { content_json: ... })`

2. **InterfaceBuilder.handleBlockUpdate** (line 435-605)
   - Calls `/api/pages/${page.id}/blocks` PATCH with `{ blockUpdates: [{ id, config }] }` (line 453-459)
   - Receives response with updated blocks (line 465)
   - **Merges config** into local state (line 520)
   - **Preserves layout** from current state (lines 515-518)

3. **API Route PATCH** (`baserow-app/app/api/pages/[pageId]/blocks/route.ts:170-298)
   - Processes `blockUpdates` array (line 175)
   - Gets current block from DB (line 178-182)
   - Merges config (line 203-206)
   - Normalizes config (line 219-222)
   - **Preserves layout columns** when updating (lines 242-257)
   - Updates `view_blocks.config` (line 252)
   - **SAVES TO**: `view_blocks.config` (JSONB)

**Issue**: Layout preservation logic (lines 515-518 in InterfaceBuilder) may prevent layout updates from API response

---

## 3. LOAD FLOW

### 3.1 Initial Page Load

**Server-Side Rendering**:
1. **Page Route** (`baserow-app/app/pages/[pageId]/page.tsx`)
   - Calls `getInterfacePage(pageId)` (line 20)
   - Loads initial data if `source_view` exists (line 68-75)
   - Passes `initialPage` and `initialData` to `InterfacePageClient` (line 83-88)

2. **InterfacePageClient** (`baserow-app/components/interface/InterfacePageClient.tsx`)
   - Receives `initialPage` prop (line 31)
   - Sets `page` state from `initialPage` (line 37)
   - **Does NOT load blocks on initial render** - blocks loaded separately (line 182-190)

**Client-Side Block Load**:
1. **useEffect Hook** (line 182-190)
   - Triggers `loadBlocks()` for dashboard/overview/content/record_review pages
   - Only runs once per page visit (line 185)

2. **loadBlocks Function** (line 517-650)
   - Calls `/api/pages/${page.id}/blocks` GET (line 528)
   - Maps response to `PageBlock[]` format (lines 535-576)
   - **Merges with existing blocks** unless `forceReload = true` (line 580)
   - **Preserves layout from current state** during merge (line 615)

### 3.2 After Navigation

**Scenario**: User navigates away, then returns to page

**Flow**:
1. **Page Unmounts**: `InterfacePageClient` unmounts, state is lost
2. **Page Remounts**: New `InterfacePageClient` instance created
3. **Server-Side**: `getInterfacePage()` loads page data
4. **Client-Side**: `loadBlocks()` called (line 182-190)
5. **API Call**: `/api/pages/[pageId]/blocks` GET
6. **API Route** (`baserow-app/app/api/pages/[pageId]/blocks/route.ts:13`)
   - Checks if `pageId` is `interface_pages.id` (line 23-27)
   - If yes: queries `view_blocks` with `.eq('page_id', pageId)` (line 35)
   - If no: queries `view_blocks` with `.eq('view_id', pageId)` (line 41)
   - Maps DB format → PageBlock format (lines 55-102)
   - Returns blocks array

7. **Client Receives**: Blocks with saved layout values
8. **State Update**: `setBlocks()` called with loaded blocks
9. **InterfaceBuilder Receives**: `initialBlocks` prop updated
10. **InterfaceBuilder useEffect** (line 75-148)
    - Detects `initialBlocks` change
    - **Merges blocks** (line 106-140)
    - **Uses saved layout values** if `updated.x != null` (line 119)
    - **BUT**: In edit mode, merges config to preserve user state (line 125)

### 3.3 After Page Refresh

**Scenario**: User refreshes browser (F5)

**Flow**:
- Same as "After Navigation" (section 3.2)
- **Additional Issue**: Browser cache may serve stale API response despite `no-cache` headers

### 3.4 Record View Pages

**File**: `baserow-app/components/records/RecordPageClient.tsx`

**Question**: Do record pages use the same canvas renderer?

**Answer**: **NO** - Record pages use `RecordPageClient`, which renders blocks differently:
- Record pages are accessed via `/records/[tableId]/[recordId]` route
- They may use `PageRenderer` component, which conditionally renders `InterfaceBuilder` for dashboard/overview pages
- **Record review pages** (`page_type === 'record_review'`) DO use `InterfaceBuilder` (see `InterfacePageClient.tsx:183`)
- **Regular record pages** may bypass block layout entirely

**File**: `baserow-app/components/interface/PageRenderer.tsx:161-404`
- Renders based on `page.page_type`
- For `record_review`: Uses `InterfaceBuilder` (if blocks exist)
- For other types: Uses different renderers (GridBlock, FormView, etc.)

---

## 4. SOURCE OF TRUTH

### 4.1 Intended Single Source of Truth

**Pages**:
- **Intended**: `interface_pages` table (new system)
- **Legacy**: `views` table where `type='interface'` (old system)
- **Issue**: Both systems coexist, causing confusion

**Blocks**:
- **Intended**: `view_blocks` table
- **Columns**: `position_x`, `position_y`, `width`, `height`, `config` (JSONB)
- **Issue**: Blocks can reference either `view_id` OR `page_id`, creating dual sources

**Layout**:
- **Intended**: `view_blocks.position_x`, `position_y`, `width`, `height`
- **Issue**: Client-side state (`InterfaceBuilder.blocks`) acts as temporary source during editing

### 4.2 Multiple Sources Problem

**YES, there are multiple sources:**

1. **Database**: `view_blocks` table (persisted)
2. **Client State**: `InterfaceBuilder.blocks` (preview/editing)
3. **Client State**: `InterfacePageClient.blocks` (page-level state)
4. **API Response Cache**: Browser/Next.js cache (despite no-cache headers)

### 4.3 Save/Load Path Symmetry

**NO, save and load paths are NOT symmetrical:**

**Save Path**:
- `saveBlockLayout()` checks if `pageId` is `interface_pages.id` → uses `page_id` filter
- Otherwise uses `view_id` filter
- **File**: `baserow-app/lib/pages/saveBlocks.ts:29-35, 76-80`

**Load Path**:
- `loadPageBlocks()` **ONLY uses `view_id`** (never checks `page_id`)
- **File**: `baserow-app/lib/pages/loadPage.ts:57`
- API route GET **DOES** check both (line 23-42), but server-side `loadPageBlocks()` does not

**Result**: 
- If a page uses `interface_pages.id` and blocks are saved with `page_id`, `loadPageBlocks()` won't find them
- Blocks saved with `page_id` won't load via server-side `loadPageBlocks()`
- Blocks load correctly via API route (which checks both), but server-side SSR may fail

---

## 5. RECORD VIEW CHECK

### 5.1 Record Pages Canvas Renderer

**Question**: Do record pages use the same canvas renderer?

**Answer**: **PARTIALLY**

**Record Review Pages** (`page_type === 'record_review'`):
- **YES**: Use `InterfaceBuilder` component (same canvas renderer)
- **File**: `baserow-app/components/interface/InterfacePageClient.tsx:183`
- **File**: `baserow-app/components/interface/PageRenderer.tsx:161-404`
- Blocks are loaded and rendered via `InterfaceBuilder` → `Canvas`

**Regular Record Pages** (`/records/[tableId]/[recordId]`):
- **NO**: Use `RecordPageClient` component
- **File**: `baserow-app/components/records/RecordPageClient.tsx`
- Does NOT use `InterfaceBuilder` or block layout system
- Renders record fields directly, bypasses block system

### 5.2 Record Pages Block Layout

**Question**: Do record pages bypass block layout?

**Answer**: **DEPENDS ON PAGE TYPE**

- **Record Review Pages**: Use block layout (via `InterfaceBuilder`)
- **Regular Record Pages**: Bypass block layout (direct field rendering)

### 5.3 Column Layouts in Record Views

**Question**: Why may column layouts not apply to record views?

**Answer**: 
- Regular record pages (`RecordPageClient`) don't use the block system, so column layouts don't apply
- Record review pages use `InterfaceBuilder`, so column layouts SHOULD apply
- **If column layouts don't apply to record review pages**, it's likely a bug in `PageRenderer` or `InterfaceBuilder` configuration

---

## 6. REPORTED PROBLEMS

### 6.1 Mismatched Tables

**Problem**: Dual table system causes save/load mismatches

**Location**:
- `loadPageBlocks()` only queries `view_id` (`baserow-app/lib/pages/loadPage.ts:57`)
- `saveBlockLayout()` queries both `page_id` and `view_id` (`baserow-app/lib/pages/saveBlocks.ts:76-80`)

**Impact**: Blocks saved with `page_id` won't load via server-side `loadPageBlocks()`

**Severity**: **HIGH** - Causes data loss on server-side rendering

### 6.2 Divergent Loaders

**Problem**: Multiple block loading functions with different logic

**Functions**:
1. `loadPageBlocks()` - Server-side, only uses `view_id`
2. `/api/pages/[pageId]/blocks` GET - Checks both `page_id` and `view_id`
3. `InterfacePageClient.loadBlocks()` - Client-side, calls API route

**Impact**: Inconsistent behavior between server-side and client-side loads

**Severity**: **HIGH** - Causes hydration mismatches

### 6.3 Duplicate State

**Problem**: Block state exists in multiple places

**Locations**:
1. `InterfaceBuilder.blocks` (line 50)
2. `InterfacePageClient.blocks` (line 51)
3. `Canvas` component (receives blocks as prop)
4. `react-grid-layout` internal state

**Impact**: State can become out of sync, causing preview to show different data than persisted

**Severity**: **HIGH** - Root cause of preview vs persisted mismatch

### 6.4 Fallback Logic Overwrites Saved Data

**Problem**: Merge logic preserves current state instead of using saved values

**Location**: `baserow-app/components/interface/InterfaceBuilder.tsx:106-140`

**Issue**:
- Line 125: In edit mode, merges config to "preserve user state"
- This prevents saved content from appearing if user is still in edit mode
- Line 119-122: Uses saved layout values, but only if `updated.x != null`
- If API returns `undefined` for layout (shouldn't happen), falls back to current state

**Impact**: Saved changes don't appear in preview if user is still editing

**Severity**: **CRITICAL** - Direct cause of reported issue

### 6.5 Race Conditions

**Problem**: Timing issues between save and reload

**Locations**:
1. `InterfaceBuilder.handleExitEditMode()` waits 300ms (line 403)
2. `InterfacePageClient` reloads blocks 500ms after exiting edit mode (line 210)
3. Debounced layout save has 500ms delay (line 332)

**Impact**: Reload may happen before save completes, showing stale data

**Severity**: **MEDIUM** - Can cause temporary inconsistencies

### 6.6 Preview State vs Persisted State

**Problem**: Preview shows client state, persisted state is in database

**Root Cause**: 
- During editing, `InterfaceBuilder.blocks` state is updated immediately (line 306-320)
- This creates "preview" that shows unsaved changes
- When user navigates away, client state is lost
- On return, blocks load from database (which may not have latest changes if save failed or was delayed)

**Impact**: Edits appear to work in preview but don't persist

**Severity**: **CRITICAL** - Main reported issue

### 6.7 Text Block Content Persistence

**Problem**: Text content saved in `config.content_json` may not persist

**Location**: `baserow-app/app/api/pages/[pageId]/blocks/route.ts:188-281`

**Issue**:
- Config is normalized (line 219-222), which may modify `content_json`
- Merge logic in `InterfaceBuilder` (line 520) may overwrite saved content with stale state
- If `forceReload` is false, saved content may not appear

**Severity**: **HIGH** - Text edits may not persist

### 6.8 Layout Column Preservation

**Problem**: Layout preservation logic prevents layout updates

**Location**: `baserow-app/components/interface/InterfaceBuilder.tsx:515-518`

**Issue**:
- When updating block config, layout is preserved from current state
- If API response has updated layout, it's ignored unless values differ significantly (>0.1)
- This can prevent layout fixes from being applied

**Severity**: **MEDIUM** - May prevent layout corrections

---

## 7. SUMMARY OF INCONSISTENCIES

### Critical Issues

1. **Asymmetric Save/Load**: `saveBlockLayout()` checks `page_id`, `loadPageBlocks()` only checks `view_id`
2. **State Merge Logic**: Edit mode merge preserves user state, preventing saved content from appearing
3. **Preview vs Persisted**: Client state shows unsaved changes, database has persisted state

### High Severity Issues

4. **Multiple State Sources**: Blocks exist in `InterfaceBuilder`, `InterfacePageClient`, and database
5. **Text Content Persistence**: Config merge may overwrite saved `content_json`
6. **Divergent Loaders**: Server-side and client-side loaders use different logic

### Medium Severity Issues

7. **Race Conditions**: Timing issues between save and reload
8. **Layout Preservation**: Over-aggressive layout preservation prevents updates

---

## 8. DATA FLOW DIAGRAMS

### Save Flow (Layout)
```
User Drag/Resize
  → Canvas.onLayoutChange
  → InterfaceBuilder.handleLayoutChange (update local state)
  → Debounce 500ms
  → InterfaceBuilder.saveLayout
  → PATCH /api/pages/[pageId]/blocks { layout }
  → saveBlockLayout()
  → Check: interface_pages.id? → page_id : view_id
  → UPDATE view_blocks SET position_x, position_y, width, height
```

### Load Flow (After Navigation)
```
Page Navigation
  → Server: getInterfacePage(pageId)
  → Client: InterfacePageClient mounts
  → useEffect triggers loadBlocks()
  → GET /api/pages/[pageId]/blocks
  → API checks: interface_pages.id? → page_id : view_id
  → SELECT * FROM view_blocks WHERE (page_id OR view_id) = pageId
  → Map DB format → PageBlock format
  → setBlocks(loadedBlocks)
  → InterfaceBuilder receives initialBlocks prop
  → useEffect merges blocks
  → IF edit mode: preserve user state (config merge)
  → ELSE: use saved values
```

### Problem Flow (Why Edits Don't Persist)
```
User Edits Block
  → Local state updated (preview shows change)
  → Save triggered (debounced or on exit)
  → Database updated
  → User navigates away
  → Local state LOST
  → User returns
  → Blocks loaded from database
  → IF still in edit mode: merge preserves OLD local state
  → Saved changes NOT visible
```

---

## END OF REPORT

**Note**: This report identifies problems only. No fixes or refactoring suggestions are provided, as requested.
