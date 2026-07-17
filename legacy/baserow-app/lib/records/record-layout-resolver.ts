import type { TableField } from "@/types/fields"
import {
  RECORD_LAYOUT_PRESETS,
  normalizeFieldTokens,
  type RecordLayoutType,
} from "@/lib/records/record-layout-presets"

export interface ResolvedRecordLayoutSection {
  id: string
  label: string
  collapsedByDefault: boolean
  fields: TableField[]
}

export interface ResolvedRecordLayout {
  type: RecordLayoutType
  isCustom: boolean
  sections: ResolvedRecordLayoutSection[]
  titleField: TableField | null
  statusField: TableField | null
  mediaPreviewField: TableField | null
}

function matchesAlias(tokens: string[], alias: string): boolean {
  return tokens.some((token) => token.includes(alias) || alias.includes(token))
}

function matchFieldByAliases(
  fields: TableField[],
  tokenMap: Map<string, string[]>,
  aliases: string[]
): TableField | null {
  for (const alias of aliases) {
    for (const field of fields) {
      const tokens = tokenMap.get(field.id) ?? []
      if (matchesAlias(tokens, alias)) return field
    }
  }
  return null
}

export function resolveRecordLayout(
  fields: TableField[],
  recordLayoutType?: RecordLayoutType
): ResolvedRecordLayout {
  if (!recordLayoutType || recordLayoutType === "generic") {
    return {
      type: "generic",
      isCustom: false,
      sections: [],
      titleField: null,
      statusField: null,
      mediaPreviewField: null,
    }
  }

  const preset = RECORD_LAYOUT_PRESETS[recordLayoutType]
  if (!preset) {
    return {
      type: "generic",
      isCustom: false,
      sections: [],
      titleField: null,
      statusField: null,
      mediaPreviewField: null,
    }
  }

  const tokenMap = new Map<string, string[]>()
  fields.forEach((field) => tokenMap.set(field.id, normalizeFieldTokens(field)))

  const matched = new Set<string>()
  const sections: ResolvedRecordLayoutSection[] = []

  preset.sections.forEach((section) => {
    const priority: TableField[] = []
    const others: TableField[] = []

    fields.forEach((field) => {
      if (matched.has(field.id)) return
      const tokens = tokenMap.get(field.id) ?? []
      const belongs = section.aliases.some((alias) => matchesAlias(tokens, alias))
      if (!belongs) return
      const isPriority = preset.priorityAliases.some((alias) => matchesAlias(tokens, alias))
      if (isPriority) priority.push(field)
      else others.push(field)
      matched.add(field.id)
    })

    const sectionFields = [...priority, ...others]
    if (sectionFields.length > 0) {
      sections.push({
        id: section.id,
        label: section.label,
        collapsedByDefault: Boolean(section.collapsedByDefault),
        fields: sectionFields,
      })
    }
  })

  const moreFields = fields.filter((field) => !matched.has(field.id))
  if (moreFields.length > 0) {
    sections.push({
      id: "more_fields",
      label: "More fields",
      collapsedByDefault: false,
      fields: moreFields,
    })
  }

  return {
    type: recordLayoutType,
    isCustom: true,
    sections,
    titleField: matchFieldByAliases(fields, tokenMap, preset.titleAliases),
    statusField: matchFieldByAliases(fields, tokenMap, preset.statusAliases),
    mediaPreviewField: preset.mediaPreviewAliases
      ? matchFieldByAliases(fields, tokenMap, preset.mediaPreviewAliases)
      : null,
  }
}
