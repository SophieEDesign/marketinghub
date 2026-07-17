import type { TableField } from "@/types/fields"

const DEFAULT_SECTION_NAME = "General"

/**
 * Sections fields by their group_name (section name).
 * Fields without a group_name are placed in the "General" section.
 * 
 * @param fields - Array of table fields to section
 * @returns Record mapping section names to arrays of fields
 */
export function sectionFieldsByGroupName(
  fields: TableField[]
): Record<string, TableField[]> {
  const sections: Record<string, TableField[]> = {}

  fields.forEach((field) => {
    const sectionName = field.group_name || DEFAULT_SECTION_NAME

    if (!sections[sectionName]) {
      sections[sectionName] = []
    }
    sections[sectionName].push(field)
  })

  return sections
}

/**
 * Sorts sections by the minimum order_index of fields within each section.
 * The "General" section always appears first if it exists.
 * 
 * @param sections - Record mapping section names to arrays of fields
 * @returns Array of [sectionName, fields] tuples, sorted by order
 */
export function sortSectionsByOrder(
  sections: Record<string, TableField[]>
): [string, TableField[]][] {
  // Sort fields within each section by order_index (fallback to position)
  Object.keys(sections).forEach((sectionName) => {
    sections[sectionName].sort((a, b) => {
      const orderA = a.order_index ?? a.position ?? 0
      const orderB = b.order_index ?? b.position ?? 0
      return orderA - orderB
    })
  })

  // Sort sections by minimum order_index of fields in each section
  // "General" section always appears first if it exists
  const sortedSectionEntries = Object.entries(sections).sort(
    ([nameA, fieldsA], [nameB, fieldsB]) => {
      // "General" section always first
      if (nameA === DEFAULT_SECTION_NAME) return -1
      if (nameB === DEFAULT_SECTION_NAME) return 1

      // Otherwise, sort by minimum order_index in each section
      const minOrderA = Math.min(
        ...fieldsA.map((f) => f.order_index ?? f.position ?? 0)
      )
      const minOrderB = Math.min(
        ...fieldsB.map((f) => f.order_index ?? f.position ?? 0)
      )
      return minOrderA - minOrderB
    }
  )

  return sortedSectionEntries
}

/**
 * Returns the default section name for fields without a group_name.
 * 
 * @returns "General"
 */
export function getDefaultSectionName(): string {
  return DEFAULT_SECTION_NAME
}

/**
 * Sections fields and returns them sorted by order.
 * This is a convenience function that combines sectionFieldsByGroupName and sortSectionsByOrder.
 * 
 * @param fields - Array of table fields to section
 * @returns Array of [sectionName, fields] tuples, sorted by order
 */
export function sectionAndSortFields(
  fields: TableField[]
): [string, TableField[]][] {
  const sections = sectionFieldsByGroupName(fields)
  return sortSectionsByOrder(sections)
}
