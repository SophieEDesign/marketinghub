# Auth email templates (branded header)

All Marketing Hub Auth emails share the same Peters &amp; May header (logo + teal bar) and footer.

## Apply in Supabase (required for production)

Dashboard cannot be updated from the app. For **each** template:

1. Open [Authentication → Email Templates](https://supabase.com/dashboard/project/hwtycgvclhckglmuwnmw/auth/templates)
2. Select the template name below
3. Set the **Subject**
4. Paste the full HTML from the matching file
5. Save

| Dashboard name | File | Subject |
|---|---|---|
| Invite user | `invite-user.html` | You're invited to Peters & May Marketing Hub |
| Confirm signup | `confirm-signup.html` | Confirm your Marketing Hub email |
| Magic Link | `magic-link.html` | Your Marketing Hub sign-in link |
| Reset Password | `reset-password.html` | Reset your Marketing Hub password |
| Change Email Address | `change-email.html` | Confirm your new Marketing Hub email |
| Reauthentication | `reauthentication.html` | Confirm it’s you — Marketing Hub |

Regenerate HTML after editing `brand-shell.mjs`:

```bash
node docs/email-templates/generate.mjs
```

## Local CLI (optional)

`supabase/config.toml` points at these files for local Auth email previews.
