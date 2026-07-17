/** Workspace landing-page columns on workspace_settings. */
export type WorkspaceLandingDefaults = {
  default_interface_id?: string | null
  admin_default_interface_id?: string | null
  member_default_interface_id?: string | null
}

const LANDING_DEFAULT_COLUMNS =
  'default_interface_id, admin_default_interface_id, member_default_interface_id' as const

export { LANDING_DEFAULT_COLUMNS }

/** Role-specific default, then legacy default_interface_id. */
export function pickWorkspaceLandingPageId(
  settings: WorkspaceLandingDefaults | null | undefined,
  userIsAdmin: boolean
): string | null {
  if (!settings) return null
  const roleDefault = userIsAdmin
    ? settings.admin_default_interface_id
    : settings.member_default_interface_id
  if (typeof roleDefault === 'string' && roleDefault.length > 0) {
    return roleDefault
  }
  const legacy = settings.default_interface_id
  if (typeof legacy === 'string' && legacy.length > 0) {
    return legacy
  }
  return null
}

/** Fields to null when a page is archived/deleted. */
export function buildClearLandingDefaultsUpdate(
  pageId: string,
  settings: WorkspaceLandingDefaults
): Partial<Record<keyof WorkspaceLandingDefaults, null>> | null {
  const update: Partial<Record<keyof WorkspaceLandingDefaults, null>> = {}
  if (settings.default_interface_id === pageId) {
    update.default_interface_id = null
  }
  if (settings.admin_default_interface_id === pageId) {
    update.admin_default_interface_id = null
  }
  if (settings.member_default_interface_id === pageId) {
    update.member_default_interface_id = null
  }
  return Object.keys(update).length > 0 ? update : null
}
