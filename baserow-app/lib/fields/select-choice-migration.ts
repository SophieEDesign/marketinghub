import type { SupabaseClient } from '@supabase/supabase-js'
import type { FieldOptions } from '@/types/fields'
import { normalizeSelectOptionsForUi } from '@/lib/fields/select-options'

export type SelectChoiceRename = {
  optionId?: string
  /** Stored values that should map to the new label (old label and/or option id). */
  fromValues: string[]
  toLabel: string
}

export type SelectChoiceDeletion = {
  fromValues: string[]
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const trimmed = String(value ?? '').trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}

export function detectSelectChoiceChanges(
  fieldType: 'single_select' | 'multi_select',
  oldOptions: FieldOptions | null | undefined,
  newOptions: FieldOptions | null | undefined
): { renames: SelectChoiceRename[]; deletions: SelectChoiceDeletion[] } {
  const { selectOptions: oldOpts } = normalizeSelectOptionsForUi(fieldType, oldOptions)
  const { selectOptions: newOpts } = normalizeSelectOptionsForUi(fieldType, newOptions)

  const newById = new Map(newOpts.map((option) => [option.id, option]))
  const renames: SelectChoiceRename[] = []
  const deletions: SelectChoiceDeletion[] = []

  for (const old of oldOpts) {
    const next = newById.get(old.id)
    if (!next) {
      deletions.push({
        fromValues: uniqueStrings([old.label, old.id]),
      })
      continue
    }

    if (old.label !== next.label) {
      renames.push({
        optionId: old.id,
        fromValues: uniqueStrings([old.label, old.id]),
        toLabel: next.label,
      })
    }
  }

  return { renames, deletions }
}

export function remapStoredSelectValue(
  value: unknown,
  fieldType: 'single_select' | 'multi_select',
  renames: SelectChoiceRename[],
  deletions: SelectChoiceDeletion[]
): { next: unknown; changed: boolean } {
  if (renames.length === 0 && deletions.length === 0) {
    return { next: value, changed: false }
  }

  const matchesDeletion = (stored: string) =>
    deletions.some((deletion) => deletion.fromValues.includes(stored))

  const remapSingleStored = (stored: string): { next: string | null; changed: boolean } => {
    if (matchesDeletion(stored)) {
      return { next: null, changed: true }
    }

    for (const rename of renames) {
      if (!rename.fromValues.includes(stored)) continue
      // Records that store the stable option id keep the id; display resolves the label.
      if (rename.optionId && stored === rename.optionId) {
        return { next: stored, changed: false }
      }
      return { next: rename.toLabel, changed: true }
    }

    return { next: stored, changed: false }
  }

  if (fieldType === 'single_select') {
    if (value == null || value === '') {
      return { next: value, changed: false }
    }
    const stored = String(value).trim()
    const { next, changed } = remapSingleStored(stored)
    return { next, changed }
  }

  const source = Array.isArray(value) ? value : value == null || value === '' ? [] : [value]
  let changed = false
  const nextValues: string[] = []

  for (const item of source) {
    const stored = String(item ?? '').trim()
    if (!stored) continue

    if (matchesDeletion(stored)) {
      changed = true
      continue
    }

    let mapped = stored
    for (const rename of renames) {
      if (!rename.fromValues.includes(stored)) continue
      if (rename.optionId && stored === rename.optionId) {
        mapped = stored
        break
      }
      mapped = rename.toLabel
      changed = true
      break
    }

    if (!nextValues.includes(mapped)) {
      nextValues.push(mapped)
    }
  }

  if (!changed && nextValues.length !== source.filter((item) => String(item ?? '').trim()).length) {
    changed = true
  }

  return { next: nextValues, changed }
}

export async function migrateSelectChoiceRecords(params: {
  supabase: SupabaseClient<any, 'public', any>
  tableName: string
  fieldName: string
  fieldType: 'single_select' | 'multi_select'
  renames: SelectChoiceRename[]
  deletions: SelectChoiceDeletion[]
}): Promise<number> {
  const { supabase, tableName, fieldName, fieldType, renames, deletions } = params
  if (renames.length === 0 && deletions.length === 0) return 0

  const { data: records, error } = await supabase
    .from(tableName)
    .select(`id, ${fieldName}`)
    .not(fieldName, 'is', null)

  if (error) throw error
  if (!records?.length) return 0

  const updates: Array<{ id: string; value: unknown }> = []
  for (const record of records as unknown as Array<Record<string, unknown>>) {
    const { next, changed } = remapStoredSelectValue(record[fieldName], fieldType, renames, deletions)
    if (changed) {
      updates.push({ id: String(record.id), value: next })
    }
  }

  const batchSize = 100
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize)
    await Promise.all(
      batch.map(({ id, value }) =>
        supabase
          .from(tableName)
          .update({ [fieldName]: value })
          .eq('id', id)
      )
    )
  }

  return updates.length
}

export const SELECT_CHOICE_MIGRATED_EVENT = 'select-choice-migrated'

export function dispatchSelectChoiceMigrated(tableId: string, recordsUpdated = 0) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(SELECT_CHOICE_MIGRATED_EVENT, {
      detail: { tableId, recordsUpdated },
    })
  )
}
