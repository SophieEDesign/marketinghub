# App boundary and legacy code

## Active app

The only runnable application lives in **baserow-app/** (Next.js 14, Supabase). It has its own `package.json`, `next.config.js`, and all routes under `app/`. The repository root has no `package.json` or `next.config.js`, so nothing at the root can be run as a standalone app.

## Root-level code (legacy / unused by baserow-app)

- **Root `lib/`** – Uses `createServerSupabaseClient` / `createClientSupabaseClient` from `lib/supabase.ts`. Used only by root-level `components/` and root `lib/*.ts`. baserow-app does **not** import from the parent directory.
- **Root `components/`** – Legacy UI (blocks, calendar, navigation, views, settings). baserow-app uses only its own `baserow-app/components/` (and `@/components/*` resolving to that).
- **Root `app/`** – If present, it is non-functional as a Next app (no root-level config). All routes are in `baserow-app/app/`.

**Conclusion:** baserow-app is self-contained. No baserow-app file imports from `../` into root `lib/` or root `components/`. Root code is effectively legacy. Optional cleanup: archive or delete root `app/`, `components/`, and `lib/` after confirming no scripts or docs depend on them.

## Reference

- [ROOT_APP_DECISION_FINAL.md](../../docs/ROOT_APP_DECISION_FINAL.md) – Decision to treat baserow-app as the single app.
