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

**Important:** Add the following URLs to your Supabase allowed redirect URLs:
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add these redirect URLs:
   - `https://your-domain.com/auth/callback`
   - `https://your-domain.com/auth/setup-password`
   - `https://your-domain.com/login`

This ensures that invited users can properly complete the password setup flow.

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
   - **Invited users are redirected to `/auth/setup-password` to set their password**
   - After setting password, user is redirected to the app

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

### Invitation email going to spam
- **Solution:** See "Preventing Spam" section below

### Profile not created after accepting invitation
- **Check:** `profiles` table exists and has correct schema
- **Check:** RLS policies allow profile creation
- **Check:** Server logs for errors during auth callback

### User redirected to login instead of password setup
- **Check:** `/auth/setup-password` is added to Supabase allowed redirect URLs
- **Check:** `/auth/callback` is added to Supabase allowed redirect URLs
- **Check:** User has a role in `user_metadata` (set during invitation)
- **Check:** User hasn't already completed password setup (`password_setup_complete` in metadata)
- **Solution:** Ensure redirect URLs are configured in Supabase Dashboard → Authentication → URL Configuration

## Security Notes

- ✅ Service role key is ONLY used server-side in API routes
- ✅ Admin check is performed before sending invitations
- ✅ Email validation prevents invalid addresses
- ✅ Role is stored in user metadata and profile table
- ⚠️ Never commit service role key to git
- ⚠️ Never use service role key in client-side code

## Preventing Spam

If invitation emails are going to spam, follow these steps to improve deliverability:

### 1. Customize Email Template

Improve the email template to make it more professional and less spammy:

1. Go to Supabase Dashboard → Authentication → Email Templates
2. Select "Invite user" template
3. Customize with:
   - **Professional subject line:** e.g., "You've been invited to [Your App Name]"
   - **Clear sender name:** Use your company/app name
   - **Personalized content:** Include who invited them and why
   - **Professional formatting:** Use proper HTML structure

**Example improved template:**
```
Subject: You've been invited to join [Your App Name]

Hi there,

You've been invited to join [Your App Name] by [Admin Name].

Click the link below to accept your invitation and create your account:

[Accept the invite]

This invitation will expire in 24 hours.

If you didn't expect this invitation, you can safely ignore this email.

Best regards,
[Your App Name] Team
```

### 2. Use Custom SMTP (Recommended for Production)

Supabase's default email service can be flagged as spam. For better deliverability:

1. **Set up SMTP provider** (Gmail, SendGrid, Mailgun, AWS SES, etc.)
2. Go to Supabase Dashboard → Authentication → Settings → SMTP Settings
3. Configure:
   - **SMTP Host:** Your provider's SMTP server
   - **SMTP Port:** Usually 587 (TLS) or 465 (SSL)
   - **SMTP User:** Your email/username
   - **SMTP Password:** Your SMTP password or API key
   - **Sender Email:** Use a verified domain email (e.g., `noreply@yourdomain.com`)
   - **Sender Name:** Your app/company name

**Popular SMTP Providers:**
- **SendGrid:** Good deliverability, free tier available
- **Mailgun:** Developer-friendly, free tier available
- **AWS SES:** Cost-effective, requires AWS account
- **Gmail/Google Workspace:** Simple setup, but limited for bulk emails

### 3. Set Production URL

**Important:** Make sure `NEXT_PUBLIC_APP_URL` is set to your production domain, not `localhost`:

```bash
# Production
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# NOT
NEXT_PUBLIC_APP_URL=http://localhost:3000  # ❌ This looks suspicious
```

Emails with `localhost` URLs are more likely to be flagged as spam.

### 4. Email Authentication (SPF/DKIM)

For custom domains, set up email authentication:

1. **SPF Record:** Add to your domain's DNS
   ```
   v=spf1 include:your-smtp-provider.com ~all
   ```

2. **DKIM:** Configure with your SMTP provider
   - Most providers (SendGrid, Mailgun) provide DKIM keys
   - Add the provided DNS records to your domain

3. **DMARC:** Optional but recommended
   ```
   v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
   ```

### 5. Best Practices

- ✅ Use a professional sender email (`noreply@yourdomain.com`)
- ✅ Include clear, professional content
- ✅ Avoid spam trigger words ("free", "urgent", excessive exclamation marks)
- ✅ Include an unsubscribe option (if required by law)
- ✅ Test emails with multiple providers (Gmail, Outlook, etc.)
- ✅ Monitor email deliverability rates
- ✅ Warm up your sending domain/IP gradually

### 6. Quick Fix for Testing

For immediate testing while setting up SMTP:
- Ask users to check spam folder
- Mark as "Not Spam" to train filters
- Add sender to contacts/whitelist

## Testing

1. Ensure you're logged in as admin
2. Go to Settings → Users
3. Click "Invite User"
4. Enter email and select role
5. Check email inbox (and spam folder)
6. Click invitation link
7. Verify user appears in Users list with correct role

**Note:** For production, always use a custom SMTP provider and production URL to avoid spam issues.
