# Troubleshooting Guide

**Date:** February 2026

---

## Common Issues

### Pages Not Loading

**Symptoms:** Blank page, "Loading..." never completes, cannot navigate.

**Checks:**
1. Browser console: Look for `loadBlocks` logs; API should return blocks
2. Network tab: Verify `/api/pages/[pageId]/blocks` returns 200 with data
3. Overlay: Mobile sidebar overlay can block clicks when open — close sidebar and retry

**Related:** [BROKEN_PAGES_LOADING_FIX](../fixes/BROKEN_PAGES_LOADING_FIX.md)

### Login Redirect Loop

**Symptoms:** Redirected to login repeatedly after signing in.

**Checks:**
1. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set correctly
2. Auth callback URL in Supabase matches app URL (e.g. `https://yourapp.com/auth/callback`)
3. Cookies: Ensure third-party cookies not blocked if using custom domain

### CORS Errors in Production

**Symptoms:** `Access-Control-Allow-Origin` errors when calling Supabase from your domain.

**Cause:** Supabase PostgREST may not honor `pgrst.server_cors_allowed_origins` in managed projects.

**Workaround:** Add your production domain to Supabase Dashboard → Settings → API → CORS. If issues persist, contact Supabase support.

**Related:** [SUPABASE_CORS_SUPPORT_REQUEST_UPDATED](../SUPABASE_CORS_SUPPORT_REQUEST_UPDATED.md)

### Rate Limit 429 on Invite

**Symptoms:** "Too many requests" when inviting users.

**Cause:** Rate limiting is active when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set. Limit: 5 invites per 15 minutes per IP.

**Fix:** Wait 15 minutes or use a different network. For testing, leave Upstash env vars unset (rate limiting disabled).

### Build Fails: predeploy-check

**Symptoms:** `npm run build` fails at predeploy-check step.

**Cause:** `tsx` or script path not found.

**Fix:** Run `npm install` in baserow-app. Ensure `tsx` is in devDependencies. To skip: `npm run next build` (bypasses predeploy-check).

---

## Debug Mode

Set `AUTH_BYPASS=true` (dev only) to skip auth in middleware. Never use in production.

Set `NEXT_PUBLIC_DEBUG_TELEMETRY=1` to enable debug logging (see .env.example).
