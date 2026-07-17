/** Client-side placeholder when no "Ungrouped" row exists in interface_groups yet. */
export const VIRTUAL_UNGROUPED_GROUP_ID = 'ungrouped-system-virtual'

export function isVirtualUngroupedGroupId(groupId: string | null | undefined): boolean {
  return groupId === VIRTUAL_UNGROUPED_GROUP_ID
}

/** Map UI group ids to values safe for interface_pages.group_id (null → Ungrouped on server). */
export function normalizeGroupIdForApi(groupId: string | null | undefined): string | null {
  if (!groupId || isVirtualUngroupedGroupId(groupId)) return null
  return groupId
}

export function groupsMatchForReorder(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  return normalizeGroupIdForApi(a) === normalizeGroupIdForApi(b)
}
