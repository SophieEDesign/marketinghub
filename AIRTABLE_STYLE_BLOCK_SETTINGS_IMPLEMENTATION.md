# Airtable-Style Block Settings Implementation

## Overview
Implemented a comprehensive block settings system with three-tab structure (Data, Appearance, Advanced) matching Airtable's interface design patterns.

## Completed Components

### 1. Settings Panel Refactor ✅
- **File**: `baserow-app/components/interface/SettingsPanel.tsx`
- **Features**:
  - Three-tab structure: Data, Appearance, Advanced
  - Auto-save with debouncing (1.5s)
  - Visual save status indicators
  - Proper state management

### 2. Common Settings Components ✅
- **CommonAppearanceSettings.tsx**: Shared appearance settings (title, colors, borders, padding)
- **AdvancedSettings.tsx**: Block locking, visibility rules, permissions, block actions

### 3. Block-Specific Settings ✅

#### KPI Block
- **KPIDataSettings.tsx**:
  - Table selection
  - View selection (optional)
  - Metric (count/sum/avg/min/max)
  - Field selection (for non-count metrics)
  - Label
  - Comparison (with date ranges)
  - Target value
  - Click-through view
- **KPIAppearanceSettings.tsx**:
  - Number format (standard/compact/decimal/percent)
  - Trend indicator toggle
  - Alignment (left/center/right)
  - Value size (small/medium/large/xlarge)

#### Chart Block
- **ChartDataSettings.tsx**:
  - Table selection
  - View selection (optional)
  - Chart type (bar/line/pie/stacked_bar)
  - Group by field
  - X-axis field
  - Metric field
  - Time field (for line charts)
  - Sort field
  - Row limit
- **ChartAppearanceSettings.tsx**:
  - Legend toggle
  - Legend position (top/bottom/left/right)
  - Color scheme
  - Grid lines toggle

#### Table Snapshot Block
- **TableSnapshotDataSettings.tsx**:
  - Table selection
  - Saved view (required)
  - Row limit
- **TableSnapshotAppearanceSettings.tsx**:
  - Row height (compact/normal/comfortable)
  - Show headers toggle
  - Highlight rules (placeholder)

#### Text Block
- **TextDataSettings.tsx**:
  - Content textarea
  - Markdown toggle
- **TextAppearanceSettings.tsx**:
  - Text size (small/medium/large/xlarge)
  - Alignment (left/center/right/justify)

#### Action Block
- **ActionDataSettings.tsx**:
  - Label
  - Action type (navigate/create_record/redirect)
  - Target (route/table/URL based on action type)
  - Confirmation message
- **ActionAppearanceSettings.tsx**:
  - Button style (primary/secondary/outline/ghost)
  - Icon selection

#### Link Preview Block
- **LinkPreviewDataSettings.tsx**:
  - External URL
  - Display name override
  - Description
- **LinkPreviewAppearanceSettings.tsx**:
  - Display mode (compact/card)
  - Provider badge toggle
  - Thumbnail toggle

## Remaining Work

### 1. Page Type Selection System ⏳
**Status**: Partially implemented (needs enhancement)

**Current State**:
- Page type templates exist in database
- `NewPageModal.tsx` has basic page type selection
- `PagesTab.tsx` has simple dropdown

**Required Enhancements**:
- Card-style page type selector with icons and descriptions
- Page types: Blank, Dashboard, List, Calendar, Timeline, Record Review, Form, Overview, Custom
- Visual preview of each page type
- Better grouping and categorization

**Files to Update**:
- `baserow-app/components/settings/PagesTab.tsx`
- `baserow-app/components/interface/NewPageModal.tsx`
- Create `baserow-app/components/interface/PageTypeSelector.tsx`

### 2. Record Pages ⏳
**Status**: Not implemented

**Requirements**:
- Dedicated record view/edit page per table
- Header section (record title, actions)
- Body sections (field groups)
- Optional sidebar (related records, activity)
- Permission-aware (respect table/field permissions)

**Files to Create**:
- `baserow-app/app/tables/[tableId]/records/[recordId]/page.tsx`
- `baserow-app/components/records/RecordPage.tsx`
- `baserow-app/components/records/RecordHeader.tsx`
- `baserow-app/components/records/RecordBody.tsx`
- `baserow-app/components/records/RecordSidebar.tsx`

### 3. Additional Enhancements ⏳
- Visibility rules UI (currently placeholder)
- Permission settings UI (currently placeholder)
- Highlight rules editor for Table Snapshot
- Filter builder for KPI/Chart blocks
- Time range picker improvements

## Technical Notes

### Settings Panel Architecture
- All blocks use the same three-tab structure
- Data tab: Block-specific configuration
- Appearance tab: Visual styling (block-specific + common)
- Advanced tab: Locking, visibility, permissions, actions

### State Management
- Config state managed in `SettingsPanel.tsx`
- Auto-save debounced to 1.5 seconds
- Visual feedback for save status
- Proper cleanup of timeouts

### Component Structure
```
SettingsPanel.tsx (main container)
├── Tabs (Data/Appearance/Advanced)
├── Data Settings (block-specific)
│   ├── KPIDataSettings
│   ├── ChartDataSettings
│   ├── TableSnapshotDataSettings
│   ├── TextDataSettings
│   ├── ActionDataSettings
│   └── LinkPreviewDataSettings
├── Appearance Settings
│   ├── Block-specific appearance
│   └── CommonAppearanceSettings
└── Advanced Settings
    └── AdvancedSettings
```

## Usage

### Opening Settings Panel
1. Enter edit mode on an interface page
2. Click the settings icon on any block
3. Settings panel opens on the right side

### Configuring a Block
1. Select appropriate tab (Data/Appearance/Advanced)
2. Make changes to settings
3. Changes auto-save after 1.5 seconds
4. Manual save button available in footer

### Block Locking
1. Go to Advanced tab
2. Toggle "Lock Block"
3. Block becomes read-only in view mode

## Next Steps

1. **Enhance Page Type Selection**:
   - Create card-based selector component
   - Add visual previews
   - Improve categorization

2. **Implement Record Pages**:
   - Create record page route
   - Build record header component
   - Build record body with field groups
   - Add sidebar for related records

3. **Complete Advanced Features**:
   - Visibility rules builder
   - Permission settings UI
   - Highlight rules editor

