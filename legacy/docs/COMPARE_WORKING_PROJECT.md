# Compare Working vs Non-Working Supabase Projects

## Working Project
- **Project Reference**: `81k6ChVND`
- **Status**: CORS works correctly ✅

## Non-Working Project  
- **Project Reference**: `hwtycgvclhckglmuwnmw`
- **Status**: CORS returns wildcard `*` ❌

## What to Check in the Working Project

### 1. Check Role Configuration

Run this in the **working project's** SQL Editor:

```sql
SELECT 
  rolname,
  rolconfig
FROM pg_roles 
WHERE rolname IN ('anon', 'authenticator', 'postgres', 'service_role')
ORDER BY rolname;
```

**Look for:**
- Does `anon` or `authenticator` have `pgrst.server_cors_allowed_origins`?
- What's the exact format of the setting?
- Are there any other `pgrst.*` settings?

### 2. Check PostgREST Settings

```sql
SELECT 
  name,
  setting,
  source,
  context
FROM pg_settings 
WHERE name LIKE '%cors%' OR name LIKE '%pgrst%'
ORDER BY name;
```

### 3. Test CORS Headers from Working Project

Test the working project's API:

```powershell
$headers = @{
    "Origin" = "https://marketing.petersandmay.com"
    "Access-Control-Request-Method" = "GET"
}
$response = Invoke-WebRequest -Uri "https://81k6ChVND.supabase.co/rest/v1/?select=1" -Method OPTIONS -Headers $headers
Write-Host "Access-Control-Allow-Origin: $($response.Headers['Access-Control-Allow-Origin'])" -ForegroundColor Yellow
```

**Expected:** Should show the specific origin, not `*`

### 4. Check Dashboard Settings

In the **working project's** Supabase Dashboard:
1. Go to **Settings → API**
2. Look for any CORS-related settings
3. Check if there's a "CORS" or "Allowed Origins" configuration option

### 5. Check Project Age/Plan

- When was the working project created?
- What Supabase plan is it on?
- When was the non-working project created?
- What Supabase plan is it on?

**Hypothesis:** Older projects or different plans might have different CORS configuration methods.

## Questions to Answer

1. **Does the working project have `pgrst.server_cors_allowed_origins` in `rolconfig`?**
   - If yes, on which role?
   - If no, how is CORS configured there?

2. **Are there Dashboard settings in the working project that don't exist in the non-working one?**
   - Check Settings → API for CORS options

3. **Is the working project on a different Supabase plan?**
   - Some features might be plan-specific

4. **When was each project created?**
   - Supabase may have changed how CORS works over time

## Share Results

Once you've checked the working project, share:
- The `rolconfig` results for all roles
- Any Dashboard settings that differ
- The CORS header test result from the working project
- Project creation dates and plans

This will help identify what's different and why one works while the other doesn't!
