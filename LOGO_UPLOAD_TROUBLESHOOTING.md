# Logo Upload Troubleshooting Guide

## Quick Fixes

### 1. Check Browser Console
Open browser DevTools (F12) → Console tab → Look for error messages when uploading

### 2. Verify Storage Bucket Exists
1. Go to Supabase Dashboard → **Storage**
2. Check if `branding` bucket exists
3. If not, create it:
   - Click **"New bucket"**
   - Name: `branding`
   - ✅ **Enable "Public bucket"**
   - Click **"Create bucket"**

### 3. Check Bucket is Public
1. Go to Storage → `branding` bucket
2. Click **"Settings"** tab
3. Ensure **"Public bucket"** is enabled
4. If not, enable it and save

### 4. Set Up RLS Policies (If bucket is not public)
1. Go to Storage → `branding` bucket → **"Policies"** tab
2. Click **"New Policy"**
3. Select **"For full customization"**
4. Create policies for:
   - **SELECT** (to view/download)
   - **INSERT** (to upload)
   - **UPDATE** (to overwrite)
   - **DELETE** (to remove)
5. For each policy:
   - Policy name: `Allow public [operation]`
   - Allowed operation: [SELECT/INSERT/UPDATE/DELETE]
   - Policy definition: `true`
   - Check expression: `true`
   - Click **"Review"** → **"Save policy"**

### 5. Run SQL Script (Alternative)
Run `supabase-storage-policies.sql` in Supabase SQL Editor to set up policies automatically.

### 6. Check File Size
- Maximum file size: **5MB**
- If your file is larger, compress it or use a smaller image

### 7. Check File Type
- Supported: All image types (PNG, JPG, GIF, SVG, etc.)
- The file should have a valid image extension

## Common Error Messages

### "Bucket not found"
- **Solution**: Create the `branding` bucket in Supabase Storage

### "Permission denied" or "RLS"
- **Solution**: Enable "Public bucket" OR set up RLS policies (see step 4)

### "403 Forbidden"
- **Solution**: Bucket is not public and RLS policies are blocking access

### "401 Authentication failed"
- **Solution**: Check your Supabase environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### "File size must be less than 5MB"
- **Solution**: Compress your image or use a smaller file

## Step-by-Step Setup

1. **Create Bucket** (if not exists):
   ```
   Supabase Dashboard → Storage → New bucket
   Name: branding
   Public bucket: ✅ Enabled
   ```

2. **Verify Bucket Settings**:
   ```
   Storage → branding → Settings
   Ensure "Public bucket" is enabled
   ```

3. **Set Up Policies** (if needed):
   ```
   Storage → branding → Policies → New Policy
   [Follow step 4 above]
   ```

4. **Test Upload**:
   - Go to Settings → Branding section
   - Select an image file
   - Click "Upload Logo"
   - Check browser console for any errors

## Still Not Working?

1. **Check Browser Console**: Look for detailed error messages
2. **Check Network Tab**: See if the upload request is being made
3. **Verify Environment Variables**: Ensure Supabase credentials are correct
4. **Try Different Image**: Test with a small PNG file (< 1MB)
5. **Check Supabase Logs**: Go to Supabase Dashboard → Logs → API logs

## Manual Upload Test

You can test the bucket manually:
1. Go to Supabase Dashboard → Storage → branding
2. Click **"Upload file"**
3. Select an image
4. If this works, the bucket is set up correctly
5. If this fails, the issue is with bucket permissions

