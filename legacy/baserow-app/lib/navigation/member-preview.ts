/** Session key for persisting member preview across navigation */
export const MEMBER_PREVIEW_STORAGE_KEY = "member-preview-active"

export type NavInterfacePage = {
  id: string
  name: string
  is_admin_only?: boolean
  is_hidden?: boolean
  group_id?: string | null
  order_index?: number
}

export type NavInterfaceGroup = {
  id: string
  is_admin_only?: boolean
}

const MEMBER_HOME_PAGE_NAMES = ["Members Welcome"] as const

/** True when URL indicates admin is previewing as member */
export function isMemberPreviewSearch(search: string): boolean {
  if (!search) return false
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
  if (params.get("preview") === "member") return true
  if (params.get("view") === "true") return true
  return false
}

/** Append or strip member preview query on a path */
export function withMemberPreviewHref(path: string, previewActive: boolean): string {
  const [pathname, rawQuery = ""] = path.split("?")
  const params = new URLSearchParams(rawQuery)
  if (previewActive) {
    params.set("preview", "member")
    params.delete("view")
  } else {
    params.delete("preview")
    params.delete("view")
  }
  const qs = params.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

function isPageVisibleInMemberPreview(
  page: NavInterfacePage,
  adminOnlyGroupIds: ReadonlySet<string>
): boolean {
  if (page.is_hidden) return false
  if (page.is_admin_only) return false
  if (page.group_id && adminOnlyGroupIds.has(page.group_id)) return false
  return true
}

/** Sidebar nav: member-visible pages only when previewing */
export function filterInterfacePagesForNav(
  pages: NavInterfacePage[],
  memberPreview: boolean,
  groups: NavInterfaceGroup[] = []
): NavInterfacePage[] {
  if (!memberPreview) {
    return pages.filter((p) => !p.is_hidden)
  }

  const adminOnlyGroupIds = new Set(
    groups.filter((g) => g.is_admin_only).map((g) => g.id)
  )

  return pages.filter((p) => isPageVisibleInMemberPreview(p, adminOnlyGroupIds))
}

/** Home link target when admin previews as member */
export function pickMemberPreviewHomePage(
  pages: NavInterfacePage[],
  groups: NavInterfaceGroup[] = []
): NavInterfacePage | null {
  const visible = filterInterfacePagesForNav(pages, true, groups)
  for (const name of MEMBER_HOME_PAGE_NAMES) {
    const match = visible.find((p) => p.name === name)
    if (match) return match
  }
  return visible[0] ?? null
}

/** pageEditable helper for interface pages */
export function isPageEditableForUser(isAdmin: boolean, memberPreview: boolean): boolean {
  return isAdmin && !memberPreview
}
