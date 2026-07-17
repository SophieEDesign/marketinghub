# Test CORS Headers After Setting on anon Role

## Quick Test - Run This Now

The `pgrst.server_cors_allowed_origins` setting is now on the `anon` role. Test if PostgREST is now reading it:

```powershell
$headers = @{
    "Origin" = "https://marketing.petersandmay.com"
    "Access-Control-Request-Method" = "GET"
}
$response = Invoke-WebRequest -Uri "https://hwtycgvclhckglmuwnmw.supabase.co/rest/v1/?select=1" -Method OPTIONS -Headers $headers
Write-Host "`n=== CORS Headers After anon Role Fix ===" -ForegroundColor Cyan
Write-Host "Access-Control-Allow-Origin: $($response.Headers['Access-Control-Allow-Origin'])" -ForegroundColor Yellow
Write-Host "Access-Control-Allow-Methods: $($response.Headers['Access-Control-Allow-Methods'])" -ForegroundColor Yellow
Write-Host "Access-Control-Allow-Credentials: $($response.Headers['Access-Control-Allow-Credentials'])" -ForegroundColor Yellow
```

## What to Look For

### ✅ SUCCESS - If you see:
```
Access-Control-Allow-Origin: https://marketing.petersandmay.com
```
**This means:** PostgREST IS reading from `anon.rolconfig` and the fix worked!

### ❌ STILL BROKEN - If you see:
```
Access-Control-Allow-Origin: *
```
**This means:** PostgREST is still not reading the role config, even from `anon`. This suggests:
- PostgREST may not read from role config at all in managed Supabase
- There may be an edge/CDN (Cloudflare) overriding the headers
- PostgREST may need a full restart, not just a reload

## Next Steps Based on Results

### If it's working (shows specific origin):
1. ✅ Problem solved! The issue was that PostgREST connects as `anon`, not `authenticator`
2. Test your production site - CORS errors should be resolved
3. You may want to keep the setting on both roles for redundancy

### If it's still `*`:
1. Contact Supabase Support with the updated request
2. The issue is likely that PostgREST doesn't read from role config in managed projects
3. Or there's an edge/CDN layer overriding the headers

## Also Test with Different Origin

To confirm it's not just returning wildcard, test with a random origin:

```powershell
$headers = @{
    "Origin" = "https://random.example.com"
    "Access-Control-Request-Method" = "GET"
}
$response = Invoke-WebRequest -Uri "https://hwtycgvclhckglmuwnmw.supabase.co/rest/v1/?select=1" -Method OPTIONS -Headers $headers
Write-Host "Access-Control-Allow-Origin (random origin): $($response.Headers['Access-Control-Allow-Origin'])" -ForegroundColor Yellow
```

- If it returns `*` for random origin: PostgREST is still using wildcard
- If it returns nothing or an error: PostgREST is properly filtering origins ✅
