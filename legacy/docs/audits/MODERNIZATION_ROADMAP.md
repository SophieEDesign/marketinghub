# Modernization roadmap

Staged upgrades for [`baserow-app/`](../../baserow-app/). Avoid big-bang dependency jumps; run `npm test` and smoke E2E after each step.

## 1. Safe patches (`npm audit fix`)

Run from `baserow-app/`:

```bash
npm audit fix
```

Addresses several moderate issues without forcing major version bumps. Re-run tests.

## 2. Next.js 14 → 15+ (and React 19)

- Read the official Next.js upgrade guide for your target version.  
- Watch for App Router default caching, `fetch` semantics, and any deprecated APIs you use.  
- `npm audit` currently suggests `next@16.x` only via `--force`; prefer stepping **14 → 15** first, then evaluate 16.  
- After upgrade, consider re-enabling ESLint during production builds in `next.config.js` once warning debt is low.

## 3. Vitest / Vite / esbuild

Audit output may recommend Vitest 4.x to pull in fixed transitive `esbuild`/`vite`. Treat as a **dev-only** upgrade with its own changelog review.

## 4. ESLint 9 + flat config

When `eslint-config-next` supports your target matrix, migrate from legacy `.eslintrc` (if present) to flat config in a dedicated PR.

## 5. react-quill / quill

Moderate XSS advisories affect transitive `quill`. Options: upgrade when a safe combination exists, replace editor, or ensure output is always sanitized at render time (you already use `isomorphic-dompurify` in places—verify all rich-text surfaces).

## 6. Bundle size

Use existing script:

```bash
npm run build:analyze
```

Sample largest routes; extend patterns like `LazyBlockWrapper` for heavy blocks.

## npm audit snapshot (April 2026)

Last run reported **17** vulnerabilities (8 moderate, 9 high), spanning `next`, `glob`, `lodash`, `quill`, `vitest` transitive tree, etc. Re-run `npm audit` after any upgrade; do not use `npm audit fix --force` without reviewing breaking changes.
