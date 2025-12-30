# User Invitation Setup Guide

## Overview

The user invitation system allows admins to invite users via email. When a user accepts the invitation, they are automatically created with the specified role.

## Setup Requirements

### 1. Environment Variables

Add the following environment variable to your `.env.local` (or Vercel environment variables):

```bash
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Where to find it:**
1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy the "service_role" key (NOT the anon key)
4. ⚠️ **IMPORTANT:** Never expose this key to the client-side code

### 2. Supabase Email Configuration

Configure email templates in Supabase:

1. Go to Authentication → Email Templates
2. Customize the "Invite user" template if needed
3. Ensure email sending is enabled:
   - Go to Authentication → Settings
   - Under "Email Auth", ensure "Enable email confirmations" is ON
   - Configure SMTP settings if using custom email provider

### 3. Redirect URL Configuration

Set the redirect URL in your environment:

```bash
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

Or for Vercel deployments, this is automatically set via `VERCEL_URL`.

## How It Works

1. **Admin invites user:**
   - Admin enters email and role in Settings → Users
   - API route uses service role key to call Supabase Admin API
   - Supabase sends invitation email

2. **User receives email:**
   - Email contains invitation link with confirmation code
   - Link points to `/auth/callback`

3. **User accepts invitation:**
   - Clicks link in email
   - Auth callback route exchanges code for session
   - Profile is automatically created with role from invitation metadata
   - User is redirected to the app

## Troubleshooting

### "Service role key not configured" error
- **Solution:** Add `SUPABASE_SERVICE_ROLE_KEY` to your environment variables
- **Note:** This must be set on your deployment platform (Vercel, etc.)

### "User already exists" error
- **Solution:** User with that email already has an account
- **Workaround:** User can sign in directly, or admin can change their role in Settings

### Invitation email not received
- **Check:** Supabase email settings (SMTP configuration)
- **Check:** Spam/junk folder
- **Check:** Email address is correct
- **Check:** Supabase project email limits (free tier has limits)

### Profile not created after accepting invitation
- **Check:** `profiles` table exists and has correct schema
- **Check:** RLS policies allow profile creation
- **Check:** Server logs for errors during auth callback

## Security Notes

- ✅ Service role key is ONLY used server-side in API routes
- ✅ Admin check is performed before sending invitations
- ✅ Email validation prevents invalid addresses
- ✅ Role is stored in user metadata and profile table
- ⚠️ Never commit service role key to git
- ⚠️ Never use service role key in client-side code

## Testing

1. Ensure you're logged in as admin
2. Go to Settings → Users
3. Click "Invite User"
4. Enter email and select role
5. Check email inbox (and spam folder)
6. Click invitation link
7. Verify user appears in Users list with correct role

