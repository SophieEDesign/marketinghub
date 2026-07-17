# Marketing Hub — live vs legacy

| App | Path | Role |
|-----|------|------|
| **New Marketing Hub (v2)** | [`marketing-hub-v2/`](marketing-hub-v2/) | **Live** product going forward |
| **Legacy hub** | [`legacy/`](legacy/) | Old Baserow / Interface Builder material — **kept for backup and redeploy** |

Do not delete `legacy/`. See [`marketing-hub-v2/README.md`](marketing-hub-v2/README.md) for run instructions.

## Same GitHub + Vercel

- **GitHub:** [SophieEDesign/marketinghub](https://github.com/SophieEDesign/marketinghub) (active — not archived)
- **Vercel:** project `marketinghub` (same project for both apps)

## Deploy / rollback

| Mode | Vercel Root Directory |
|------|------------------------|
| Live (v2) | `marketing-hub-v2` |
| Old hub (after this move) | `legacy/baserow-app` |

**Emergency rollback using the pre-move freeze:**

1. Deploy from git tag `legacy-baserow`
2. Set Vercel Root Directory to `baserow-app` (paths as they were before the `legacy/` folder move)

## What’s in `legacy/`

- `baserow-app/` — old Next.js hub (redeploy root)
- `app/`, `public/`, `types/`, `supabase/` — old root scraps
- `docs/`, `.tmp-prototype/`, `_design-handoff/`
- Admin / RLS `*.sql` scripts and revert notes

## Freeze policy (do not expand)

- **Do not** add new features or migrations under `legacy/` or root `supabase/migrations/`.
- New Supabase migrations for the live hub belong in [`marketing-hub-v2/supabase/migrations/`](marketing-hub-v2/supabase/migrations/).
- Root / `legacy/supabase` trees are **historical** (Baserow builder schema). Keep for rollback only.
- When rollback is formally retired, archive `legacy/docs`, `_design-handoff`, and `.tmp-prototype` in a separate PR — do not delete without a tagged freeze.
