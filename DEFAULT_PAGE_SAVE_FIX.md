# Default Page Save Fix

## Problem
Default page setting is not saving to the `default_interface_id` field in `workspace_settings` table.

## Changes Made

### 1. Enhanced Error Logging (`WorkspaceTab.tsx`)

Added comprehensive logging throughout the save process:
- Logs before save with the values being saved
- Logs each step (update vs insert)
- Logs errors with full details (code, message, hint)
- Verifies save by reading back the value
- Warns if saved value doesn't match expected value

### 2. Improved Save Logic

- Better handling of existing vs new rows
- Checks for RLS policy issues (second query if first fails)
- Returns selected data to verify save succeeded
- More detailed error messages for users

### 3. Diagnostic Query

Created `CHECK_DEFAULT_PAGE_SAVE.sql` to help diagnose:
- Table/column existence
- Current value in database
- Foreign key constraint details
- RLS policies
- Available interface pages

## Troubleshooting Steps

### 1. Check Browser Console

When saving, check the browser console for logs prefixed with `[WorkspaceTab]`:
- `Saving default page:` - Shows what's being saved
- `Update error:` or `Insert error:` - Shows any errors
- `Verified save` - Confirms the value was saved
- `WARNING: Saved value does not match!` - Indicates save didn't persist

### 2. Run Diagnostic Query

Run `CHECK_DEFAULT_PAGE_SAVE.sql` to check:
- If the column exists
- Current value in database
- Foreign key constraint (should point to `interface_pages`, not `views`)
- RLS policies that might block saves

### 3. Common Issues

#### Foreign Key Constraint Wrong Table
**Symptom:** Error code `23503` (foreign key violation)
**Fix:** Run `fix_default_interface_id_foreign_key.sql` migration to update constraint to point to `interface_pages(id)` instead of `views(id)`

#### RLS Policy Blocking Save
**Symptom:** Save succeeds but value doesn't persist, or insert fails silently
**Fix:** Check RLS policies on `workspace_settings` table - ensure admins can update

#### Column Doesn't Exist
**Symptom:** Error code `PGRST116`, `42P01`, or `42703`
**Fix:** Run `add_default_interface_to_workspace_settings.sql` migration

#### Page ID Doesn't Exist
**Symptom:** Error code `23503` with message about page not found
**Fix:** Ensure the selected page exists in `interface_pages` table

## Expected Console Output (Success)

```
[WorkspaceTab] Saving default page: { defaultPageId: "...", defaultInterfaceId: "...", convertingToNull: false }
[WorkspaceTab] Updating existing workspace_settings row: <uuid>
[WorkspaceTab] Successfully updated default_interface_id: { saved: "...", expected: "..." }
[WorkspaceTab] Verified save - default_interface_id in DB: "..."
```

## Expected Console Output (Error)

```
[WorkspaceTab] Saving default page: { defaultPageId: "...", defaultInterfaceId: "...", convertingToNull: false }
[WorkspaceTab] Update error: { code: "23503", message: "...", details: {...} }
[WorkspaceTab] Foreign key constraint violation - page ID not found: { pageId: "...", error: {...} }
```

## Next Steps

1. Try saving the default page and check browser console
2. If errors appear, run `CHECK_DEFAULT_PAGE_SAVE.sql` to diagnose
3. Fix any issues found (foreign key, RLS, missing column)
4. Verify save by checking the database directly
