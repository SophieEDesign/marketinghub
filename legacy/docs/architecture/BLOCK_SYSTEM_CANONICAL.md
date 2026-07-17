# Block System – Canonical Path

This document defines the **canonical** block stack for the interface. It is the single source of truth for "edit once, affects all" and for adding or modifying block types. No behaviour change is implied; this is documentation only.

## Canonical stack

| Layer | Canonical artifact | Location |
|-------|--------------------|----------|
| **Block model** | `PageBlock` | `baserow-app/lib/interface/types.ts` |
| **Config schema** | `BlockConfig` + extended types | `types.ts` + `baserow-app/lib/interface/block-config-types.ts` |
| **Settings registry** | Block data/appearance settings | `baserow-app/components/interface/settings/blockSettingsRegistry.tsx` |
| **Renderer** | Block renderer (consumes `PageBlock`) | `baserow-app/components/interface/BlockRenderer.tsx` |
| **Storage** | Persisted blocks | `view_blocks` table (data mapped to `PageBlock` via layout mapping, e.g. `lib/interface/layout-mapping.ts`, `lib/pages/loadPage.ts`, API routes) |

## Parallel path (adapter candidate)

The **ViewBlock** type and **`baserow-app/components/blocks/BlockRenderer.tsx`** path (ViewBlock-based, different type and switch) are a **parallel product path** and a **candidate for adapter** later. They are **not** a second source of truth. View-type pages will inherit behaviour later via the adapter; the canonical path above is the single source of truth.

**Do not add new behaviour only to** `components/blocks/BlockRenderer` or ViewBlock-only surfaces.

## Related

- **Adding or modifying a block:** [ADDING_A_BLOCK_CHECKLIST.md](./ADDING_A_BLOCK_CHECKLIST.md)
- **Architecture overview:** [ARCHITECTURE_SUMMARY.md](./ARCHITECTURE_SUMMARY.md)
