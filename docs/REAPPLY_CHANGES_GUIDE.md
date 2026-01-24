# Guide to Re-applying Changes Since 749a7ba

This guide helps you selectively re-apply changes that were made after commit `749a7ba`. All changes have been documented in `CHANGES_SINCE_749a7ba.md`.

## Quick Start

1. **Review** `CHANGES_SINCE_749a7ba.md` to understand what changed
2. **Identify** which categories you need (see priority list below)
3. **Apply** changes category by category, testing after each
4. **Commit** after each successful category application

## Re-application Methods

### Method 1: Cherry-pick Commits (Recommended for Complete Categories)

If a commit contains all changes for a category, cherry-pick it:

```bash
# View what a commit changes
git show <commit-hash> --stat

# Cherry-pick the commit
git cherry-pick <commit-hash>

# Resolve any conflicts, then:
git add .
git cherry-pick --continue
```

**Note:** Commits don't map 1:1 to categories. Some commits contain multiple categories.

### Method 2: Manual File Application (Recommended for Selective Changes)

1. View the diff for specific files:
   ```bash
   git show <commit-hash>:<file-path> > /tmp/old-file.tsx
   git diff /tmp/old-file.tsx <file-path>
   ```

2. Or view changes from the reverted commits:
   ```bash
   # Get the commit range
   git log 749a7ba..9d076f1d9d --oneline
   
   # View diff for a specific file across all commits
   git diff 749a7ba..9d076f1d9d -- <file-path>
   ```

3. Manually apply the changes using your editor

### Method 3: Patch Files (For Complex Changes)

```bash
# Create a patch file for specific commits
git format-patch 749a7ba..9d076f1d9d

# Apply a specific patch
git apply <patch-file>

# Or use git am for full commit history
git am <patch-file>
```

---

## Category-by-Category Re-application

### Category 1: CORS Configuration & Fetch Wrapper ⚠️

**When to apply:** If you're experiencing CORS errors in production

**Files to apply:**
1. `baserow-app/lib/supabase/fetch-wrapper.ts` (NEW - create from scratch)
2. `baserow-app/lib/supabase/client.ts` (modify)
3. `lib/supabase.ts` (modify)
4. `docs/guides/SUPABASE_CORS_CONFIGURATION.md` (optional - documentation)
5. `supabase/migrations/fix_cors_for_production_domain.sql` (optional - run in Supabase)

**Steps:**

1. **Create fetch-wrapper.ts:**
   ```bash
   # View the file content from the reverted commit
   git show 9d076f1d9d:baserow-app/lib/supabase/fetch-wrapper.ts > baserow-app/lib/supabase/fetch-wrapper.ts
   ```

2. **Update client.ts:**
   ```bash
   # View the diff
   git diff 749a7ba..9d076f1d9d -- baserow-app/lib/supabase/client.ts
   ```
   Then manually apply:
   - Add import: `import { enhancedFetch } from "./fetch-wrapper";`
   - Change: `const noStoreFetch = enhancedFetch`

3. **Update lib/supabase.ts:**
   ```bash
   # View the diff
   git diff 749a7ba..9d076f1d9d -- lib/supabase.ts
   ```
   Then manually apply:
   - Add import: `import { enhancedFetch } from '../baserow-app/lib/supabase/fetch-wrapper'`
   - Update `createClientSupabaseClient()` to use `enhancedFetch`

4. **Test:**
   - Check browser console for CORS errors
   - Verify network requests work
   - Test retry behavior (disconnect network briefly)

5. **Run SQL migration (if needed):**
   - Open Supabase Dashboard → SQL Editor
   - Copy contents of `supabase/migrations/fix_cors_for_production_domain.sql`
   - Run it

**Dependencies:** None - can be applied independently

---

### Category 2: Abort Error Handling ✅

**When to apply:** To reduce console errors during navigation

**Files to apply:**
- `baserow-app/components/grid/AirtableGridView.tsx`
- `baserow-app/components/grid/AirtableViewPage.tsx`
- `baserow-app/components/grid/RecordDrawer.tsx`
- `baserow-app/components/grid/RecordModal.tsx` (complex - includes AbortController)
- `baserow-app/components/interface/InterfacePageClient.tsx` (complex - includes AbortController)
- `baserow-app/components/settings/WorkspaceTab.tsx`

**Steps:**

1. **Verify error-handling utility exists:**
   ```bash
   # Check if isAbortError exists
   grep -r "isAbortError" baserow-app/lib/api/error-handling.ts
   ```
   If it doesn't exist, you may need to add it (it should exist from 749a7ba).

2. **Apply simple changes (AirtableGridView, AirtableViewPage, RecordDrawer, WorkspaceTab):**
   ```bash
   # View diff for one file
   git diff 749a7ba..9d076f1d9d -- baserow-app/components/grid/AirtableGridView.tsx
   ```
   
   Pattern to apply:
   - Add import: `import { isAbortError } from '@/lib/api/error-handling'`
   - In catch blocks, add: `if (isAbortError(error)) return`

3. **Apply complex changes (RecordModal, InterfacePageClient):**
   These require AbortController implementation. View full diffs:
   ```bash
   git diff 749a7ba..9d076f1d9d -- baserow-app/components/grid/RecordModal.tsx
   git diff 749a7ba..9d076f1d9d -- baserow-app/components/interface/InterfacePageClient.tsx
   ```
   
   Key changes:
   - Add `abortControllerRef` using `useRef`
   - Create AbortController in useEffect
   - Pass signal to fetch requests
   - Check for abort before state updates
   - Cleanup on unmount

4. **Test:**
   - Navigate quickly between pages
   - Open/close RecordModal quickly
   - Check console - should see fewer abort errors

**Dependencies:** Requires `isAbortError()` function (should exist from 749a7ba)

**Can apply incrementally:** Yes - apply file by file

---

### Category 3: Required Field Validation ✅

**When to apply:** To improve UX for required field validation

**Files to apply:**
- `baserow-app/components/grid/GridView.tsx`

**Steps:**

1. **View the diff:**
   ```bash
   git diff 749a7ba..9d076f1d9d -- baserow-app/components/grid/GridView.tsx
   ```

2. **Apply changes:**
   - Add required field validation before insert (lines ~2181-2227)
   - Add enhanced error handling for NOT NULL constraints (lines ~2233-2249)

3. **Test:**
   - Try creating a record with missing required fields
   - Verify warning dialog appears
   - Verify can proceed anyway
   - Verify database errors show user-friendly messages

**Dependencies:** None

**Can apply incrementally:** N/A - single file

---

### Category 4: Session Management & 401 Handling ⚠️

**When to apply:** If experiencing 401 authentication errors in ChartBlock

**Files to apply:**
- `baserow-app/components/interface/blocks/ChartBlock.tsx`
- `baserow-app/components/layout/NavigationDiagnostics.tsx` (optional)

**Steps:**

1. **View ChartBlock diff:**
   ```bash
   git diff 749a7ba..9d076f1d9d -- baserow-app/components/interface/blocks/ChartBlock.tsx
   ```

2. **Apply session refresh logic:**
   - In `loadTableFields()`: Add session check and refresh (lines ~131-142)
   - In `loadTableFields()`: Add 401 error handling with retry (lines ~150-175)
   - In `loadData()`: Add session check and refresh (lines ~205-212)
   - In `loadData()`: Add 401 error handling with retry (lines ~214-245)

3. **Pattern to apply:**
   ```typescript
   // Before requests:
   const { data: { session }, error: sessionError } = await supabase.auth.getSession()
   if (sessionError || !session) {
     const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
     if (refreshError || !refreshedSession) {
       router.push('/login?next=' + encodeURIComponent(window.location.pathname))
       return
     }
   }
   
   // After requests with errors:
   if (error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('expired')) {
     // Refresh and retry
   }
   ```

4. **Test:**
   - Let session expire
   - Load ChartBlock
   - Verify session refreshes automatically
   - Verify redirects to login if refresh fails

**Dependencies:** None

**Can apply incrementally:** Yes - ChartBlock and NavigationDiagnostics are independent

---

### Category 5: Grouping Logic Fix ✅

**When to apply:** If grouping behavior is incorrect when removing grouping from blocks

**Files to apply:**
- `baserow-app/components/grid/GridViewWrapper.tsx`

**Steps:**

1. **View the diff:**
   ```bash
   git diff 749a7ba..9d076f1d9d -- baserow-app/components/grid/GridViewWrapper.tsx
   ```

2. **Apply changes:**
   - Add logic to respect `initialGroupBy` from block config
   - Clear `grid_view_settings` when `initialGroupBy` is null/undefined
   - Use `initialGroupBy` directly if provided (don't load from settings)
   - Add `initialGroupBy` to useEffect dependency array

3. **Test:**
   - Remove grouping from a block config
   - Verify grouping is cleared and doesn't restore
   - Add grouping to block config
   - Verify grouping is applied correctly

**Dependencies:** None

**Can apply incrementally:** N/A - single file

---

### Category 6: General Error Handling ✅

**When to apply:** To improve error messages and debugging

**Files to apply (apply incrementally):**
- `baserow-app/components/interface/RecordPanelEditor.tsx`
- `baserow-app/components/interface/RecordReviewLeftColumn.tsx`
- `baserow-app/components/interface/RecordReviewView.tsx`
- `baserow-app/components/interface/blocks/FieldBlock.tsx`
- `baserow-app/components/interface/blocks/GridBlock.tsx`
- `baserow-app/components/layout/GroupedInterfaces.tsx`
- `baserow-app/components/layout/PerformanceMonitor.tsx`
- `baserow-app/components/layout/design/PermissionsTab.tsx`
- `baserow-app/components/records/RecordFieldPanel.tsx`
- `baserow-app/components/views/MultiTimelineView.tsx`

**Steps:**

1. **View diffs for each file:**
   ```bash
   git diff 749a7ba..9d076f1d9d -- <file-path>
   ```

2. **Apply changes incrementally:**
   - Start with files you use most
   - Apply one file at a time
   - Test after each file

3. **Test:**
   - Trigger errors in each component
   - Verify error messages are clear
   - Check console for improved error logging

**Dependencies:** None

**Can apply incrementally:** Yes - apply file by file

---

## Recommended Re-application Order

### If Experiencing CORS Errors:
1. Category 1 (CORS) - **Apply first**
2. Category 4 (Session Management) - If also seeing 401 errors
3. Category 5 (Grouping) - If grouping is broken
4. Category 3 (Required Fields) - Nice to have
5. Category 2 (Abort Errors) - Reduces console noise
6. Category 6 (General Errors) - Nice to have

### If Experiencing 401 Errors:
1. Category 4 (Session Management) - **Apply first**
2. Category 1 (CORS) - If also seeing CORS errors
3. Category 5 (Grouping) - If grouping is broken
4. Category 3 (Required Fields) - Nice to have
5. Category 2 (Abort Errors) - Reduces console noise
6. Category 6 (General Errors) - Nice to have

### If Everything Works But Want Improvements:
1. Category 5 (Grouping) - If grouping behavior is wrong
2. Category 3 (Required Fields) - Improves UX
3. Category 2 (Abort Errors) - Reduces console noise
4. Category 6 (General Errors) - Better debugging
5. Category 1 (CORS) - Only if you see CORS issues
6. Category 4 (Session Management) - Only if you see 401 errors

---

## Testing After Each Category

After applying each category:

1. **Build the project:**
   ```bash
   npm run build
   # or
   yarn build
   ```

2. **Check for TypeScript errors:**
   ```bash
   npm run type-check
   # or
   tsc --noEmit
   ```

3. **Run tests (if available):**
   ```bash
   npm test
   ```

4. **Manual testing:**
   - Test the specific functionality affected by the category
   - Check browser console for errors
   - Verify expected behavior works

5. **Commit:**
   ```bash
   git add .
   git commit -m "Re-apply Category X: [Category Name]"
   ```

---

## Troubleshooting

### Conflicts During Cherry-pick

If you get conflicts:
```bash
# View conflicts
git status

# Resolve conflicts manually, then:
git add <resolved-files>
git cherry-pick --continue

# Or abort:
git cherry-pick --abort
```

### Missing Dependencies

If a change requires something that doesn't exist:
1. Check if it was in 749a7ba: `git show 749a7ba:<file-path>`
2. Check if it's in a different commit: `git log --all --oneline -- <file-path>`
3. Apply the dependency first, then the dependent change

### Changes Don't Work

1. Verify you applied all files in the category
2. Check for TypeScript/build errors
3. Review the diff again: `git diff 749a7ba..9d076f1d9d -- <file-path>`
4. Check browser console for errors
5. Compare with the original commit: `git show <commit-hash>`

---

## Getting Help

If you need to see the original changes:

```bash
# View all changes
git diff 749a7ba..9d076f1d9d

# View specific file
git diff 749a7ba..9d076f1d9d -- <file-path>

# View specific commit
git show <commit-hash>

# View commit message and stats
git show <commit-hash> --stat
```

Refer to `CHANGES_SINCE_749a7ba.md` for detailed change descriptions.
