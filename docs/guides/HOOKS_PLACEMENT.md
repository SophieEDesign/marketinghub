# Hooks placement

- **App hooks:** `baserow-app/hooks/` — UI hooks (`useResponsive`, `useUndoRedo`, etc.)
- **Re-exports:** `hooks/useUserRole.ts` re-exports from `lib/hooks/useUserRole.ts` (legacy path kept for existing imports)
- New hooks should live under `hooks/` unless they are tightly coupled to a `lib/` module with no React dependency
