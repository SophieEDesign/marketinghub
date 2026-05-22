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

/** Sidebar nav: member-visible pages only when previewing */
export function filterInterfacePagesForNav(
  pages: NavInterfacePage[],
  memberPreview: boolean
): NavInterfacePage[] {
  return pages.filter((p) => {
    if (p.is_hidden) return false
    if (memberPreview && p.is_admin_only) return false
    return true
  })
}

/** pageEditable helper for interface pages */
export function isPageEditableForUser(isAdmin: boolean, memberPreview: boolean): boolean {
  return isAdmin && !memberPreview
}
