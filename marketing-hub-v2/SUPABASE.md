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

## Adding users (Member vs External)

Manage users at **Admin → Users**. With `SUPABASE_SERVICE_ROLE_KEY` set, invites go through Supabase Auth; otherwise the page uses the local demo store.

### Role → session → destination

| Profile role (`profiles.role`) | Session role | Where they land |
|--------------------------------|--------------|-----------------|
| `admin` | `admin` | `/app` — full hub + user/data admin |
| `member` | `staff` | `/app` — day-to-day staff modules |
| `external` | `media_guest` | `/media` only (redirected out of `/app`) |

### Add a Member (staff)

1. Confirm they need day-to-day hub access (not media-only).
2. **Admin → Users → Invite user** — name, work email, role **Member**.
3. They accept the Supabase invite email and set a password.
4. They sign in at `/login` → land in `/app` as staff.
5. Optional: link them to a **Contact** so they can use **My details** (`/app/me`).

### Add an External (media / outside)

1. Confirm they only need the **public media gallery**, not the staff hub.
2. **Admin → Users → Invite user** — name, email, role **External**.
3. They accept the invite and sign in.
4. They are sent to `/media` (cannot use `/app`).
5. Ensure media folders they should see are marked **Public** in Media (Internal folders stay staff-only).
6. The Admin “External” view toggle is preview-only for admins — live External users never use `/app`.

### Change role later

- Use the role dropdown on the user row (Admin → Users).
- Member → External: next sign-in they lose `/app` and only get `/media`.
- External → Member: they gain staff hub access (ensure that is intentional).

### Prerequisites

- `SUPABASE_SERVICE_ROLE_KEY` set for live invites.
- Supabase Auth email (invite) configured in the project.
