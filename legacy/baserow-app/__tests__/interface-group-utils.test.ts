import {
  VIRTUAL_UNGROUPED_GROUP_ID,
  groupsMatchForReorder,
  normalizeGroupIdForApi,
} from '@/lib/interface/interface-group-utils'

describe('interface-group-utils', () => {
  it('maps virtual ungrouped id to null for API', () => {
    expect(normalizeGroupIdForApi(VIRTUAL_UNGROUPED_GROUP_ID)).toBeNull()
    expect(normalizeGroupIdForApi(null)).toBeNull()
    expect(normalizeGroupIdForApi(undefined)).toBeNull()
    expect(normalizeGroupIdForApi('real-uuid')).toBe('real-uuid')
  })

  it('treats null and virtual ids as the same group for reorder', () => {
    expect(groupsMatchForReorder(null, VIRTUAL_UNGROUPED_GROUP_ID)).toBe(true)
    expect(groupsMatchForReorder('abc', 'abc')).toBe(true)
    expect(groupsMatchForReorder('abc', null)).toBe(false)
  })
})
