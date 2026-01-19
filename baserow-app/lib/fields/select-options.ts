import type { FieldOptions, SelectOption, TableField } from '@/types/fields'

function safeRandomId(): string {
  // Browser + modern runtimes
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as any).randomUUID()
  }
  // Fallback: not cryptographically strong, but stable enough for option ids
  return `opt_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

function nowIso(): string {
  try {
    return new Date().toISOString()
  } catch {
    return ''
  }
}

export type SelectAlphabetiseMode = 'manual' | 'az' | 'za'

export function isSelectFieldType(type: any): type is 'single_select' | 'multi_select' {
  return type === 'single_select' || type === 'multi_select'
}

export function getSelectOptionsRaw(fieldOptions?: FieldOptions | null): SelectOption[] {
  const opts = fieldOptions || {}
  const so = (opts as any).selectOptions
  if (Array.isArray(so)) {
    return so.filter(Boolean) as SelectOption[]
  }
  return []
}

/**
 * Build canonical SelectOption[] from any legacy shape.
 * - If `selectOptions` exists, it is used (and repaired if metadata missing).
 * - Else, fall back to `choices` + `choiceColors`.
 *
 * This function is pure and does NOT mutate the passed options object.
 */
export function normalizeSelectOptionsForUi(
  fieldType: 'single_select' | 'multi_select',
  fieldOptions?: FieldOptions | null
): { selectOptions: SelectOption[]; didRepair: boolean; repairedFieldOptions?: FieldOptions } {
  const opts: FieldOptions = { ...(fieldOptions || {}) }
  const raw = getSelectOptionsRaw(opts)

  let didRepair = false
  let selectOptions: SelectOption[] = []

  if (raw.length > 0) {
    selectOptions = raw.map((o: any, idx: number) => {
      const label = String(o?.label ?? o?.value ?? '').trim()
      const id = String(o?.id ?? '').trim() || safeRandomId()
      const created_at = typeof o?.created_at === 'string' && o.created_at ? o.created_at : nowIso()
      const sort_index =
        typeof o?.sort_index === 'number' && Number.isFinite(o.sort_index) ? Math.trunc(o.sort_index) : idx
      const color = typeof o?.color === 'string' && o.color ? o.color : undefined
      if (!o?.id || o?.sort_index == null || !o?.label) didRepair = true
      return { id, label, color, sort_index, created_at }
    })
  } else {
    const choices = Array.isArray(opts.choices) ? opts.choices : []
    const colorMap: Record<string, string> = (opts.choiceColors as any) || {}
    selectOptions = choices
      .map((c, idx) => {
        const label = String(c ?? '').trim()
        if (!label) return null
        return {
          id: safeRandomId(),
          label,
          color: typeof colorMap[label] === 'string' ? colorMap[label] : undefined,
          sort_index: idx,
          created_at: nowIso(),
        } satisfies SelectOption
      })
      .filter(Boolean) as SelectOption[]
    // If choices existed, we're effectively migrating to selectOptions.
    if (choices.length > 0) didRepair = true
  }

  // Safety: ensure unique, sequential sort_index if missing/duplicated/non-finite.
  const needsReindex = (() => {
    const seen = new Set<number>()
    for (const o of selectOptions) {
      if (typeof o.sort_index !== 'number' || !Number.isFinite(o.sort_index)) return true
      if (seen.has(o.sort_index)) return true
      seen.add(o.sort_index)
    }
    return false
  })()
  if (needsReindex) {
    didRepair = true
    selectOptions = selectOptions.map((o, idx) => ({ ...o, sort_index: idx }))
  }

  // Build a repaired FieldOptions payload if we repaired anything.
  let repairedFieldOptions: FieldOptions | undefined
  if (didRepair) {
    const ordered = [...selectOptions].sort((a, b) => a.sort_index - b.sort_index)
    const choices = ordered.map((o) => o.label)
    const choiceColors: Record<string, string> = {}
    for (const o of ordered) {
      if (o.color) choiceColors[o.label] = o.color
    }
    repairedFieldOptions = {
      ...opts,
      selectOptions: ordered,
      // Keep legacy keys in sync so older UI paths remain stable.
      choices,
      choiceColors: Object.keys(choiceColors).length > 0 ? choiceColors : opts.choiceColors,
    }
  }

  return { selectOptions: [...selectOptions].sort((a, b) => a.sort_index - b.sort_index), didRepair, repairedFieldOptions }
}

export function getManualChoiceLabels(
  fieldType: 'single_select' | 'multi_select',
  fieldOptions?: FieldOptions | null
): string[] {
  const { selectOptions } = normalizeSelectOptionsForUi(fieldType, fieldOptions)
  return selectOptions.map((o) => o.label)
}

export function sortLabelsByManualOrder(
  labels: string[],
  fieldType: 'single_select' | 'multi_select',
  fieldOptions?: FieldOptions | null
): string[] {
  const { selectOptions } = normalizeSelectOptionsForUi(fieldType, fieldOptions)
  const indexByLabel = new Map<string, number>()
  for (const o of selectOptions) indexByLabel.set(o.label, o.sort_index)

  return [...(labels || [])].sort((a, b) => {
    const ai = indexByLabel.get(String(a)) ?? Number.POSITIVE_INFINITY
    const bi = indexByLabel.get(String(b)) ?? Number.POSITIVE_INFINITY
    if (ai !== bi) return ai - bi
    // Stable fallback for unknown labels
    return String(a).localeCompare(String(b))
  })
}

export function applyAlphabetiseMode(labels: string[], mode: SelectAlphabetiseMode): string[] {
  if (mode === 'manual') return labels
  const dir = mode === 'az' ? 1 : -1
  return [...labels].sort((a, b) => dir * String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }))
}

export function getSelectOptionColorMap(fieldOptions?: FieldOptions | null): Record<string, string> {
  const opts: FieldOptions = fieldOptions || {}
  const { selectOptions } = normalizeSelectOptionsForUi('single_select', opts as any) // type irrelevant for colors
  const m: Record<string, string> = {}
  for (const o of selectOptions) {
    if (o.color) m[o.label] = o.color
  }
  // Merge with legacy map (option-level override)
  return { ...(opts.choiceColors || {}), ...m }
}

export function isSelectField(field: TableField | null | undefined): field is TableField & { type: 'single_select' | 'multi_select' } {
  return !!field && isSelectFieldType((field as any).type)
}

