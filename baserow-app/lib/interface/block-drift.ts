/**
 * Dev-only block drift detection. Surfaces entropy between canonical and parallel paths.
 * Runs only when NODE_ENV !== 'production'; uses only console.warn; never throws.
 * See docs/architecture/BLOCK_SYSTEM_CANONICAL.md.
 */

import type { BlockType } from './types'
import { getAllBlockTypes } from './registry'
import { BLOCK_CONFIG_UNION_TYPES } from './block-config-types'
import { PARALLEL_BLOCK_TYPES } from '@/components/blocks/BlockRenderer'
import {
  REGISTERED_DATA_BLOCK_TYPES,
  REGISTERED_APPEARANCE_BLOCK_TYPES,
} from '@/components/interface/settings/blockSettingsRegistry'

export function runBlockDriftChecks(): void {
  if (process.env.NODE_ENV === 'production') return
  try {
    const canonical = getAllBlockTypes()
    const canonicalSet = new Set(canonical)

    const parallelOnly = (PARALLEL_BLOCK_TYPES as readonly string[]).filter((t) => !canonicalSet.has(t as BlockType))
    if (parallelOnly.length > 0) {
      console.warn(
        `[Block drift] The following types exist in components/blocks/BlockRenderer but not in the canonical interface/BlockRenderer: ${parallelOnly.join(', ')}. See docs/architecture/BLOCK_SYSTEM_CANONICAL.md.`
      )
    }

    const registeredData = new Set(REGISTERED_DATA_BLOCK_TYPES)
    const registeredAppearance = new Set(REGISTERED_APPEARANCE_BLOCK_TYPES)
    for (const t of BLOCK_CONFIG_UNION_TYPES) {
      if (!registeredData.has(t as any) && !registeredAppearance.has(t as any)) {
        console.warn(
          `[Block drift] Block config type '${t}' is in block-config-types but not surfaced in blockSettingsRegistry (data or appearance). See docs/architecture/BLOCK_SYSTEM_CANONICAL.md.`
        )
      }
    }
  } catch {
    // Guardrails only; never throw or block
  }
}
