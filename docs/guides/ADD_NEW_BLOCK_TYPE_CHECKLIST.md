# Add a New Block Type — Checklist

Use this checklist so edits are done once and in the right order. The canonical block model is PageBlock; see [BLOCK_SYSTEM_CANONICAL.md](../architecture/BLOCK_SYSTEM_CANONICAL.md).

**Order:** Work through the list in sequence. Each step may require the previous ones to be in place.

---

## 1. BlockType and BlockConfig (`types.ts`)

**File:** `baserow-app/lib/interface/types.ts`

- [ ] Add the new value to the `BlockType` union type.
- [ ] Extend `BlockConfig` with any config properties specific to this block (e.g. `image_url`, `chart_type`). Use optional properties unless the block cannot function without them.

---

## 2. Config schema and validation (`block-config-types.ts`)

**File:** `baserow-app/lib/interface/block-config-types.ts`

- [ ] If the block has required or constrained config, add or extend a discriminated config type (e.g. `ImageBlockConfig`, `ChartBlockConfig`) and document required fields.
- [ ] Ensure `validateBlockConfig` (or the type-specific validator) handles the new block type so invalid config is normalized and does not crash the renderer.

---

## 3. Block validator and assertions (`block-validator.ts`, `assertBlockConfig.ts`)

**Files:**  
- `baserow-app/lib/interface/block-validator.ts`  
- `baserow-app/lib/interface/assertBlockConfig.ts`

- [ ] If the block needs default or normalized config, update `normalizeBlockConfig` in `block-validator.ts` for the new `BlockType`.
- [ ] Update `assertBlockConfig` in `assertBlockConfig.ts` so the new block type is considered valid/invalid correctly (e.g. for setup state vs ready-to-render).

---

## 4. Settings registry (`blockSettingsRegistry.tsx`)

**File:** `baserow-app/components/interface/settings/blockSettingsRegistry.tsx`

- [ ] Add a **data** settings entry in `DATA_SETTINGS_RENDERERS` for the new block type (if it has data/source settings).
- [ ] Add an **appearance** settings entry in `APPEARANCE_SETTINGS_RENDERERS` for the new block type (if it has appearance options).
- [ ] Create or reuse the actual settings components (e.g. `XxxDataSettings`, `XxxAppearanceSettings`) and wire them in the registry.

---

## 5. Block component and BlockRenderer (`BlockRenderer.tsx` + block component)

**Files:**  
- `baserow-app/components/interface/BlockRenderer.tsx`  
- `baserow-app/components/interface/blocks/<BlockName>Block.tsx` (new or existing)

- [ ] Implement the block UI component that accepts `PageBlock` (and optional `onUpdate`, `pageTableId`, etc. as per existing blocks).
- [ ] In `BlockRenderer.tsx`, add a `case` for the new `BlockType` in the render switch and render the new block component.
- [ ] Ensure the block receives a normalized config (BlockRenderer uses `normalizeBlockConfig`); handle setup/incomplete state in the block component if needed.

---

## 6. Optional: Registry and defaults

**File:** `baserow-app/lib/interface/registry.ts` (if used for block metadata)

- [ ] If the app uses a block registry (e.g. `BLOCK_REGISTRY`) for labels, icons, or default layout, add an entry for the new block type.

---

## Summary order

1. `types.ts` — BlockType, BlockConfig  
2. `block-config-types.ts` — config shape and validation  
3. `block-validator.ts` / `assertBlockConfig.ts` — normalization and assertions  
4. `blockSettingsRegistry.tsx` — data and appearance settings UI  
5. New block component + `BlockRenderer.tsx` — rendering  
6. Registry (if applicable) — metadata and defaults  

After this, the new block type is part of the canonical system; once the view type "page" adapter is implemented, it will also be used there without extra work.
