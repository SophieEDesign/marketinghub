# Data sources (Supabase → Marketing Hub v2)

Keep the UI simple. Pull from the **tidy** Core Data tables only.

## Canonical sources

| Hub module | Use this Supabase table | Do not use |
|------------|-------------------------|------------|
| **Events** | Dedicated **Events** table (`table_events_…`) | Old **Content** rows typed as events |
| **Content planner** | **Social Posts** table | Old **Content** table (legacy planner) |
| **Themes** | **Quarterly Themes** | — |
| **Contacts** | Newer **Contact** (singular) | Older **Contacts** plural if both exist |
| **Media / Library** | **Media Links Resources** (`table_media_…`) | Google Drive (optional later) |
| **Sponsorships** | Newer **Sponsorships** | Older duplicate |
| **Memberships** | **Memberships** → Partners (`kind=membership`) | — |
| **Awards** | **Awards** | — |
| **Tasks** | **Tasks** | — |
| **Merch / staff requests / reports** | *(hub-only — not imported)* | Create/edit in the hub |
| **Social calendar** | Planable API first; Social Posts as fallback cache | — |

## Why

- Events were **split out** into their own table — Content is the old home for that data.
- Day-to-day “content” for the hub is really **Social Posts** (posts, channels, Planable links). Sorting/tidying Social Posts further can come later; we still prefer it over Content.
- The Airtable-style builder metadata (`tables`, `views`, `view_blocks`) stays in the legacy app.

## Import behaviour

When `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and usually `SUPABASE_SERVICE_ROLE_KEY`) are set:

1. Resolve physical table names via `public.tables`
2. Map rows into the simple v2 shapes
3. **Normalise** on the way in (`src/lib/data/normalize.ts`):
   - Strip HTML from notes/captions
   - Map generic `Social Post` / `social_post` → platform (LinkedIn, Instagram, …) from title/caption hints
   - Unpack JSON attachment blobs into a plain `asset_url`
   - Humanise event types (`commercial_event` → Commercial, etc.)
   - **Dedupe** Social Posts (same title) and Events (same title + start day)
4. Replace the local Events / Content / Sponsorships+Memberships / Contacts / Awards / Themes / Resources store sections (demo seed overwritten for those modules). **Merch, staff requests, and reports stay hub-local.**

To re-clean an existing `.data/store.json` without re-importing:

```bash
node scripts/clean-store.mjs
```

Turn off `AUTH_BYPASS` when you want real staff login against the same project.
