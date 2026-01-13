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

2. **Run Diagnostic Query:**
   - Execute `CHECK_DEFAULT_PAGE.sql` to verify:
     - Default page ID is set in `workspace_settings`
     - The page exists in `interface_pages` table
     - The page is not admin-only (if you're not an admin)
     - Foreign key constraint is correct

3. **Test Login Flow:**
   - Log out and log back in
   - Check browser console (in development mode) for logs showing:
     - `[Landing Page]` - workspace settings and validation
     - `[validatePageAccess]` - page validation details
     - `[Redirect]` - final redirect decision
   - Verify you're redirected to the correct default page

4. **Check for Common Issues:**
   - **Page doesn't exist**: The default_interface_id points to a deleted page
   - **Admin-only page**: Non-admin users can't access admin-only pages
   - **Foreign key mismatch**: The constraint might reference the wrong table
   - **RLS policy blocking**: Row-level security might be preventing access

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
