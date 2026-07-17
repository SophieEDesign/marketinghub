# Adding or modifying a BlockType (Canonical Path)

Use this checklist when adding a new block type or changing an existing one on the **canonical** path. The canonical path is the single source of truth; see [BLOCK_SYSTEM_CANONICAL.md](./BLOCK_SYSTEM_CANONICAL.md).

- [ ] **types.ts** — Add or update `BlockType` and any `BlockConfig` fields in `baserow-app/lib/interface/types.ts`.
- [ ] **block-config-types.ts** — Add or update the config type and `BlockConfigUnion` (and type guards if applicable) in `baserow-app/lib/interface/block-config-types.ts`.
- [ ] **blockSettingsRegistry.tsx** — Register data and/or appearance settings for the type in `baserow-app/components/interface/settings/blockSettingsRegistry.tsx`.
- [ ] **interface/BlockRenderer.tsx** — Add a switch case and the corresponding block component in `baserow-app/components/interface/BlockRenderer.tsx`.
- [ ] **Block validator / defaults** — Update `baserow-app/lib/interface/block-validator.ts` and `baserow-app/lib/interface/registry.ts` (defaults) if applicable.

**Important:** Do not add new behaviour only to `components/blocks/BlockRenderer` (or ViewBlock-only surfaces). View-type pages will inherit behaviour later via the adapter; the canonical path is the single source of truth.
