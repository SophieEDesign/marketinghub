# Fix: RLS Policy Error for 'attachments' Bucket

**Error**: `Permission denied. Please check RLS policies for the 'attachments' bucket`

## Quick Fix (Recommended)

### Make the Bucket Public:

1. Go to **Supabase Dashboard** → **Storage**
2. Click on the **`attachments`** bucket
3. Go to **Settings** tab
4. Check **"Public bucket"** ✅
5. Click **"Save"**

That's it! Public buckets work without additional RLS policies.

## Alternative: Set Up RLS Policies

If you prefer to keep the bucket private and use RLS policies:

### Step 1: Go to Storage Policies

1. Go to **Supabase Dashboard** → **Storage**
2. Click on the **`attachments`** bucket
3. Go to **Policies** tab
4. Click **"New Policy"**

### Step 2: Create 4 Policies

Create one policy for each operation (SELECT, INSERT, UPDATE, DELETE):

#### Policy 1: SELECT (View/Download)

- **Policy name**: `Allow public SELECT on attachments`
- **Allowed operation**: `SELECT`
- **Policy definition**: `true`
- **Check expression**: `true`
- Click **"Review"** → **"Save policy"**

#### Policy 2: INSERT (Upload)

- **Policy name**: `Allow public INSERT on attachments`
- **Allowed operation**: `INSERT`
- **Policy definition**: `true`
- **Check expression**: `true`
- Click **"Review"** → **"Save policy"**

#### Policy 3: UPDATE (Overwrite)

- **Policy name**: `Allow public UPDATE on attachments`
- **Allowed operation**: `UPDATE`
- **Policy definition**: `true`
- **Check expression**: `true`
- Click **"Review"** → **"Save policy"**

#### Policy 4: DELETE (Remove)

- **Policy name**: `Allow public DELETE on attachments`
- **Allowed operation**: `DELETE`
- **Policy definition**: `true`
- **Check expression**: `true`
- Click **"Review"** → **"Save policy"**

## Verification

After fixing:

1. **Test Attachment Upload**:
   - Open a content record
   - Try uploading an attachment (image/file)
   - Should work without the RLS policy error

2. **Test Attachment View**:
   - View existing attachments in Cards, Grid, or Kanban views
   - Images should display correctly

## Common Issues

### "Bucket not found"
- **Solution**: Create the `attachments` bucket in Supabase Dashboard → Storage → New bucket

### "403 Forbidden"
- **Solution**: Bucket is not public and policies are missing/incorrect

### "401 Authentication failed"
- **Solution**: Check your Supabase environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

## Note

The `attachments` bucket is used for:
- Content record attachments (images, files)
- Thumbnail images for content items
- Any file uploads in the dynamic field system

Make sure both `attachments` and `branding` buckets are set up correctly for full functionality.

