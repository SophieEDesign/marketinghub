# Add Channel Options to Channels Field

## Problem
The Channels field (multi_select) doesn't have any options, so the dropdown is empty.

## Solution

You have two options:

### Option 1: Use SQL Script (Quick Setup)

Run the SQL script `supabase-add-channels-options.sql` in your Supabase SQL Editor:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy and paste the contents of `supabase-add-channels-options.sql`
3. Click **Run**
4. Refresh your app - channels should now have options

This will add 12 default channel options:
- LinkedIn
- Facebook
- Instagram
- X (Twitter)
- Twitter
- Website
- Blog
- Email
- YouTube
- TikTok
- PR
- Internal

### Option 2: Use Field Manager UI (Manual Setup)

1. Go to **Settings** → **Fields** (or click the Settings icon in the sidebar)
2. Find the **"Channels"** field in the list
3. Click **"Edit"** on the Channels field
4. Scroll down to the **"Options"** section
5. Click **"+ Add Option"** for each channel you want:
   - Enter the label (e.g., "LinkedIn")
   - Optionally set a color
6. Click **"Save Changes"**
7. Repeat for all channels you need

### Verify It Works

After adding options:
1. Go to any content record (New Record or Edit)
2. Click on the **Channels** field
3. You should see a dropdown with all the channel options
4. Select multiple channels using checkboxes
5. Selected channels appear as chips

## Customizing Channels

To add more channels or change existing ones:
1. Go to **Settings** → **Fields**
2. Edit the **Channels** field
3. In the Options section:
   - **Add**: Click "+ Add Option"
   - **Edit**: Change the label or color
   - **Remove**: Click the "✕" button next to an option
4. Click **"Save Changes"**

## Notes

- Channel options are stored in `table_fields.options.values` as JSON
- Each option has: `id`, `label`, and optional `color`
- The `id` is used when saving the selected value
- The `label` is what users see in the dropdown

