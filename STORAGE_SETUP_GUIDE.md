# Supabase Storage Setup Guide

## Quick Setup (Recommended)

### Step 1: Create Storage Buckets

1. Go to **Supabase Dashboard** → **Storage**
2. Click **"New bucket"**
3. Create two buckets:

   **Bucket 1: `attachments`**
   - Name: `attachments`
   - ✅ **Enable "Public bucket"** (check this box)
   - Click **"Create bucket"**

   **Bucket 2: `branding`**
   - Name: `branding`
   - ✅ **Enable "Public bucket"** (check this box)
   - Click **"Create bucket"**

### Step 2: Verify Setup

1. Go to **Storage** → You should see both buckets listed
2. Both should show as **Public**
3. That's it! Public buckets work without additional policies.

## Alternative: Using RLS Policies (If buckets are not public)

If you prefer to keep buckets private and use RLS policies:

### For `attachments` bucket:

1. Go to **Storage** → `attachments` → **"Policies"** tab
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

### Repeat for `branding` bucket:

Follow the same steps above for the `branding` bucket.

## Testing

After setup, test file uploads:

1. **Logo Upload**: Go to Settings → Branding → Upload a logo
2. **Content Attachments**: Open a content record → Upload a file

If uploads fail, check:
- Browser console (F12) for error messages
- Bucket exists and is public (or has policies)
- File size is within limits (5MB for logo, 10MB for attachments)

## Common Issues

### "Bucket not found"
- **Solution**: Create the bucket in Supabase Dashboard → Storage

### "Permission denied" or "RLS"
- **Solution**: Enable "Public bucket" OR set up the 4 RLS policies

### "403 Forbidden"
- **Solution**: Bucket is not public and policies are missing/incorrect

### "401 Authentication failed"
- **Solution**: Check your Supabase environment variables are correct

