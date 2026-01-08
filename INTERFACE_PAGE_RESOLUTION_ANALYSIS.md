# Interface Page Resolution Analysis

## Executive Summary

This report explains how interface pages are resolved for navigation and rendering. Pages are **always identified by UUID (pageId)**, never by name. Navigation uses explicit page IDs from the URL route parameter. Fallback logic exists only for landing page resolution (root `/` route).

---

## 1. WHERE pageId COMES FROM FOR InterfacePageClient

### 1.1 Route Parameter Extraction

**File**: `baserow-app/app/pages/[pageId]/page.tsx`

**Flow**:
1. Next.js route: `/pages/[pageId]` → extracts `pageId` from URL
2. Server component receives: `params: Promise<{ pageId: string }>`
3. Extracts: `const { pageId } = await params` (line 14)
4. Passes to `InterfacePageClient`: `<InterfacePageClient pageId={pageId} ... />` (line 84)

**Source**: **URL route parameter** - always a UUID string from the URL path

### 1.2 Alternative Route (Legacy)

**File**: `baserow-app/app/interface/[pageId]/page.tsx`

**Flow**:
1. Route: `/interface/[pageId]`
2. Checks if page exists in `interface_pages` table (line 16)
3. If found: Redirects to `/pages/${pageId}` (line 19)
4. If not found: Tries old `views` table (line 23-28)
5. Passes `pageId` to `InterfacePageClient` (line 37)

**Purpose**: Backward compatibility for old `/interface/` routes

---

## 2. HOW SIDEBAR DETERMINES WHICH PAGE TO NAVIGATE TO

### 2.1 Sidebar Page Loading

**File**: `components/navigation/Sidebar.tsx`

**Selection Logic** (lines 80-110):
1. **Query**: Loads ALL pages from `interface_pages` table
   ```typescript
   .from('interface_pages')
   .select('id, name, group_id, order_index, is_admin_only')
   .order('order_index', { ascending: true })
   ```
2. **Filtering**: Filters by `is_admin_only` for non-admin users (line 87-89)
3. **Grouping**: Groups pages by `group_id` into `interfacePagesByGroup` Map (lines 97-109)
4. **No Selection**: Sidebar does NOT select a specific page - it loads ALL accessible pages

### 2.2 Sidebar Navigation Links

**File**: `components/navigation/InterfaceSection.tsx`

**Navigation Logic** (lines 50-58):
1. **Sorts pages** by `order_index` (line 33)
2. **Renders links** for each page:
   ```typescript
   <SidebarItem
     key={page.id}
     id={page.id}
     label={page.name}
     href={`/pages/${page.id}`}  // ← Uses page.id (UUID)
     icon="file-text"
     level={1}
   />
   ```
3. **Navigation**: Uses `page.id` (UUID) in href, NOT page name

**File**: `components/navigation/SidebarItem.tsx`

**Link Generation** (lines 54-57):
- Uses `href` prop directly (which is `/pages/${page.id}`)
- No name-based lookup or resolution

### 2.3 Summary: Sidebar Navigation

- **Always uses explicit pageId**: `/pages/${page.id}` where `page.id` is a UUID
- **Never uses name**: Page name is only for display (`label={page.name}`)
- **No name-based resolution**: No code path that looks up page by name
- **No ambiguity**: Each link has a unique UUID

---

## 3. ARE PAGES EVER SELECTED BY NAME, ORDER, GROUP, OR DEFAULT?

### 3.1 By Name: **NO**

**Evidence**:
- No database queries that filter by `name`
- No code that searches for pages by name
- Sidebar uses `page.id` in hrefs, not name
- Route parameter is always UUID, never name

**Exception**: Display only - `page.name` is shown in sidebar labels

### 3.2 By Order: **YES, BUT ONLY FOR DISPLAY**

**File**: `components/navigation/InterfaceSection.tsx:33`
```typescript
const sortedPages = [...pages].sort((a, b) => a.order_index - b.order_index)
```

**Purpose**: Determines **display order** in sidebar, NOT which page to navigate to

**File**: `components/navigation/Sidebar.tsx:84`
```typescript
.order('order_index', { ascending: true })
```

**Purpose**: Determines **load order** from database, NOT which page to select

### 3.3 By Group: **YES, BUT ONLY FOR ORGANIZATION**

**File**: `components/navigation/Sidebar.tsx:97-109`
```typescript
pagesData.forEach((page) => {
  const groupId = page.group_id
  if (groupId) {
    if (!interfacePagesByGroup.has(groupId)) {
      interfacePagesByGroup.set(groupId, [])
    }
    interfacePagesByGroup.get(groupId)!.push({
      id: page.id,
      name: page.name,
      order_index: page.order_index || 0,
    })
  }
})
```

**Purpose**: Groups pages for **sidebar organization**, NOT for selection

**File**: `components/navigation/Sidebar.tsx:163-176`
- Renders `InterfaceSection` for each group
- Each section shows all pages in that group
- Navigation still uses explicit `page.id`

### 3.4 By Default: **YES, BUT ONLY FOR LANDING PAGE**

**File**: `baserow-app/lib/interfaces.ts:241-352` - `resolveLandingPage()`

**Priority Order** (for root `/` route only):
1. **User default page**: `profiles.default_page_id` (lines 253-283)
2. **Workspace default page**: `workspace_settings.default_interface_id` (lines 286-315)
3. **First accessible page**: First page from `getAccessibleInterfacePages()` (lines 318-324)
4. **First page fallback**: First page from `interface_pages` table ordered by `order_index` (lines 328-341)

**File**: `baserow-app/app/page.tsx:57-74`
- Calls `resolveLandingPage()` to get `pageId`
- Redirects to `/pages/${pageId}` if found
- Fallback: Uses `accessiblePages[0].id` (first accessible page)

**Scope**: **ONLY applies to root route (`/`)**, not to explicit page navigation

---

## 4. FALLBACK LOGIC FOR "FIRST" PAGE

### 4.1 Landing Page Resolution (Root Route)

**File**: `baserow-app/app/page.tsx:67-74`

**Fallback Chain**:
1. Try `resolveLandingPage()` → returns `pageId` or `null`
2. If `pageId` exists and is accessible → redirect to `/pages/${pageId}`
3. **Fallback**: If no resolved pageId, use `accessiblePages[0].id` (first accessible page)
4. **Final Fallback**: Show empty state if no accessible pages

**File**: `baserow-app/lib/interfaces.ts:317-324`

**First Accessible Page Selection**:
```typescript
const accessiblePages = await getAccessibleInterfacePages()
if (accessiblePages.length > 0) {
  return { pageId: accessiblePages[0].id, reason: 'first_accessible' }
}
```

**File**: `baserow-app/lib/interfaces.ts:200-233` - `getAccessibleInterfacePages()`

**Selection Logic**:
1. Queries `interface_pages` table
2. Orders by `order_index` ascending (line 208)
3. Orders by `created_at` descending (line 209)
4. Filters by `is_admin_only` for non-admins (line 212-214)
5. Returns first page: `accessiblePages[0].id`

**File**: `baserow-app/lib/interfaces.ts:328-341` - Final Fallback

**Last Resort**:
```typescript
const { data: anyPages } = await supabase
  .from('interface_pages')
  .select('id')
  .order('order_index', { ascending: true })
  .order('created_at', { ascending: true })
  .limit(1)
```

**Selection**: First page by `order_index`, then `created_at` (ignores admin-only filter)

### 4.2 Fallback for Error Cases

**File**: `baserow-app/app/page.tsx:112-132`

**Fallback to Old System**:
- If `resolveLandingPage()` throws error
- Queries `views` table where `type='interface'`
- Orders by `order_index`, then `created_at`
- Selects first result: `firstInterface.id`
- Redirects to `/pages/${firstInterface.id}`

### 4.3 Summary: Fallback Logic

**Applies ONLY to**:
- Root route (`/`) - landing page resolution
- Error cases when default resolution fails

**Does NOT apply to**:
- Explicit page navigation (`/pages/[pageId]`)
- Sidebar navigation (always uses explicit pageId)
- Direct URL access (always uses route parameter)

**Selection Criteria** (in order):
1. User default (`profiles.default_page_id`)
2. Workspace default (`workspace_settings.default_interface_id`)
3. First accessible page (by `order_index`, then `created_at`)
4. First page (any, by `order_index`, then `created_at`)
5. First interface from `views` table (legacy fallback)

---

## 5. CAN MULTIPLE PAGES WITH SAME NAME EXIST?

### 5.1 Database Schema

**File**: `supabase/schema.sql:272-288`

**Table**: `interface_pages`
- `id` UUID PRIMARY KEY (unique)
- `name` TEXT NOT NULL (no unique constraint)
- `group_id` UUID (nullable, no unique constraint on name+group_id)

**Constraint Analysis**:
- **NO unique constraint on `name`**
- **NO unique constraint on `(name, group_id)`**
- **NO unique constraint on `(name, group_id, page_type)`**

**Conclusion**: **YES, multiple pages CAN have the same name**

### 5.2 How Are They Distinguished?

**By UUID Only**:
- Navigation always uses `page.id` (UUID)
- Route parameter is UUID: `/pages/[pageId]`
- Sidebar links use UUID: `href={`/pages/${page.id}`}`
- No name-based lookup exists

**Display Ambiguity**:
- Sidebar shows pages with same name as separate items
- User must distinguish by:
  - Position in sidebar (order_index)
  - Group context (which InterfaceSection)
  - Clicking to see which page loads

### 5.3 Name Collision Scenarios

**Scenario 1: Same name, different groups**
- Page "Dashboard" in group "Marketing"
- Page "Dashboard" in group "Sales"
- **Distinguished by**: Group context in sidebar, different UUIDs

**Scenario 2: Same name, same group**
- Two pages both named "Overview" in same group
- **Distinguished by**: Order in sidebar, different UUIDs
- **Problem**: User cannot tell which is which without clicking

**Scenario 3: Same name, different page types**
- Page "Dashboard" (type: dashboard)
- Page "Dashboard" (type: overview)
- **Distinguished by**: UUID only (no type shown in sidebar)

### 5.4 Code That Handles Name Collisions

**Answer**: **NONE**

- No validation prevents duplicate names
- No code resolves name collisions
- No code selects "first" page by name
- Navigation always uses UUID, so collisions don't break functionality
- **User experience issue**: Ambiguous display names

---

## 6. EXACT SELECTION LOGIC SUMMARY

### 6.1 Explicit Page Navigation (`/pages/[pageId]`)

**Selection**: **NONE** - pageId comes from URL route parameter

**File**: `baserow-app/app/pages/[pageId]/page.tsx:14`
```typescript
const { pageId } = await params  // From URL
```

**Resolution**:
1. Try `getInterfacePage(pageId)` → queries `interface_pages` by `id` (line 20)
2. If not found: Try `views` table by `id` where `type='interface'` (line 26-30)
3. If not found: Render with `page = null` (shows "not found" UI)

**No fallback**: Explicit pageId must exist or shows error

### 6.2 Sidebar Navigation

**Selection**: **NONE** - pageId comes from pre-loaded page data

**File**: `components/navigation/InterfaceSection.tsx:50-58`
- Renders links for each page in `pages` array
- Each link uses `page.id` (UUID) from loaded data
- No runtime selection - all pages already loaded

### 6.3 Landing Page (Root Route `/`)

**Selection**: **YES** - uses fallback chain

**File**: `baserow-app/app/page.tsx:57-74`

**Logic**:
1. Call `resolveLandingPage()` → returns `{ pageId, reason }`
2. If `pageId` exists and is in `accessiblePages` → redirect to `/pages/${pageId}`
3. **Fallback**: Use `accessiblePages[0].id` (first accessible page)
4. **Final Fallback**: Show empty state

**File**: `baserow-app/lib/interfaces.ts:241-352` - `resolveLandingPage()`

**Priority**:
1. `profiles.default_page_id` (if exists and accessible)
2. `workspace_settings.default_interface_id` (if exists and accessible)
3. First page from `getAccessibleInterfacePages()` (by `order_index`, then `created_at`)
4. First page from `interface_pages` (any, by `order_index`, then `created_at`)

---

## 7. AMBIGUITY AND FALLBACK BEHAVIOUR

### 7.1 Ambiguities Found

**1. Multiple Pages with Same Name**
- **Issue**: No unique constraint on `name`
- **Impact**: Sidebar shows duplicate names, user confusion
- **Resolution**: None - navigation works (uses UUID) but UX is poor

**2. Pages Without group_id**
- **Issue**: Pages can have `group_id = null`
- **Impact**: Not shown in sidebar (line 99: `if (groupId)`)
- **Resolution**: Pages without group_id are excluded from navigation

**3. Legacy System Fallback**
- **Issue**: Two page systems (`interface_pages` and `views` table)
- **Impact**: `/pages/[pageId]` checks both systems (line 20-30)
- **Resolution**: Backward compatibility, but creates ambiguity about which system a pageId belongs to

**4. Order Selection Ambiguity**
- **Issue**: When multiple pages have same `order_index`, selection is non-deterministic
- **Impact**: "First accessible page" might vary between queries
- **Resolution**: Secondary sort by `created_at` (line 209, 333)

### 7.2 Fallback Behaviours

**Landing Page Fallbacks** (in order):
1. User default page → Workspace default page → First accessible → First any → Legacy views table → Empty state

**Page Not Found Fallbacks**:
- **File**: `baserow-app/app/pages/[pageId]/page.tsx:32-39`
- **Behavior**: Renders with `page = null`, shows "Page Not Found" UI
- **No redirect**: Explicitly avoids redirect loops

**Permission Denied Fallbacks**:
- **File**: `baserow-app/app/pages/[pageId]/page.tsx:42-49, 56-63`
- **Behavior**: Renders with `page = null`, shows "Access Denied" UI
- **No redirect**: Explicitly avoids redirect loops

---

## 8. FILE PATHS AND EXACT SELECTION LOGIC

### 8.1 Route Handler

**File**: `baserow-app/app/pages/[pageId]/page.tsx`
- **Line 14**: Extracts `pageId` from route params
- **Line 20**: Calls `getInterfacePage(pageId)` → queries `interface_pages` by `id`
- **Line 26-30**: Fallback to `views` table by `id` where `type='interface'`
- **Line 84**: Passes `pageId` to `InterfacePageClient`

### 8.2 Page Loading Function

**File**: `baserow-app/lib/interface/pages.ts:35-55` - `getInterfacePage()`

**Query**:
```typescript
.from('interface_pages')
.select('*')
.eq('id', pageId)  // ← Exact match by UUID
.maybeSingle()
```

**Selection**: **Exact UUID match** - no fallback, no name lookup

### 8.3 Sidebar Page Loading

**File**: `components/navigation/Sidebar.tsx:81-91`

**Query**:
```typescript
.from('interface_pages')
.select('id, name, group_id, order_index, is_admin_only')
.order('order_index', { ascending: true })  // ← For display order only
```

**Selection**: **All accessible pages** - no single page selection

### 8.4 Landing Page Resolution

**File**: `baserow-app/lib/interfaces.ts:241-352` - `resolveLandingPage()`

**Selection Logic** (lines 317-324):
```typescript
const accessiblePages = await getAccessibleInterfacePages()
if (accessiblePages.length > 0) {
  return { pageId: accessiblePages[0].id, reason: 'first_accessible' }
}
```

**File**: `baserow-app/lib/interfaces.ts:200-233` - `getAccessibleInterfacePages()`

**Query**:
```typescript
.from('interface_pages')
.select('id, name, group_id, created_at, updated_at, is_admin_only')
.order('order_index', { ascending: true })  // ← Primary sort
.order('created_at', { ascending: false })  // ← Secondary sort
```

**Selection**: **First page** by `order_index` (ascending), then `created_at` (descending)

---

## 9. SUMMARY: SELECTION MECHANISMS

### 9.1 Explicit Navigation (Sidebar, Direct URL)

**Mechanism**: **UUID from URL route parameter**
- Sidebar: `href={`/pages/${page.id}`}` → pageId from pre-loaded data
- Direct URL: `/pages/[pageId]` → pageId from route params
- **No selection logic**: pageId is explicit

### 9.2 Landing Page (Root Route)

**Mechanism**: **Fallback chain with priority order**
1. User default (`profiles.default_page_id`)
2. Workspace default (`workspace_settings.default_interface_id`)
3. First accessible page (by `order_index`, then `created_at`)
4. First any page (by `order_index`, then `created_at`)
5. Legacy views table (by `order_index`, then `created_at`)

### 9.3 Page Resolution (Given pageId)

**Mechanism**: **Direct database lookup by UUID**
1. Query `interface_pages` by `id = pageId`
2. If not found: Query `views` by `id = pageId` where `type='interface'`
3. If not found: Render "not found" UI

---

## 10. ANSWERS TO SPECIFIC QUESTIONS

### Q1: Where does the pageId passed to InterfacePageClient come from?

**Answer**: **URL route parameter** (`/pages/[pageId]`)

**Flow**:
1. User clicks sidebar link → navigates to `/pages/${page.id}`
2. Next.js extracts `pageId` from URL
3. Server component receives `params: Promise<{ pageId: string }>`
4. Extracts: `const { pageId } = await params`
5. Passes to: `<InterfacePageClient pageId={pageId} />`

**Files**:
- `baserow-app/app/pages/[pageId]/page.tsx:14, 84`

### Q2: How does the sidebar determine which page to navigate to?

**Answer**: **Pre-loaded page data with explicit UUIDs**

**Flow**:
1. Sidebar loads all pages from `interface_pages` table
2. Groups pages by `group_id`
3. Renders `InterfaceSection` for each group
4. Each section renders `SidebarItem` for each page
5. Each item has `href={`/pages/${page.id}`}` (explicit UUID)
6. User clicks → navigates to URL with UUID
7. Route handler extracts UUID and loads page

**Files**:
- `components/navigation/Sidebar.tsx:81-110` (load pages)
- `components/navigation/InterfaceSection.tsx:50-58` (render links)
- `components/navigation/SidebarItem.tsx:54-57` (generate href)

**No runtime selection**: All pages loaded upfront, links use explicit UUIDs

### Q3: Are pages ever selected by name, order, group, or default instead of explicit ID?

**Answer**: **YES, but ONLY for landing page (root route)**

**By Name**: **NO** - never used for selection
- Name is display-only
- No queries filter by name
- No name-based resolution

**By Order**: **YES** - for landing page fallback only
- `resolveLandingPage()` selects first page by `order_index`
- Only applies to root `/` route
- Explicit navigation always uses UUID

**By Group**: **YES** - for organization only
- Groups pages for sidebar display
- Does NOT select a page from group
- Navigation still uses explicit UUID

**By Default**: **YES** - for landing page only
- User default: `profiles.default_page_id`
- Workspace default: `workspace_settings.default_interface_id`
- Only applies to root `/` route
- Explicit navigation always uses UUID

**Files**:
- Landing page: `baserow-app/lib/interfaces.ts:241-352`
- Explicit navigation: Always uses UUID from route

### Q4: Is there any fallback logic that selects the "first" page in a group?

**Answer**: **NO** - no group-based "first page" selection

**Evidence**:
- `getInterfacePagesByGroup()` returns ALL pages in group (line 60-78)
- Sidebar renders ALL pages in each group (line 50-58)
- No code selects "first" page from a group
- Landing page selects first page overall (not per group)

**Exception**: Landing page selects first accessible page overall (not per group)

**Files**:
- `baserow-app/lib/interface/pages.ts:60-78` - Returns all pages in group
- `components/navigation/InterfaceSection.tsx:50-58` - Renders all pages

### Q5: Can multiple interface_pages with the same name exist and be navigated interchangeably?

**Answer**: **YES, they CAN exist, but NO, they are NOT interchangeable**

**Existence**:
- Database allows duplicate names (no unique constraint)
- Multiple pages can have same `name` value
- Can exist in same group or different groups

**Navigation**:
- **NOT interchangeable**: Each page has unique UUID
- Navigation uses UUID, not name
- `/pages/[pageId]` requires exact UUID match
- Sidebar shows separate links for each (even if same name)

**Distinction**:
- **By UUID**: Each page has unique `id` (UUID)
- **By Position**: Different `order_index` values
- **By Group**: Different `group_id` values (if in different groups)
- **NOT by Name**: Name is not unique identifier

**User Experience Issue**:
- Sidebar shows duplicate names
- User cannot distinguish without clicking
- Navigation works correctly (uses UUID) but UX is confusing

**Files**:
- Schema: `supabase/schema.sql:272-288` (no unique constraint on name)
- Navigation: Always uses UUID, never name

---

## END OF REPORT

**Key Findings**:
1. **pageId always comes from URL route parameter** (UUID)
2. **Sidebar uses explicit UUIDs** from pre-loaded page data
3. **Name/order/group/default selection ONLY for landing page** (root route)
4. **No "first page in group" fallback** - all pages shown
5. **Multiple pages with same name CAN exist** but are NOT interchangeable (distinguished by UUID)
