/**
 * Permission cascade: field > block > page (most specific wins).
 *
 * Centralises permission checks so all layers read from one place.
 * Hard rules: do not tighten; do not enforce a rule where it was previously leaky;
 * on mismatch, mirror existing behaviour.
 *
 * When blockConfig is not provided, results match record-actions / page-only behaviour.
 * When blockConfig is provided, block layer can restrict (never loosen) page-level.
 */

import type { PageConfig } from './page-config'
import type { BlockConfig } from './types'
import type { ClientUserRole } from '@/lib/hooks/useUserRole'
import {
  getRecordActionPermissions,
  canCreateRecord as pageCanCreateRecord,
  canDeleteRecord as pageCanDeleteRecord,
} from './record-actions'
import {
  getBlockPermissions,
  canEditBlock as blockCanEdit,
  canCreateRecords as blockCanCreateRecords,
  canDeleteRecords as blockCanDeleteRecords,
  canOpenRecords as blockCanOpenRecords,
} from './block-permissions'

/** Context for optional block-level check. Omit to mirror page-only behaviour. */
export type CascadeContext = {
  blockConfig?: BlockConfig | null
  /** Optional: field-level read-only; not yet used by all call sites */
  fieldReadOnly?: boolean
}

/**
 * Can the user create a record? Page layer (role + record_actions); if blockConfig
 * provided, block can restrict (mode view, allowInlineCreate).
 * When blockConfig is omitted, result equals record-actions.canCreateRecord (no tightening).
 */
export function canCreateRecord(
  role: ClientUserRole | null | undefined,
  pageConfig: PageConfig | null | undefined,
  context?: CascadeContext
): boolean {
  const pageAllowed = pageCanCreateRecord(role, pageConfig)
  if (!pageAllowed) return false
  const blockConfig = context?.blockConfig
  if (blockConfig == null) return pageAllowed
  return blockCanCreateRecords(blockConfig)
}

/**
 * Can the user delete a record? Page layer (role + record_actions); if blockConfig
 * provided, block can restrict (mode view, allowInlineDelete).
 * When blockConfig is omitted, result equals record-actions.canDeleteRecord (no tightening).
 */
export function canDeleteRecord(
  role: ClientUserRole | null | undefined,
  pageConfig: PageConfig | null | undefined,
  context?: CascadeContext
): boolean {
  const pageAllowed = pageCanDeleteRecord(role, pageConfig)
  if (!pageAllowed) return false
  const blockConfig = context?.blockConfig
  if (blockConfig == null) return pageAllowed
  return blockCanDeleteRecords(blockConfig)
}

/**
 * Can the user edit records in this context? Block layer (mode === 'edit');
 * if blockConfig omitted, we do not introduce a check (mirror leaky behaviour).
 */
export function canEditRecords(context?: CascadeContext): boolean {
  const blockConfig = context?.blockConfig
  if (blockConfig == null) return true
  return blockCanEdit(blockConfig)
}

/**
 * Can the user open record details? Block layer (allowOpenRecord).
 * When blockConfig omitted, allow (mirror existing behaviour where no block is passed).
 */
export function canOpenRecord(context?: CascadeContext): boolean {
  const blockConfig = context?.blockConfig
  if (blockConfig == null) return true
  return blockCanOpenRecords(blockConfig)
}

/**
 * Re-export permission extraction for call sites that need page or block config only.
 * Use these when gradually routing through the cascade.
 */
export { getRecordActionPermissions } from './record-actions'
export { getBlockPermissions } from './block-permissions'
