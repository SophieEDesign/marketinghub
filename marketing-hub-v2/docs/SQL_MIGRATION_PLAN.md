# SQL migration plan (hub_store → relational tables)

This document outlines the recommended path to move high-churn collections out of the monolithic `hub_store` JSON blob into the greenfield SQL tables already defined in `supabase/migrations/001_hub_v2_schema.sql`.

## Current state

| Layer | Role |
|-------|------|
| `public.hub_store` | **Runtime source of truth** for all domain CRUD |
| Greenfield SQL (`events`, `content_items`, `tasks`, …) | Created by migrations; **not written by app CRUD today** |
| Legacy Core Data `table_*` | Import-only via `/api/supabase/import` |

`readStore()` is now cached per request via React `cache()` in [`src/lib/store/local.ts`](../src/lib/store/local.ts). Writes still use `ensureStore()` directly for CAS consistency.

## Phase 1 — Dual-write (events, content, tasks)

1. Add repository adapters that write to **both** `hub_store` and SQL tables in one transaction (service role).
2. Keep reads from `hub_store` until parity is verified.
3. Add nightly job or admin action to diff counts and spot-check rows.

**Priority order:** `content` → `events` → `tasks` (highest edit frequency).

## Phase 2 — Read from SQL

1. Flip `listEvents`, `listContent`, `listTasks` to SQL with hub_store fallback.
2. Remove duplicate full-store reads on the home dashboard (replace with `SELECT count(*)` per table).
3. Add indexes: `(status)`, `(due_date)`, `(starts_at)` on migrated tables.

## Phase 3 — Stop writing hub_store slices

1. Stop merging migrated collections into `hub_store` JSON on import/export.
2. Keep low-churn collections in JSON: `merch_*`, `reports`, `platform_credentials`, `staff_requests`, `budget_*`.

## Phase 4 — Credentials and secrets

1. Move `platform_credentials` to a dedicated encrypted table or external secrets manager.
2. Rotate `CREDENTIALS_ENCRYPTION_KEY` with re-encryption migration.

## Rollback

- Export hub_store before each phase (`/api/supabase/export`, admin only).
- Feature flag per collection: `HUB_READ_CONTENT_FROM=sql|store`.

## Success metrics

- Home page: ≤3 DB round-trips (down from 6–7 full-store reads).
- Content/Events page load: no full JSON blob fetch for list views.
- Media/enquiries: paginated API (limit/offset) — implemented in audit pass.
