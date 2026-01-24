# CORS Fix Checklist - Action Required

## Current Issue
CORS errors are blocking requests from `https://marketing.petersandmay.com` to Supabase:
- Auth API (`/auth/v1/user`) - **Requires Dashboard Configuration**
- Data API (`/rest/v1/*`) - **Requires SQL Migration**

## ✅ Step 1: Fix Data API CORS (SQL Migration)

1. **Open Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**
3. **Go to SQL Editor**
4. **Copy and paste the entire contents of**: `supabase/migrations/fix_cors_for_production_domain.sql`
5. **Click "Run"**
6. **Verify the output** - You should see:
   - `✓ Production domain (marketing.petersandmay.com) is configured`
   - `✓ Localhost (development) is configured` (if applicable)

## ✅ Step 2: Fix Auth API CORS (Dashboard Configuration)

1. **In Supabase Dashboard**, go to **Authentication → URL Configuration**
2. **Set Site URL** to: `https://marketing.petersandmay.com`
3. **Add Redirect URLs** (click "Add URL" for each):
   - `https://marketing.petersandmay.com/auth/callback`
   - `https://marketing.petersandmay.com/auth/setup-password`
   - `https://marketing.petersandmay.com/login`
4. **Click "Save"**

## ✅ Step 3: Wait and Test

1. **Wait 1-2 minutes** for changes to propagate
2. **Clear browser cache** or use **Incognito/Private mode**
3. **Refresh your application** at `https://marketing.petersandmay.com`
4. **Check browser console** - CORS errors should be gone

## 🔍 Verification

After completing both steps, you should see:
- ✅ No CORS errors in browser console
- ✅ Auth requests to `/auth/v1/user` succeed
- ✅ Data requests to `/rest/v1/*` succeed
- ✅ Application loads and functions normally

## ⚠️ If Errors Persist

1. **Double-check the domain** - Make sure there are no typos (case-sensitive)
2. **Check Supabase project** - Ensure you're configuring the correct project
3. **Verify SQL ran successfully** - Check for any error messages in SQL Editor
4. **Check browser console** - Look for the exact origin in error messages
5. **Wait longer** - Some changes can take up to 5 minutes to propagate

## 📝 Quick SQL Command (Alternative)

If you prefer to run just the essential commands:

```sql
ALTER ROLE authenticator
SET pgrst.server_cors_allowed_origins='http://localhost:3000,https://marketing.petersandmay.com';
NOTIFY pgrst,'reload config';
```

Then verify:
```sql
SELECT current_setting('pgrst.server_cors_allowed_origins', true);
```

## 🔗 Related Documentation

- Full guide: `docs/guides/SUPABASE_CORS_CONFIGURATION.md`
- Migration file: `supabase/migrations/fix_cors_for_production_domain.sql`
