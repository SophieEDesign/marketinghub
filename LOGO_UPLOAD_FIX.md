# Logo Upload 400 Error - Fix Guide

## Exact SDK Call (Current Code)

**File:** `lib/useSettings.ts` (lines 121-126)

```typescript
const { data: uploadData, error: uploadError } = await supabase.storage
  .from("branding")
  .upload(filePath, file, { 
    upsert: true,
    contentType: file.type || `image/${fileExt}`,
  });
```

**Where:**
- `filePath` = `"logo.png"` (or `"logo.jpg"` etc.)
- `file` = File object from input
- `upsert: true` = Overwrite if exists

## Error Analysis

**Request URL:** `POST /storage/v1/object/branding/logo.png`  
**Status:** `400 Bad Request`  
**Headers:** `x-upsert: true` is present

A 400 error typically means:
1. ❌ **Bucket doesn't exist** (most likely)
2. ❌ **RLS policy blocking** (would be 403, but 400 can occur)
3. ❌ **Invalid file path format**
4. ❌ **Bucket not configured for upsert**

## Quick Fix Steps

### Step 1: Verify Bucket Exists
1. Go to Supabase Dashboard → **Storage**
2. Check if `branding` bucket exists
3. If **NOT**, create it:
   - Click **"New bucket"**
   - Name: `branding`
   - ✅ **Enable "Public bucket"**
   - Click **"Create bucket"**

### Step 2: Set Up RLS Policies (REQUIRED)

Run this SQL in Supabase SQL Editor:

```sql
-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow public SELECT (view/download) on branding bucket
CREATE POLICY "Allow public SELECT on branding bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'branding');

-- Allow public INSERT (upload) on branding bucket
CREATE POLICY "Allow public INSERT on branding bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'branding');

-- Allow public UPDATE (overwrite) on branding bucket
CREATE POLICY "Allow public UPDATE on branding bucket"
ON storage.objects FOR UPDATE
USING (bucket_id = 'branding')
WITH CHECK (bucket_id = 'branding');

-- Allow public DELETE on branding bucket
CREATE POLICY "Allow public DELETE on branding bucket"
ON storage.objects FOR DELETE
USING (bucket_id = 'branding');
```

### Step 3: Alternative - Make Bucket Public

If you prefer making the bucket public (simpler but less secure):

1. Go to Supabase Dashboard → **Storage** → **branding** bucket
2. Click **"Settings"** tab
3. Enable **"Public bucket"**
4. Save

## Updated Code (If Needed)

If the bucket exists and policies are set, the current code should work. However, here's an improved version with better error handling:

```typescript
const updateLogo = async (file: File) => {
  if (!file) {
    throw new Error("No file provided");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("File size must be less than 5MB");
  }

  const fileExt = file.name.split(".").pop()?.toLowerCase() || "png";
  const fileName = `logo.${fileExt}`;
  const filePath = fileName;

  console.log("Uploading logo:", { fileName, filePath, size: file.size, type: file.type });

  // First, try to delete existing logo if it exists
  try {
    await supabase.storage.from("branding").remove([fileName]);
  } catch (e) {
    // Ignore if file doesn't exist
    console.log("No existing logo to remove");
  }

  // Upload new logo
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("branding")
    .upload(filePath, file, { 
      upsert: true,
      contentType: file.type || `image/${fileExt}`,
      cacheControl: '3600',
    });

  if (uploadError) {
    console.error("Upload error details:", uploadError);
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from("branding")
    .getPublicUrl(filePath);

  // Update settings with logo URL
  await updateSettings({
    branding: {
      logo_url: publicUrl,
    },
  });

  return publicUrl;
};
```

## Test the Fix

1. **Run the SQL policies** (Step 2 above)
2. **Refresh your app**
3. **Try uploading again**
4. **Check browser console** for any new errors

## Expected Response (Success)

If successful, you should see:
- Status: `200 OK` or `201 Created`
- Response body with file metadata

## Still Getting 400?

1. **Check Supabase Logs:**
   - Dashboard → Logs → API logs
   - Look for the exact error message

2. **Verify Bucket Name:**
   - Ensure it's exactly `branding` (lowercase, no spaces)

3. **Test Manual Upload:**
   - Go to Supabase Dashboard → Storage → branding
   - Click "Upload file" manually
   - If this fails, the bucket setup is wrong

4. **Check File:**
   - Try a small PNG file (< 1MB)
   - Ensure file extension is valid (png, jpg, svg, etc.)

