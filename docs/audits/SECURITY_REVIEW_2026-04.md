# Security review — April 2026 (delta)

This document records changes made during the full-app audit implementation. It supplements [COMPREHENSIVE_APP_AUDIT_2026.md](./COMPREHENSIVE_APP_AUDIT_2026.md); that file may still list items already addressed in code.

## Changes implemented

1. **Cron endpoint (`/api/automations/run-scheduled`)**  
   In production, `CRON_SECRET` is **required**. If it is missing, the route returns **503** (misconfiguration). If it is set, only `Authorization: Bearer <CRON_SECRET>` is accepted. Development allows calls when `CRON_SECRET` is unset; if set, the bearer must match.

2. **Webhook routes (`/api/hooks/*`)**  
   These paths are **public in middleware** so external systems (no Supabase session) can POST. The handler uses the **service role** client to resolve automations by `webhook_id` (unguessable id). **Rate limiting** applies per IP when Upstash env vars are set (same pattern as other APIs).

3. **Public branding API (`GET /api/workspace-settings`)**  
   **Rate limiting** per IP when Upstash is configured, to reduce scraping/DoS risk. Response shape unchanged (branding fields only).

4. **Client IP helper**  
   Shared [`baserow-app/lib/request-ip.ts`](../../baserow-app/lib/request-ip.ts) for consistent `x-forwarded-for` / `x-real-ip` handling in rate-limited routes.

5. **API error responses**  
   [`createErrorResponse`](../../baserow-app/lib/api/error-handling.ts) omits internal `message` / `code` / `details` for **5xx** responses when `NODE_ENV === 'production'`, returning only the safe `defaultMessage`.

6. **Debug telemetry**  
   Removed hardcoded `127.0.0.1:7242` ingest calls from `InterfacePageClient`, `ErrorBoundary`, and `pages/[pageId]/error.tsx`. Optional dev-only telemetry remains in [`debug-telemetry.ts`](../../baserow-app/lib/debug-telemetry.ts) behind `NEXT_PUBLIC_DEBUG_TELEMETRY`.

7. **Pre-deploy warning**  
   When `VERCEL_ENV=production` and `CRON_SECRET` is unset, [`predeploy-check`](../../baserow-app/scripts/predeploy-check.ts) logs a warning.

## Overlay / navigation (regression prevention)

Ripgrep confirmed dimming layers use `md:left-64` where appropriate; mobile sidebar overlay remains `desktop:hidden` full-screen (acceptable per project rules).

## RLS and database

Many historical migrations use `USING (true)` for authenticated roles; tightening further is a **database project** (review per table, especially mutating policies). No new migration was added in this pass.

## Residual risks (document only)

- **CSRF:** Cookie-based session with same-site defaults; state-changing fetches from third-party origins remain a documented trade-off.  
- **CORS / Supabase:** Follow existing Supabase dashboard and project docs if production CORS issues appear.  
- **Webhook security:** Relies on secret `webhook_id` in the URL; consider optional HMAC signing on `trigger_config` for high-assurance integrations.
