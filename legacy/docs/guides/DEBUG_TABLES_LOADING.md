# Debugging Tables Not Showing in Core Data

## Current Status
✅ RLS Policy exists: "Authenticated users can view all tables" with SELECT for authenticated role
❓ Tables still not showing in sidebar

## Diagnostic Steps

### Step 1: Verify Tables Exist in Database
Run this query in Supabase SQL Editor:
```sql
SELECT COUNT(*) as table_count FROM public.tables;
SELECT id, name, supabase_table FROM public.tables LIMIT 10;
```

**Expected**: Should return at least 1 table if you have tables created.

### Step 2: Check Browser Console
Open browser DevTools (F12) and check the Console tab for:
- `[getTables] Successfully loaded tables: X` - Shows how many tables were loaded
- `[getTables] Error fetching tables:` - Shows any errors
- `[WorkspaceShellWrapper] Error loading tables:` - Shows wrapper-level errors

### Step 3: Check Network Tab
1. Open DevTools → Network tab
2. Filter by "Fetch/XHR"
3. Look for requests to Supabase
4. Check if there are any failed requests or 401/403 errors

### Step 4: Verify User Authentication
The RLS policy requires `auth.role() = 'authenticated'`. Verify you're logged in:
```sql
SELECT auth.uid() as current_user_id, auth.role() as current_role;
```

**Expected**: Should return your user ID and role = 'authenticated'

### Step 5: Test Direct Query
Try querying tables directly as your authenticated user (not service role):
```sql
-- This should work if RLS is correct
SELECT * FROM public.tables LIMIT 5;
```

**Note**: If running in Supabase SQL Editor with service role, this will always work. You need to test from the application.

### Step 6: Check Application Logs
If you have access to server logs (Vercel, etc.), check for:
- Any errors from `getTables()` function
- Any RLS policy violations
- Any network errors

## Common Issues

### Issue: Tables exist but `getTables()` returns empty array
**Possible Causes**:
1. RLS policy not working correctly (but we verified it exists)
2. User not authenticated properly
3. Query failing silently

**Solution**: Check browser console for errors from `[getTables]`

### Issue: Tables array is empty in WorkspaceShellWrapper
**Possible Causes**:
1. `getTables()` is throwing an error that's being caught
2. Tables are being filtered out somewhere
3. Caching issue

**Solution**: Check the error handling in `WorkspaceShellWrapper.tsx` - errors are caught and return empty array

### Issue: Sidebar not rendering Core Data section
**Possible Causes**:
1. `tables.length === 0` (most likely)
2. Component not receiving tables prop
3. Conditional rendering issue

**Solution**: The sidebar only shows Core Data if `tables.length > 0`. Check if tables are being passed correctly.

## Quick Fix Test

Add temporary logging to see what's happening:

1. In browser console, run:
```javascript
// Check if tables are in the page
console.log('Checking for tables...');
```

2. Check the React DevTools to see the props passed to `AirtableSidebar`:
   - Look for `tables` prop
   - Check its value and length

3. Add a temporary debug component:
```tsx
// In AirtableSidebar.tsx, add before the Core Data section:
{process.env.NODE_ENV === 'development' && (
  <div style={{padding: '10px', background: 'yellow'}}>
    Debug: tables.length = {tables.length}
    {tables.length > 0 && (
      <div>Tables: {tables.map(t => t.name).join(', ')}</div>
    )}
  </div>
)}
```

## Next Steps

1. Run Step 1 to verify tables exist
2. Check browser console (Step 2)
3. If tables exist but aren't loading, check network tab (Step 3)
4. Verify authentication (Step 4)
5. If still not working, check server logs (Step 6)
