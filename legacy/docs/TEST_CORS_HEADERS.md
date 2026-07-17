# Test CORS Headers from PostgREST

## Quick curl Test (Check Access-Control-Allow-Origin)

**Purpose:** Make a request to your PostgREST API endpoint and view response headers to confirm if PostgREST is reading the role-local config.

### Test 1: OPTIONS Preflight with Production Origin

```bash
curl -i -X OPTIONS "https://hwtycgvclhckglmuwnmw.supabase.co/rest/v1/?select=1" \
  -H "Origin: https://marketing.petersandmay.com" \
  -H "Access-Control-Request-Method: GET"
```

**What to look for:**
- In the response headers, check for `Access-Control-Allow-Origin`
- **If it equals `*`**: PostgREST is NOT reading the role-local `pgrst.server_cors_allowed_origins`
- **If it equals `https://marketing.petersandmay.com`** (or a matching origin): PostgREST IS reading the config ✅

### Test 2: Test with Different Origin (Confirm Wildcard Behavior)

```bash
curl -i -X OPTIONS "https://hwtycgvclhckglmuwnmw.supabase.co/rest/v1/?select=1" \
  -H "Origin: https://random.example.com" \
  -H "Access-Control-Request-Method: GET"
```

**What to look for:**
- If `Access-Control-Allow-Origin` is still `*` for this unrelated origin, PostgREST is returning a wildcard (not reading config)

### Test 3: GET Request (Some Servers Only Set CORS on OPTIONS Preflight)

```bash
curl -i "https://hwtycgvclhckglmuwnmw.supabase.co/rest/v1/?select=1" \
  -H "Origin: https://marketing.petersandmay.com" \
  -H "apikey: YOUR_ANON_KEY"
```

**What to look for:**
- Check response headers for `Access-Control-Allow-Origin`
- Some setups echo origin only on OPTIONS; others set on GET too

### Test 4: Using httpie (Easier-to-Read Output)

If you have `httpie` installed:

```bash
http --headers OPTIONS "https://hwtycgvclhckglmuwnmw.supabase.co/rest/v1/?select=1" \
  Origin:"https://marketing.petersandmay.com" \
  Access-Control-Request-Method:GET
```

## Interpreting Results

### If you see `Access-Control-Allow-Origin: *`

**Conclusion:** PostgREST is returning wildcard CORS — it is **NOT** using the role-local `pgrst.server_cors_allowed_origins` value.

**Next steps:**
1. Confirm which DB role PostgREST connects as in your environment
   - If it does NOT connect as the `authenticator` role, role-local settings on `authenticator` won't be read
2. If PostgREST connects as `authenticator`, restart/reload PostgREST so it re-reads role settings
   - In managed Supabase you may need to restart the project or open a support ticket
3. Alternatively, set the `pgrst.server_cors_allowed_origins` for the role that PostgREST actually uses (or set it as a server GUC if supported)

### If you see the specific origin (e.g., `Access-Control-Allow-Origin: https://marketing.petersandmay.com`)

**Conclusion:** PostgREST IS reading the role-local config correctly ✅

**Possible issues:**
- Client-side caching of CORS responses
- An intermediary (CDN) overriding headers
- Browser cache needs clearing

## Collect Results and Share

Save the raw curl output (including headers) and note the `Access-Control-Allow-Origin` line.

**Example output to share:**
```
< HTTP/1.1 200 OK
< Access-Control-Allow-Origin: *
< Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
...
```

## Alternative: Browser DevTools Test

1. Open your production site: `https://marketing.petersandmay.com`
2. Open Browser DevTools (F12) → Network tab
3. Look at any failed Supabase request
4. Check the Response Headers for `Access-Control-Allow-Origin`

**Expected if working:**
```
Access-Control-Allow-Origin: https://marketing.petersandmay.com
Access-Control-Allow-Credentials: true
```

**Current (if not working):**
```
Access-Control-Allow-Origin: *
```

## Next Steps After Testing

Once you have the results:
- **If `*` is returned:** Use `SUPABASE_CORS_SUPPORT_REQUEST_UPDATED.md` to contact Supabase Support
- **If specific origin is returned:** The issue may be browser cache or client-side - try clearing cache and testing again
