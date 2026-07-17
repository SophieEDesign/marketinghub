# Supabase CORS Configuration

**Purpose:** Document CORS verification steps and known limitations for Marketing Hub production deployment.

---

## Verification Checklist

### 1. Supabase Dashboard – API CORS

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → select project.
2. Go to **Project Settings** → **API**.
3. Locate **CORS** or **Allowed Origins** section.
4. Confirm these origins are included:
   - `http://localhost:3000` (development)
   - `https://marketing.petersandmay.com` (production)
   - `https://marketinghub-jet.vercel.app` (Vercel preview)

### 2. Auth API CORS (Separate from PostgREST)

- Auth API (`/auth/v1/*`) CORS is configured via **Authentication** → **URL Configuration**.
- Add the same origins as above to **Site URL** and **Redirect URLs** as needed.

### 3. PostgREST Data API CORS

- PostgREST (`/rest/v1/*`) CORS may be configured separately.
- In managed Supabase projects, PostgREST CORS is **not** always configurable via Dashboard.
- See [Known Limitations](#known-limitations) below.

### 4. Production Test

1. Deploy to production or use preview URL.
2. Open browser DevTools → Network tab.
3. Trigger a Supabase request (e.g. load a page, fetch data).
4. Check for CORS errors in Console.
5. Inspect response headers for `Access-Control-Allow-Origin` — it should match your origin, not `*`.

---

## Known Limitations

**Issue:** PostgREST may not honor `pgrst.server_cors_allowed_origins` set via SQL in managed Supabase projects.

**Details:**
- `ALTER ROLE authenticator SET pgrst.server_cors_allowed_origins='...'` stores the value correctly in `rolconfig`.
- PostgREST still returns `Access-Control-Allow-Origin: *` in responses.
- Requests with `credentials: 'include'` fail because browsers reject wildcard CORS when credentials are used.

**Full context:** [SUPABASE_CORS_SUPPORT_REQUEST_UPDATED.md](../SUPABASE_CORS_SUPPORT_REQUEST_UPDATED.md)

---

## Workarounds

1. **Dashboard CORS:** Add production domain(s) in Supabase Dashboard → Settings → API → CORS (if available).
2. **Contact Supabase Support:** If CORS errors persist, use the support request doc above.
3. **Troubleshooting:** See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) → CORS Errors in Production.

---

## Related Files

- [SUPABASE_CORS_SUPPORT_REQUEST_UPDATED.md](../SUPABASE_CORS_SUPPORT_REQUEST_UPDATED.md) – Support request and technical details
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) – CORS error workaround
- [TEST_CORS_HEADERS.md](../TEST_CORS_HEADERS.md) – How to test CORS headers
