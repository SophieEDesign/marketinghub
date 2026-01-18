import { resolveChoiceColor } from "@/lib/field-colors"
import type { FieldOptions, SelectOption } from "@/types/fields"

export type SelectAlphabetizeMode = "manual" | "asc" | "desc"

const NOW_FALLBACK = () => new Date().toISOString()

function createSelectOptionId(): string {
  const globalCrypto = globalThis?.crypto as Crypto | undefined
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID()
  }
  return `opt_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

function isValidOptionLabel(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function toLabel(value: unknown): string {
  if (typeof value === "string") return value
  if (value === null || value === undefined) return ""
  return String(value)
}

function buildOptionFromLabel(
  label: string,
  index: number,
  fieldType: "single_select" | "multi_select",
  fieldOptions: FieldOptions,
  existing?: SelectOption
): SelectOption {
  const createdAt = existing?.created_at || NOW_FALLBACK()
  const id = existing?.id || createSelectOptionId()
  const colorFromOption = existing?.color ?? null
  const colorFromMap = fieldOptions.choiceColors?.[label] ?? null
  const resolvedColor =
    colorFromOption ??
    colorFromMap ??
    resolveChoiceColor(label, fieldType, fieldOptions, fieldType === "single_select")

  return {
    id,
    label,
    color: resolvedColor,
    sort_index: index,
    created_at: createdAt,
  }
}

function normalizeRawSelectOptions(
  rawOptions: Array<Partial<SelectOption>>,
  fieldType: "single_select" | "multi_select",
  fieldOptions: FieldOptions
): { options: SelectOption[]; hadMissingIndices: boolean; hadMissingIds: boolean } {
  const now = NOW_FALLBACK()
  let hadMissingIndices = false
  let hadMissingIds = false

  const normalized = rawOptions.map((opt, index) => {
    const label = toLabel(opt.label)
    const hasLabel = isValidOptionLabel(label)
    const id = typeof opt.id === "string" && opt.id.trim().length > 0 ? opt.id : createSelectOptionId()
    const createdAt =
      typeof opt.created_at === "string" && opt.created_at.trim().length > 0
        ? opt.created_at
        : now
    const sortIndex =
      typeof opt.sort_index === "number" && Number.isFinite(opt.sort_index)
        ? opt.sort_index
        : index
    const colorFromMap = fieldOptions.choiceColors?.[label] ?? null
    const color = opt.color ?? colorFromMap ?? resolveChoiceColor(label, fieldType, fieldOptions, fieldType === "single_select")

    if (!hasLabel) {
      hadMissingIds = true
    }
    if (opt.sort_index === undefined || opt.sort_index === null || Number.isNaN(opt.sort_index)) {
      hadMissingIndices = true
    }
    if (opt.id === undefined || opt.id === null || String(opt.id).trim() === "") {
      hadMissingIds = true
    }

    return {
      id,
      label: hasLabel ? label : "",
      color,
      sort_index: sortIndex,
      created_at: createdAt,
    }
  })

  return { options: normalized.filter((opt) => opt.label.trim().length > 0), hadMissingIndices, hadMissingIds }
}

function sortByIndex(options: SelectOption[]): SelectOption[] {
  const withOrder = options.map((opt, index) => ({ ...opt, sort_index: opt.sort_index ?? index, __order: index }))
  return withOrder
    .sort((a, b) => {
      if (a.sort_index !== b.sort_index) return a.sort_index - b.sort_index
      return a.__order - b.__order
    })
    .map(({ __order, ...rest }) => rest)
}

export function sortSelectOptionsByLabel(
  options: SelectOption[],
  direction: "asc" | "desc" = "asc"
): SelectOption[] {
  const multiplier = direction === "desc" ? -1 : 1
  return [...options].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }) * multiplier)
}

export function normalizeSelectFieldOptions(
  fieldType: "single_select" | "multi_select",
  incomingOptions?: FieldOptions | null,
  existingOptions?: FieldOptions | null
): {
  options: FieldOptions
  changed: boolean
  selectOptions: SelectOption[]
  orderedLabels: string[]
} {
  const baseOptions: FieldOptions = {
    ...(existingOptions || {}),
    ...(incomingOptions || {}),
    choiceColors: {
      ...(existingOptions?.choiceColors || {}),
      ...(incomingOptions?.choiceColors || {}),
    },
  }

  const existingSelectOptions = Array.isArray(existingOptions?.select_options)
    ? existingOptions?.select_options || []
    : []
  const existingByLabel = new Map(existingSelectOptions.map((opt) => [opt.label, opt]))

  let rawOptions: Array<Partial<SelectOption>> = []
  let changed = false

  if (Array.isArray(incomingOptions?.select_options) && incomingOptions?.select_options.length > 0) {
    rawOptions = incomingOptions.select_options
  } else if (Array.isArray(incomingOptions?.choices) && incomingOptions?.choices.length > 0) {
    rawOptions = incomingOptions.choices
      .map((choice) => {
        const label = toLabel(choice)
        if (!isValidOptionLabel(label)) return null
        const existing = existingByLabel.get(label)
        return existing ? { ...existing, label } : { label }
      })
      .filter(Boolean) as Array<Partial<SelectOption>>
  } else if (Array.isArray(existingSelectOptions) && existingSelectOptions.length > 0) {
    rawOptions = existingSelectOptions
  } else if (Array.isArray(existingOptions?.choices) && existingOptions?.choices.length > 0) {
    rawOptions = existingOptions.choices
      .map((choice) => {
        const label = toLabel(choice)
        if (!isValidOptionLabel(label)) return null
        const existing = existingByLabel.get(label)
        return existing ? { ...existing, label } : { label }
      })
      .filter(Boolean) as Array<Partial<SelectOption>>
  }

  const { options: normalized, hadMissingIndices, hadMissingIds } = normalizeRawSelectOptions(
    rawOptions,
    fieldType,
    baseOptions
  )

  if (hadMissingIndices || hadMissingIds) {
    changed = true
  }

  const shouldNormalizeIndices = hadMissingIndices
  const sequentialOptions = shouldNormalizeIndices
    ? normalized.map((opt, index) => ({ ...opt, sort_index: index }))
    : normalized

  if (shouldNormalizeIndices) {
    changed = true
  }

  const orderedOptions = sortByIndex(sequentialOptions).map((opt, index) => ({
    ...opt,
    sort_index: shouldNormalizeIndices ? index : opt.sort_index,
  }))

  const orderedLabels = orderedOptions.map((opt) => opt.label)

  const updatedChoiceColors: Record<string, string> = { ...(baseOptions.choiceColors || {}) }
  for (const option of orderedOptions) {
    if (option.color) {
      updatedChoiceColors[option.label] = option.color
    }
  }

  const nextOptions: FieldOptions = {
    ...baseOptions,
    select_options: orderedOptions,
    choices: orderedLabels,
    choiceColors: updatedChoiceColors,
  }

  if (JSON.stringify(baseOptions.select_options || []) !== JSON.stringify(nextOptions.select_options || [])) {
    changed = true
  }
  if (JSON.stringify(baseOptions.choices || []) !== JSON.stringify(nextOptions.choices || [])) {
    changed = true
  }

  return { options: nextOptions, changed, selectOptions: orderedOptions, orderedLabels }
}

export function getSelectOptions(
  fieldType: "single_select" | "multi_select",
  fieldOptions?: FieldOptions | null
): SelectOption[] {
  const { selectOptions } = normalizeSelectFieldOptions(fieldType, fieldOptions, fieldOptions)
  return selectOptions
}

export function getOrderedSelectLabels(
  fieldType: "single_select" | "multi_select",
  fieldOptions?: FieldOptions | null
): string[] {
  const { orderedLabels } = normalizeSelectFieldOptions(fieldType, fieldOptions, fieldOptions)
  return orderedLabels
}

export function applySelectOptionsToFieldOptions(
  fieldType: "single_select" | "multi_select",
  fieldOptions: FieldOptions,
  selectOptions: SelectOption[]
): FieldOptions {
  const orderedOptions = selectOptions.map((opt, index) => ({
    ...opt,
    sort_index: index,
  }))

  const orderedLabels = orderedOptions.map((opt) => opt.label)
  const updatedChoiceColors: Record<string, string> = { ...(fieldOptions.choiceColors || {}) }
  for (const option of orderedOptions) {
    if (option.color) {
      updatedChoiceColors[option.label] = option.color
    }
  }

  return {
    ...fieldOptions,
    select_options: orderedOptions,
    choices: orderedLabels,
    choiceColors: updatedChoiceColors,
  }
}

// Global Consistency Rule (Add verbatim)
// Select option order is global.
// The sort_index for single-select and multi-select options must be respected everywhere in the product, including but not limited to:
//
// Core Data (Airtable-style Grid)
//
// Record detail modals
//
// Inline cell editors
//
// Calendar blocks
//
// Timeline blocks
//
// Table, List, Gallery, Kanban views
//
// Filters, grouping dropdowns, and quick filters
//
// No view, block, or component may:
//
// Re-sort options alphabetically by default
//
// Reorder options based on usage frequency
//
// Reorder options based on creation time
//
// The only valid ordering source is sort_index, unless Alphabetise is explicitly enabled by the user.
//
// Alphabetise Scope Rule
//
// Alphabetise affects only the option picker UI where it is enabled.
// It must not:
//
// Mutate stored option order
//
// Affect how pills render
//
// Affect grouping order
//
// Affect filters or block-level dropdowns
//
// So:
//
// Pills still show in the same order
//
// Group headers still follow manual order
//
// Filters still list options in manual order
