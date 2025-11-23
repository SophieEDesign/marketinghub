# Phase 2 Complete Implementation Guide

## 🎯 Goal
Complete integration of all workspace systems with Airtable-style interactions and full feature parity.

## ✅ Already Completed

### Dashboard System
- ✅ Modular dashboard with drag-and-drop
- ✅ 7 module types (KPI, Pipeline, Tasks, Events, Calendar, Table Preview, Custom Embed)
- ✅ API routes for dashboards and modules
- ✅ Database tables created
- ✅ React-grid-layout integration

### Grid Components Created
- ✅ ResizableHeader.tsx
- ✅ ColumnMenu.tsx
- ✅ EnhancedColumnHeader.tsx
- ✅ ViewMenu.tsx
- ✅ ViewFilterPanel.tsx
- ✅ ViewSortPanel.tsx

## 🔧 Critical Fixes Needed

### 1. Grid View (Priority: CRITICAL)

#### 1.1 Horizontal Scroll Fix
**Status:** ✅ STARTED
**File:** `components/views/GridView.tsx`
**Changes:**
```tsx
// BEFORE:
<div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 ...">

// AFTER:
<div className="flex-1 w-full min-w-0 overflow-hidden">
  <div className="overflow-auto w-full min-w-0 ...">
```

#### 1.2 Column Resizing
**Status:** ⏳ TODO
**Files to Update:**
- `components/views/GridView.tsx` - Replace SortableColumnHeader with EnhancedColumnHeader
- Integrate ResizableHeader
- Load/save column_widths from viewConfig

#### 1.3 Column Reordering
**Status:** ✅ PARTIAL (DnD exists, needs viewConfig integration)
**Files to Update:**
- `components/views/GridView.tsx` - Save to viewConfig.column_order

#### 1.4 Column Menu
**Status:** ⏳ TODO
**Files to Update:**
- `components/views/GridView.tsx` - Use EnhancedColumnHeader (includes ColumnMenu)

#### 1.5 Filters & Sorts
**Status:** ⏳ TODO
**Files to Update:**
- `components/views/GridView.tsx` - Apply filters before render
- `components/views/ViewHeader.tsx` - Use ViewFilterPanel and ViewSortPanel
- Save to viewConfig.filters and viewConfig.sort

#### 1.6 Field Grouping
**Status:** ⏳ TODO
**Files to Create:**
- `components/grid/SortableGroup.tsx`
- `components/grid/SortableGroupField.tsx`
**Files to Update:**
- `components/views/GridView.tsx` - Render groups, save to viewConfig.groupings

### 2. Views System (Priority: HIGH)

#### 2.1 Complete View Config Integration
**Status:** ⏳ TODO
**Files to Update:**
- `components/views/GridView.tsx` - Use useViewConfigs instead of useViewSettings
- Load: column_order, column_widths, hidden_columns, filters, sort, groupings
- Save all changes to viewConfig

#### 2.2 View Menu Integration
**Status:** ⏳ TODO
**Files to Update:**
- `components/views/ViewHeader.tsx` - Add ViewMenu component
- Implement: rename, duplicate, delete, set default

#### 2.3 Filter/Sort Panels
**Status:** ⏳ TODO
**Files to Update:**
- `components/views/ViewHeader.tsx` - Replace FilterPanel/SortPanel with ViewFilterPanel/ViewSortPanel

### 3. Field Loading (Priority: MEDIUM)

#### 3.1 Complete Default Fields
**Status:** ⏳ TODO
**File:** `lib/tableMetadata.ts`
**Tables Missing:**
- briefings
- sponsorships
- strategy

#### 3.2 Fix Field Merging
**Status:** ⏳ TODO
**File:** `lib/useFields.ts` or similar
**Issue:** Empty fields array when table_fields is empty

### 4. Layout & Sidebar (Priority: MEDIUM)

#### 4.1 Sticky Sidebar
**Status:** ⏳ TODO
**File:** `components/sidebar/Sidebar.tsx`
**Changes:**
```tsx
// Add to root div:
className="sticky top-0 h-screen overflow-y-auto ..."
```

#### 4.2 Compact/Comfortable Toggle
**Status:** ⏳ TODO
**Files to Create:**
- Settings UI for density toggle
**Files to Update:**
- All views to respect density setting
- Save to settings table

### 5. Card & Calendar Views (Priority: LOW)

#### 5.1 Card View Editing
**Status:** ⏳ TODO
**File:** `components/views/CardsView.tsx`
**Change:** onClick already opens drawer (verify it works)

#### 5.2 Calendar Multi-Date
**Status:** ⏳ TODO
**File:** `components/views/CalendarView.tsx`
**Changes:**
- Support start_date + end_date
- Multi-day event rendering
- Month/Week/Day modes

### 6. Timeline (Priority: LOW)

#### 6.1 Horizontal Scroll Fix
**Status:** ⏳ TODO
**File:** `components/views/TimelineView.tsx`
**Changes:**
- Wrap timeline rows in overflow-auto
- Prevent page-level horizontal scroll

#### 6.2 Zoom Modes
**Status:** ⏳ TODO
**File:** `components/views/TimelineView.tsx`
**Add:** Week/Month/Quarter toggles

### 7. Dashboard Integration (Priority: LOW)

#### 7.1 Full Width
**Status:** ⏳ TODO
**File:** `components/dashboard/Dashboard.tsx`
**Changes:**
- Remove max-width constraints
- Ensure flex-1, width: 100%

#### 7.2 Dashboard Selector
**Status:** ⏳ TODO
**File:** `components/sidebar/Sidebar.tsx`
**Add:** Dashboard dropdown with create option

### 8. Table Management (Priority: LOW)

#### 8.1 Tables Screen
**Status:** ⏳ TODO
**Files to Create:**
- `app/settings/tables/page.tsx`
**Features:**
- List all tables
- Add/edit/delete tables
- Manage fields

### 9. Automations UI (Priority: LOW)

#### 9.1 Automations Screen
**Status:** ⏳ TODO
**Files to Create:**
- `app/settings/automations/page.tsx`
**Features:**
- List automations
- Add/edit/delete
- Enable/disable

## 📋 Implementation Checklist

### Phase 2A: Critical Grid Fixes (2-3 hours)
- [ ] Complete horizontal scroll fix
- [ ] Integrate ResizableHeader
- [ ] Integrate EnhancedColumnHeader
- [ ] Fix filters & sorts application
- [ ] Implement field grouping

### Phase 2B: Views System (2-3 hours)
- [ ] Migrate to useViewConfigs
- [ ] Integrate ViewMenu
- [ ] Integrate ViewFilterPanel/ViewSortPanel
- [ ] Save/load all view config properties

### Phase 2C: Field Loading & Layout (1-2 hours)
- [ ] Complete default fields for all tables
- [ ] Fix field merging
- [ ] Make sidebar sticky
- [ ] Add density toggle

### Phase 2D: Other Views (2-3 hours)
- [ ] Fix Card view editing
- [ ] Calendar multi-date support
- [ ] Timeline scroll & zoom

### Phase 2E: Dashboard & Polish (1-2 hours)
- [ ] Dashboard full width
- [ ] Dashboard selector
- [ ] Global scroll fixes
- [ ] UI polish

## 🚀 Quick Start

1. **Start with Grid View fixes** (highest impact)
2. **Complete Views System** (enables all features)
3. **Fix Field Loading** (prevents empty states)
4. **Layout & Sidebar** (UX improvement)
5. **Other views** (nice to have)

## 📝 Notes

- All components are created, need integration
- API routes exist for views
- Database migrations ready
- Focus on integration over new features

