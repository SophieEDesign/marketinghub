# Supabase Support Request: CORS Configuration Not Persisting

## Issue Summary
Unable to configure `pgrst.server_cors_allowed_origins` for PostgREST Data API. The `ALTER ROLE authenticator SET` command executes successfully but the setting shows as an empty string when queried, and CORS errors persist in production.

## Error Details

### CORS Error in Browser
```
Access to fetch at 'https://hwtycgvclhckglmuwnmw.supabase.co/auth/v1/user' from origin 'https://marketing.petersandmay.com' 
has been blocked by CORS policy: Response to preflight request doesn't pass access control check: 
The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' 
when the request's credentials mode is 'include'.
```

### SQL Command Executed
```sql
ALTER ROLE authenticator
SET pgrst.server_cors_allowed_origins='http://localhost:3000,https://marketing.petersandmay.com,https://marketinghub-jet.vercel.app';
NOTIFY pgrst,'reload config';
```

### Result
- ✅ `ALTER ROLE` command executes without errors (no permission issues)
- ✅ `NOTIFY pgrst,'reload config'` executes successfully
- ❌ `current_setting('pgrst.server_cors_allowed_origins', true)` returns empty string (`''`)
- ❌ CORS errors persist in production application

## Environment Details
- **Project Reference**: `hwtycgvclhckglmuwnmw`
- **Production Domain**: `https://marketing.petersandmay.com`
- **Vercel Preview**: `https://marketinghub-jet.vercel.app`
- **Development**: `http://localhost:3000`

## What We've Tried

1. ✅ Verified Auth API CORS in Dashboard (Authentication → URL Configuration)
   - Site URL: `https://marketing.petersandmay.com`
   - Redirect URLs configured for production and Vercel

2. ✅ Executed `ALTER ROLE authenticator SET pgrst.server_cors_allowed_origins` via SQL Editor
   - Command executes without permission errors
   - Setting does not persist (shows as empty string)

3. ✅ Verified user has sufficient privileges
   - `ALTER ROLE` command executes successfully
   - No `insufficient_privilege` errors

## Questions for Support

1. **Is `ALTER ROLE authenticator SET pgrst.server_cors_allowed_origins` the correct method for managed Supabase projects?**
   - The command executes but the setting doesn't persist
   - Is there a dashboard setting or alternative method?

2. **Why does `current_setting('pgrst.server_cors_allowed_origins', true)` return an empty string after setting it?**
   - Is PostgREST reading from a different configuration source?
   - Are role-level settings overridden by project-level config?

3. **What is the recommended way to configure CORS for PostgREST in managed Supabase projects?**
   - Should this be done via Dashboard, API, or SQL?
   - Are there project-level settings that override role settings?

4. **Is there a way to verify PostgREST's actual CORS configuration?**
   - How can we confirm what origins PostgREST is actually allowing?

## Expected Behavior
After setting `pgrst.server_cors_allowed_origins`, we expect:
- `current_setting('pgrst.server_cors_allowed_origins', true)` to return the configured origins
- CORS errors to be resolved for requests from `https://marketing.petersandmay.com`
- PostgREST to honor the configured origins instead of using wildcard `*`

## Additional Context
- Application uses `credentials: 'include'` in fetch requests (required for authentication cookies)
- Browser security requires specific origins (not wildcard) when credentials are included
- Both Auth API (`/auth/v1/*`) and Data API (`/rest/v1/*`) are experiencing CORS issues
- Auth API CORS configured via Dashboard appears correct

## Request
Please advise on:
1. The correct method to configure PostgREST CORS in managed Supabase projects
2. Why the role setting isn't persisting
3. Any project-level configuration that might be needed

Thank you for your assistance!
