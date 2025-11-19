# Fix Attachments Bucket RLS Policies

## Problem
You're getting "Permission denied" errors when trying to upload, view, or delete files from the `attachments` bucket in Supabase Storage.

## Solution

Supabase Storage policies must be set up through the Dashboard UI (not SQL). Follow these steps:

### Option 1: Make Bucket Public (Simplest)

1. Go to **Supabase Dashboard** → **Storage**
2. Find the `attachments` bucket
3. Click on it to open settings
4. Toggle **"Public bucket"** to **ON**
5. Save

This allows anyone to read/write to the bucket. For production, use Option 2.

### Option 2: Set Up RLS Policies (Recommended for Production)

1. Go to **Supabase Dashboard** → **Storage** → **Policies**
2. Select the `attachments` bucket
3. Click **"New Policy"**

#### Policy 1: Allow Public SELECT (View/Download)
- **Policy Name**: `Allow public SELECT on attachments`
- **Allowed Operation**: `SELECT`
- **Policy Definition**: 
  ```sql
  bucket_id = 'attachments'
  ```
- **Check Expression**: Leave empty
- Click **Save**

#### Policy 2: Allow Public INSERT (Upload)
- **Policy Name**: `Allow public INSERT on attachments`
- **Allowed Operation**: `INSERT`
- **Policy Definition**: 
  ```sql
  bucket_id = 'attachments'
  ```
- **Check Expression**: Leave empty
- Click **Save**

#### Policy 3: Allow Public UPDATE (Overwrite)
- **Policy Name**: `Allow public UPDATE on attachments`
- **Allowed Operation**: `UPDATE`
- **Policy Definition**: 
  ```sql
  bucket_id = 'attachments'
  ```
- **Check Expression**: Leave empty
- Click **Save**

#### Policy 4: Allow Public DELETE (Remove)
- **Policy Name**: `Allow public DELETE on attachments`
- **Allowed Operation**: `DELETE`
- **Policy Definition**: 
  ```sql
  bucket_id = 'attachments'
  ```
- **Check Expression**: Leave empty
- Click **Save**

### Option 3: Use SQL Editor (Alternative)

If you prefer SQL, you can run this in the **SQL Editor**:

```sql
-- Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public SELECT
CREATE POLICY "Allow public SELECT on attachments"
ON storage.objects
FOR SELECT
USING (bucket_id = 'attachments');

-- Policy: Allow public INSERT
CREATE POLICY "Allow public INSERT on attachments"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'attachments');

-- Policy: Allow public UPDATE
CREATE POLICY "Allow public UPDATE on attachments"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'attachments');

-- Policy: Allow public DELETE
CREATE POLICY "Allow public DELETE on attachments"
ON storage.objects
FOR DELETE
USING (bucket_id = 'attachments');
```

**Note**: If policies already exist, you may need to drop them first:

```sql
DROP POLICY IF EXISTS "Allow public SELECT on attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow public INSERT on attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow public UPDATE on attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow public DELETE on attachments" ON storage.objects;
```

## Verify Setup

After setting up policies:

1. Go to **Storage** → **attachments** → **Policies**
2. You should see 4 policies (SELECT, INSERT, UPDATE, DELETE)
3. Try uploading a file in your app
4. Check the browser console for any remaining errors

## Troubleshooting

### Still Getting Errors?

1. **Check bucket exists**: Go to Storage → Make sure `attachments` bucket exists
2. **Check bucket is not private**: If using Option 1, ensure "Public bucket" is ON
3. **Check policy syntax**: If using SQL, ensure policies are created correctly
4. **Clear browser cache**: Sometimes cached errors persist
5. **Check Supabase logs**: Go to Logs → API to see detailed error messages

### For Production

For production apps, consider:
- Restricting policies to authenticated users only
- Adding file size limits
- Adding file type restrictions
- Using signed URLs instead of public URLs

Example authenticated-only policy:
```sql
-- Only allow authenticated users
CREATE POLICY "Allow authenticated SELECT on attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'attachments' 
  AND auth.role() = 'authenticated'
);
```

## Next Steps

After fixing RLS policies:
1. Test file upload in your app
2. Test file viewing/display
3. Test file deletion
4. Verify files appear in Storage → attachments bucket

