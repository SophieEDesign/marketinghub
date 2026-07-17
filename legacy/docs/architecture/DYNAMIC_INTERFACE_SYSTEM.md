# Dynamic Airtable-Style Interface System

## Overview

This document describes the fully dynamic interface system implemented for the Marketing Hub. All interfaces, categories, views, and permissions are stored in Supabase and loaded dynamically - nothing is hardcoded.

## Database Schema

### New Tables Created

1. **`interface_categories`** - Sidebar sections (e.g., Marketing, Social Media, Reporting)
   - `id` (uuid, PK)
   - `name` (text)
   - `icon` (text, nullable)
   - `position` (integer)
   - `created_at`, `updated_at`

2. **`interfaces`** - Primary interface pages (replaces views with type='interface')
   - `id` (uuid, PK)
   - `name` (text)
   - `description` (text, nullable)
   - `category_id` (uuid, FK → interface_categories)
   - `icon` (text, nullable)
   - `is_default` (boolean) - Only one can be true
   - `created_at`, `updated_at`

3. **`interface_views`** - Junction table linking interfaces to views (tabs)
   - `id` (uuid, PK)
   - `interface_id` (uuid, FK → interfaces)
   - `view_id` (uuid, FK → views)
   - `position` (integer) - Order of tabs
   - `created_at`

4. **`interface_permissions`** - Role-based access control
   - `id` (uuid, PK)
   - `interface_id` (uuid, FK → interfaces)
   - `role` ('admin' | 'staff' | 'member')
   - `created_at`

### Migration

Run `supabase/migrations/create_dynamic_interface_system.sql` to:
- Create all new tables
- Migrate existing interface views from `views` table
- Set up RLS policies
- Create indexes and triggers

## Code Structure

### Helper Functions

**`lib/auth.ts`**
- `getCurrentUser()` - Get current user with role
- `getUserRole()` - Get user's role (re-exported from roles.ts)

**`lib/interfaces.ts`**
- `getInterfaceCategories()` - Load all categories
- `getInterfaces()` - Load interfaces with permission filtering
- `getDefaultInterface()` - Get default landing interface
- `getInterfaceById(id)` - Get single interface
- `getInterfaceViews(interfaceId)` - Get views for an interface
- `canAccessInterface(interfaceId)` - Check user permissions

### Components Updated

1. **`components/layout/WorkspaceShellWrapper.tsx`**
   - Now loads interfaces from new `interfaces` table
   - Falls back to `views` table for backward compatibility
   - Filters by permissions automatically

2. **`app/page.tsx`**
   - Uses `getDefaultInterface()` for landing page
   - Falls back to first accessible interface

3. **`app/pages/[pageId]/page.tsx`**
   - Uses `getInterfaceById()` and `canAccessInterface()`
   - Handles permissions and redirects

4. **`components/layout/AirtableSidebar.tsx`**
   - Displays interfaces grouped by categories
   - Shows "Core Data" section (collapsed) with tables
   - Filters by user role

## Features

### 1. Interface Categories
- Created dynamically via UI (Settings → Interfaces)
- Support drag & drop reordering
- Collapsible in sidebar

### 2. Interfaces
- Primary navigation items
- Can have multiple views (tabs) via `interface_views`
- Support default landing page (`is_default`)
- Role-based permissions

### 3. Interface Views (Tabs)
- One interface can have multiple views
- Views are reusable across interfaces
- Ordered by `position` field

### 4. Permissions
- Admin sees all interfaces
- Staff/Member see only permitted interfaces
- No permissions = public access
- Enforced server-side and client-side

### 5. Default Landing
- On login, redirects to `is_default=true` interface
- If no default, uses first accessible interface
- Never lands on empty route

### 6. Sidebar Structure
```
Interfaces (expanded)
  └─ Category 1
      ├─ Interface A
      └─ Interface B
  └─ Category 2
      └─ Interface C

Core Data (collapsed)
  └─ Tables
      ├─ Table 1
      └─ Table 2

Automations (admin only)
Settings (admin only)
```

### 7. Interface Page UX

**View Mode (Default)**
- Clean webpage appearance
- No block outlines
- No drag handles
- No left sidebar
- Read-only

**Edit Mode**
- Toggle via "Edit interface" button
- Drag & drop blocks enabled
- Resize blocks enabled
- Block settings sidebar (only when block selected)
- Floating "+" button for new blocks
- "Done" button saves and exits

**Text Block Editor**
- WYSIWYG editor (ReactQuill)
- HTML editor tab
- Debounced save (600ms)
- Immediate save on blur
- No cursor jumping
- No re-renders on keystroke

### 8. CSV Import
- Accessible via Settings → Data tab
- Also available in table Design sidebar
- Auto-detects field types:
  - Email
  - URL
  - Date (multiple formats)
  - Number (with currency/percentage detection)
  - JSON
  - Single/Multi-select (categorical)
  - Checkbox (boolean)
- User can override detected types before import

## Backward Compatibility

The system maintains backward compatibility:
- Falls back to `views` table if `interfaces` table doesn't exist
- Falls back to `interface_groups` if `interface_categories` doesn't exist
- Existing interfaces continue to work during migration

## Security

- RLS policies on all new tables
- Permission checks server-side and client-side
- Admin-only routes protected
- Members redirected if accessing admin content

## Next Steps

1. Run the migration SQL in Supabase
2. Test interface creation and editing
3. Test permissions with different user roles
4. Verify default landing page behavior
5. Test CSV import field detection
