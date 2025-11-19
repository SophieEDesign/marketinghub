# Fix: Missing 'visible' Column and RLS Policy Issues

## Issue 1: Missing 'visible' Column in table_fields

**Error**: `Could not find the 'visible' column of 'table_fields' in the schema cache when adding options to status`

**Solution**: Run the SQL script to add the `visible` column if it's missing.

### Steps:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run the script: `supabase-add-visible-column.sql`
3. This will check if the column exists and add it if missing

**OR** if you haven't run the main migration yet:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run the full migration: `supabase-table-fields-migration.sql`
3. This creates the entire `table_fields` table with all columns including `visible`

## Issue 2: RLS Policy Error for 'branding' Bucket

**Error**: `Permission denied. Please check RLS policies for the 'branding' bucket.`

**Solution**: Make the bucket public OR set up RLS policies.

### Quick Fix (Recommended):

1. Go to **Supabase Dashboard** → **Storage**
2. Click on the **`branding`** bucket
3. Go to **Settings** tab
4. Check **"Public bucket"** ✅
5. Click **"Save"**

### Alternative: Set Up RLS Policies

If you prefer to keep the bucket private:

1. Go to **Storage** → **`branding`** → **Policies** tab
2. Click **"New Policy"**
3. Select **"For full customization"**
4. Create 4 policies (one for each operation):

   **Policy 1: SELECT (View/Download)**
   - Policy name: `Allow public SELECT`
   - Allowed operation: `SELECT`
   - Policy definition: `true`
   - Check expression: `true`
   - Click **"Review"** → **"Save policy"**

   **Policy 2: INSERT (Upload)**
   - Policy name: `Allow public INSERT`
   - Allowed operation: `INSERT`
   - Policy definition: `true`
   - Check expression: `true`
   - Click **"Review"** → **"Save policy"**

   **Policy 3: UPDATE (Overwrite)**
   - Policy name: `Allow public UPDATE`
   - Allowed operation: `UPDATE`
   - Policy definition: `true`
   - Check expression: `true`
   - Click **"Review"** → **"Save policy"**

   **Policy 4: DELETE (Remove)**
   - Policy name: `Allow public DELETE`
   - Allowed operation: `DELETE`
   - Policy definition: `true`
   - Check expression: `true`
   - Click **"Review"** → **"Save policy"**

## Verification

After fixing both issues:

1. **Test Field Manager**: 
   - Go to Settings → Fields
   - Try adding an option to the Status field
   - Should work without the 'visible' column error

2. **Test Logo Upload**:
   - Go to Settings → Branding
   - Try uploading a logo
   - Should work without the RLS policy error

## Code Changes Made

The `updateField` function in `lib/useFieldManager.ts` has been updated to:
- Only include fields that are explicitly being updated
- Not include undefined values in the update
- This prevents trying to update columns that don't exist or aren't being changed

