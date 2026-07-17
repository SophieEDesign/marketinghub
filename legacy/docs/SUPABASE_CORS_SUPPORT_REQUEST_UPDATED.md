# Supabase Support Request: PostgREST Not Reading CORS from Role Config

## Issue Summary
`pgrst.server_cors_allowed_origins` is correctly stored in the `authenticator` role's `rolconfig`, but PostgREST is not honoring this configuration. CORS errors persist in production despite the setting being present.

## Critical Finding
✅ **The setting IS stored correctly:**
```sql
-- Verified via: SELECT unnest(rolconfig) FROM pg_roles WHERE rolname = 'authenticator';
-- Result: pgrst.server_cors_allowed_origins=http://localhost:3000,https://marketing.petersandmay.com,https://marketinghub-jet.vercel.app
```

❌ **But PostgREST is not reading it:**
- CORS errors persist in production
- API responses still use wildcard `*` for `Access-Control-Allow-Origin`
- `NOTIFY pgrst,'reload config'` was executed but didn't resolve the issue

## Error Details

### CORS Error in Browser
```
Access to fetch at 'https://hwtycgvclhckglmuwnmw.supabase.co/auth/v1/user' from origin 'https://marketing.petersandmay.com' 
has been blocked by CORS policy: Response to preflight request doesn't pass access control check: 
The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' 
when the request's credentials mode is 'include'.
```

### Configuration Applied
```sql
ALTER ROLE authenticator
SET pgrst.server_cors_allowed_origins='http://localhost:3000,https://marketing.petersandmay.com,https://marketinghub-jet.vercel.app';
NOTIFY pgrst,'reload config';
```

### Verification Results
- ✅ `ALTER ROLE` executed successfully (no permission errors)
- ✅ Setting stored in `authenticator.rolconfig`: `pgrst.server_cors_allowed_origins=http://localhost:3000,https://marketing.petersandmay.com,https://marketinghub-jet.vercel.app`
- ✅ `NOTIFY pgrst,'reload config'` executed successfully
- ❌ **CONFIRMED**: PostgREST returns wildcard `*` in CORS headers (tested via OPTIONS request)
- ❌ CORS errors persist in production

### Actual API Response (Tested - Multiple Times)
**Test 1 (before anon fix):** OPTIONS request to `/rest/v1/?select=1` with `Origin: https://marketing.petersandmay.com`
- **Result:** `Access-Control-Allow-Origin: *`

**Test 2 (after setting on anon role):** Same OPTIONS request
- **Result:** `Access-Control-Allow-Origin: *` (still wildcard)

**Response headers observed:**
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS,TRACE,CONNECT
Server: cloudflare
CF-RAY: [cloudflare ray ID]
```

**Expected:** `Access-Control-Allow-Origin: https://marketing.petersandmay.com`  
**Actual:** `Access-Control-Allow-Origin: *` (even after setting on both `authenticator` and `anon` roles)

**Conclusion:** PostgREST is NOT reading `pgrst.server_cors_allowed_origins` from role-local `rolconfig` in managed Supabase projects, OR there's a Cloudflare/CDN layer overriding the headers before they reach the client.

## Environment Details
- **Project Reference**: `hwtycgvclhckglmuwnmw`
- **Production Domain**: `https://marketing.petersandmay.com`
- **Vercel Preview**: `https://marketinghub-jet.vercel.app`
- **Development**: `http://localhost:3000`

## Technical Details

### Role Configuration Storage
The setting is stored as a role-local configuration (not a server GUC):
- **Location**: `pg_roles.rolconfig` for role `authenticator`
- **Format**: `pgrst.server_cors_allowed_origins=http://localhost:3000,https://marketing.petersandmay.com,https://marketinghub-jet.vercel.app`
- **Verification**: Confirmed via `SELECT unnest(rolconfig) FROM pg_roles WHERE rolname = 'authenticator'`

### Role Configuration Check Results
Checked `rolconfig` for all key roles:
- ✅ **authenticator**: Has `pgrst.server_cors_allowed_origins` set correctly
- ✅ **anon**: Now also has `pgrst.server_cors_allowed_origins` set (added as test)
- ❌ **postgres**: Does NOT have `pgrst.*` settings (only has `search_path`)
- ❌ **service_role**: Has null `rolconfig`

**Critical Finding**: Even after setting `pgrst.server_cors_allowed_origins` on BOTH `authenticator` and `anon` roles, PostgREST still returns `Access-Control-Allow-Origin: *`. This indicates:
- PostgREST is NOT reading from role-local `rolconfig` in managed Supabase projects
- OR there's an edge/CDN layer (Cloudflare) overriding the headers
- OR PostgREST requires a full restart, not just `NOTIFY pgrst,'reload config'`

### PostgREST Behavior
- PostgREST should read role-local config when connecting as the `authenticator` role
- However, PostgREST is not honoring this configuration
- API responses still include `Access-Control-Allow-Origin: *`

## Questions for Support

1. **Which database role does PostgREST connect as in managed Supabase projects?**
   - We've set `pgrst.server_cors_allowed_origins` on `authenticator` role, but PostgREST isn't reading it
   - Does PostgREST connect as `anon`, `authenticator`, or a different role?
   - Should we set the CORS config on `anon` role instead?

2. **How does PostgREST reload configuration in managed Supabase?**
   - `NOTIFY pgrst,'reload config'` was executed but didn't take effect
   - Is a project restart or different method required?

3. **Are there project-level settings that override role-level config?**
   - Could environment variables or dashboard settings be overriding `rolconfig`?
   - Is there a Dashboard UI to configure PostgREST CORS?
   - **We've now set the config on both `authenticator` and `anon` roles, but PostgREST still returns wildcard**

4. **Is Cloudflare/CDN overriding CORS headers?**
   - API responses show `Server: cloudflare` header
   - Could Cloudflare be setting `Access-Control-Allow-Origin: *` before responses reach clients?
   - How can we configure CORS at the edge/CDN level if that's the case?

5. **What is the correct way to configure PostgREST CORS in managed Supabase?**
   - Should this be done via Dashboard, API, environment variables, or SQL?
   - Is the `ALTER ROLE ... SET pgrst.server_cors_allowed_origins` method supported in managed projects?
   - We've tried setting it on both `authenticator` and `anon` roles - neither worked

## Expected Behavior
After setting `pgrst.server_cors_allowed_origins` in `rolconfig`:
- PostgREST should read the setting when connecting as `authenticator`
- API responses should include `Access-Control-Allow-Origin: https://marketing.petersandmay.com` (not wildcard)
- CORS errors should be resolved for requests from configured origins

## Additional Context
- Application uses `credentials: 'include'` in fetch requests (required for authentication cookies)
- Browser security requires specific origins (not wildcard) when credentials are included
- Both Auth API (`/auth/v1/*`) and Data API (`/rest/v1/*`) are experiencing CORS issues
- Auth API CORS configured via Dashboard appears correct
- The setting is definitely stored in `rolconfig` but PostgREST isn't reading it

## Request
Please advise on:
1. Why PostgREST isn't reading the `rolconfig` setting despite it being stored correctly
2. The correct method to configure PostgREST CORS in managed Supabase projects
3. Whether a project restart or different reload method is needed
4. If there are project-level settings overriding the role configuration

Thank you for your assistance!
