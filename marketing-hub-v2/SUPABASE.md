# Supabase (Marketing Hub v2)

## Project

- **Name:** Marketing Hub  
- **Ref:** `hwtycgvclhckglmuwnmw`  
- **Packages (current):** `@supabase/ssr` ^0.12.3, `@supabase/supabase-js` ^2.110.6 — no urgent bump needed.

## Client layout

| Module | Purpose |
|--------|---------|
| [`src/lib/supabase/client.ts`](src/lib/supabase/client.ts) | Browser anon (login) |
| [`src/lib/supabase/server.ts`](src/lib/supabase/server.ts) | SSR anon (cookies) |
| [`src/lib/supabase/admin.ts`](src/lib/supabase/admin.ts) | **Only** service-role factory (fail-hard; never falls back to anon) |

## Migrations

Canonical tree: [`supabase/migrations/`](supabase/migrations/)

| File | Notes |
|------|--------|
| `001_hub_v2_schema.sql` | Initial greenfield tables |
| `002_quarterly_themes.sql` | Themes hierarchy |
| `003_profiles_external_role.sql` | External role |
| `004_hub_local_tables.sql` | Hub-compatible text-id tables + awards/tasks/merch/… |
| `005_hub_store_and_rls.sql` | Durable `hub_store` + staff RLS on core greenfield tables |
| `006_media_public_title.sql` | Media public title column |
| `007_hub_staff_rls_extended.sql` | Staff RLS on themes + hub-local tables |

Legacy / root `supabase/migrations` and `legacy/supabase` are **frozen historical** — see [`../LEGACY_AND_V2.md`](../LEGACY_AND_V2.md).

## Security notes

- App CRUD uses service role against `hub_store` (no anon policies).
- Greenfield table policies use `is_hub_staff()` (admin/member profiles), not `using (true)`.
- Core Data `table_*` RLS may still be broad for the legacy builder — keep all privileged hub access server-side.
