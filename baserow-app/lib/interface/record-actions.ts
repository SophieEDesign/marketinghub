import type { PageConfig } from '@/lib/interface/page-config'
import type { ClientUserRole } from '@/lib/hooks/useUserRole'

export type RecordActionPermission = 'admin' | 'both'

export interface RecordActionPermissions {
  create?: RecordActionPermission
  delete?: RecordActionPermission
}

/**
 * Extract record action permissions from page config.
 * Defaults are intentionally backwards-compatible:
 * - create: 'both' (existing UIs commonly allow creating)
 * - delete: 'admin' (existing grid UIs treat delete as admin-only)
 */
export function getRecordActionPermissions(config: PageConfig | any): Required<RecordActionPermissions> {
  const raw =
    (config?.record_actions as RecordActionPermissions | undefined) ||
    (config?.record_permissions as RecordActionPermissions | undefined) ||
    (config?.recordActions as RecordActionPermissions | undefined) ||
    {}

  return {
    create: raw.create ?? 'both',
    delete: raw.delete ?? 'admin',
  }
}

export function canCreateRecord(role: ClientUserRole | null | undefined, config: PageConfig | any): boolean {
  if (!role) return false
  if (role === 'admin') return true
  const perms = getRecordActionPermissions(config)
  return perms.create === 'both'
}

export function canDeleteRecord(role: ClientUserRole | null | undefined, config: PageConfig | any): boolean {
  if (!role) return false
  if (role === 'admin') return true
  const perms = getRecordActionPermissions(config)
  return perms.delete === 'both'
}

