# Legacy Code Cleanup Plan

**Date:** February 2026  
**Executed:** February 16, 2026  
**Related:** [CODE_AUDIT_REPORT](../audits/CODE_AUDIT_REPORT.md)

---

## Execution Summary (February 16, 2026)

The following root-level directories were removed as orphaned legacy code (not used by baserow-app build):

- **`lib/`** – Entire directory (icons.ts, supabase.ts, views.ts, data.ts, roles.ts, permissions.ts, navigation.ts, import/, grid-view-settings.ts, blocks.ts)
- **`components/`** – Entire directory (ui/, navigation/, views/, blocks/, workspace/, calendar/, settings/, etc.)

**Verification:** No baserow-app files import from root `lib/` or `components/`. The app runs from `baserow-app/` only; `@/*` maps to `baserow-app/*`.

**Preserved:** `baserow-app/components/blocks/BlockRenderer.tsx` – Kept (used by InterfacePage and block-drift).

---

## Summary

The codebase has ~50+ duplicate files between root-level directories (`app/`, `components/`, `lib/`) and `baserow-app/`. The **active application** is in `baserow-app/`; root-level code is legacy.

## Active vs Legacy

| Location | Status | Notes |
|----------|--------|-------|
| `baserow-app/` | **Active** | Main Next.js app, 294+ files |
| Root `app/` | Legacy | 9 files, may redirect to baserow-app |
| Root `components/` | Legacy | Duplicates of baserow-app components |
| Root `lib/` | Legacy | Duplicate utilities |

## Cleanup Steps (Do Not Execute Without Verification)

1. **Verify root app usage**
   - Check if `next.config.js` or routing points to root `app/`
   - If the project runs from `baserow-app/` only, root `app/` may be unused

2. **Remove root duplicates** (after verification)
   - Remove root `components/ui/*` (keep baserow-app version)
   - Remove root `lib/utils.ts`, `lib/icons.ts` if unused
   - Remove root `components/blocks/BlockRenderer.tsx` (legacy)

3. **Update imports**
   - Ensure no baserow-app files import from root `lib/` or `components/`

4. **Document**
   - Update README to state baserow-app is the single source of truth

## Risk

Removing root files may break builds if:
- Root layout or middleware imports from root `lib/`
- Monorepo or workspace config references root paths

**Recommendation:** Run full test suite and manual smoke test before deleting any root files.
