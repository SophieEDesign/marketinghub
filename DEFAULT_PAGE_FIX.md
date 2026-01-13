# Default Page Activation Fix

## Issue
The default page specified in workspace settings wasn't being activated correctly - users weren't being redirected to the configured default page after login.

## Root Cause
There was a mismatch in how pages were filtered for accessibility:

1. **`getAllInterfacePages()`** was returning ALL pages without filtering by `is_admin_only`
2. **`resolveLandingPage()`** correctly validates and filters pages by admin access
3. The check in `app/page.tsx` was comparing the resolved page against the unfiltered list, which could cause mismatches

## Fixes Applied

### 1. Fixed Page Filtering in `app/page.tsx`
- Updated `getAllInterfacePages()` usage to filter out admin-only pages for non-admin users
- This ensures the `accessiblePages` list matches what `resolveLandingPage()` considers accessible
- Added better logging to track the resolution process

### 2. Improved Trust in `resolveLandingPage()` Validation
- Since `resolveLandingPage()` already validates page existence and access, we now trust its result
- Added defensive check but still redirect if `resolveLandingPage()` says it's valid
- This handles edge cases where RLS policies might differ between queries

### 3. Enhanced Logging
- Added comprehensive logging to `resolveLandingPage()` to track:
  - Workspace settings query results
  - Default page ID retrieval
  - Page validation results
  - Reasons for validation failures
- Added detailed logging to `validatePageAccess()` to track:
  - Which table is being checked (interface_pages vs views)
  - Whether pages are found
  - Admin-only restrictions
  - Validation results

## How to Verify the Fix

1. **Check Current Default Page Setting:**
   - Go to Settings → Workspace tab
   - Check what page is selected as "Default Page at Login"
   - Note the page name and ID
   - Click "Save Changes" to ensure it's saved

2. **Run Comprehensive Diagnostic:**
   - Execute `DIAGNOSE_DEFAULT_PAGE.sql` (recommended) or `CHECK_DEFAULT_PAGE.sql`
   - This will show you:
     - Whether workspace_settings exists and has a default_interface_id
     - Whether the default page exists in interface_pages
     - Whether the page is admin-only
     - What the first accessible page is (fallback)
     - RLS policies that might be blocking access
     - Test queries to simulate what the code does

3. **Test Login Flow:**
   - Log out and log back in
   - Check browser console (in development mode) for logs showing:
     - `[Landing Page]` - workspace settings query and validation results
     - `[validatePageAccess]` - detailed page validation (which table checked, results)
     - `[Redirect]` - final redirect decision and page ID
   - Look for:
     - `✓ Using workspace default page` - means default was found and used
     - `✗ Workspace default page validation FAILED` - means default exists but validation failed
     - `Using first accessible page (fallback)` - means default wasn't used

4. **Check for Common Issues:**
   - **Page doesn't exist**: The default_interface_id points to a deleted page
     - Fix: Set a new default page in Settings → Workspace
   - **Admin-only page**: Non-admin users can't access admin-only pages
     - Fix: Either make the page non-admin-only or set a different default
   - **RLS policy blocking**: Row-level security might be preventing access
     - Check: Run Step 5 of DIAGNOSE_DEFAULT_PAGE.sql to see RLS policies
   - **Workspace settings not found**: No row in workspace_settings table
     - Fix: Save workspace settings again in Settings → Workspace
   - **Default page ID is NULL**: Settings exist but default_interface_id is null
     - Fix: Select a default page in Settings → Workspace and save

## Files Modified

1. `baserow-app/app/page.tsx`
   - Added admin filtering to accessible pages list
   - Improved redirect logic to trust `resolveLandingPage()` validation
   - Enhanced logging

2. `baserow-app/lib/interfaces.ts`
   - Enhanced logging in `resolveLandingPage()` for workspace default page
   - Enhanced logging in `validatePageAccess()` for detailed validation tracking

## Next Steps

If the issue persists after these fixes:

1. **Check the database directly:**
   ```sql
   -- See CHECK_DEFAULT_PAGE.sql for full diagnostic queries
   SELECT default_interface_id FROM workspace_settings;
   SELECT id, name, is_admin_only FROM interface_pages WHERE id = '<default_interface_id>';
   ```

2. **Review console logs** in development mode to see exactly where the resolution fails

3. **Verify RLS policies** on `workspace_settings` and `interface_pages` tables allow read access

4. **Check if the page was deleted** - if so, set a new default page in Settings

## Related Files

- `CHECK_DEFAULT_PAGE.sql` - Diagnostic queries to check default page configuration
- `baserow-app/components/settings/WorkspaceTab.tsx` - UI for setting default page
- `supabase/migrations/fix_default_interface_id_foreign_key.sql` - Foreign key constraint fix
