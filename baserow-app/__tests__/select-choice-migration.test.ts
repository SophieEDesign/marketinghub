import { describe, expect, it } from 'vitest'
import {
  detectSelectChoiceChanges,
  remapStoredSelectValue,
} from '@/lib/fields/select-choice-migration'

describe('select choice migration', () => {
  it('detects renamed options by stable id', () => {
    const oldOptions = {
      selectOptions: [
        { id: 'opt-1', label: 'Draft', sort_index: 0, created_at: '2026-01-01T00:00:00.000Z' },
        { id: 'opt-2', label: 'Live', sort_index: 1, created_at: '2026-01-01T00:00:00.000Z' },
      ],
    }
    const newOptions = {
      selectOptions: [
        { id: 'opt-1', label: 'In Progress', sort_index: 0, created_at: '2026-01-01T00:00:00.000Z' },
        { id: 'opt-2', label: 'Live', sort_index: 1, created_at: '2026-01-01T00:00:00.000Z' },
      ],
    }

    const { renames, deletions } = detectSelectChoiceChanges(
      'single_select',
      oldOptions,
      newOptions
    )

    expect(deletions).toHaveLength(0)
    expect(renames).toEqual([
      {
        optionId: 'opt-1',
        fromValues: ['Draft', 'opt-1'],
        toLabel: 'In Progress',
      },
    ])
  })

  it('detects deleted options', () => {
    const oldOptions = {
      selectOptions: [
        { id: 'opt-1', label: 'Draft', sort_index: 0, created_at: '2026-01-01T00:00:00.000Z' },
        { id: 'opt-2', label: 'Live', sort_index: 1, created_at: '2026-01-01T00:00:00.000Z' },
      ],
    }
    const newOptions = {
      selectOptions: [
        { id: 'opt-2', label: 'Live', sort_index: 0, created_at: '2026-01-01T00:00:00.000Z' },
      ],
    }

    const { renames, deletions } = detectSelectChoiceChanges(
      'single_select',
      oldOptions,
      newOptions
    )

    expect(renames).toHaveLength(0)
    expect(deletions).toEqual([{ fromValues: ['Draft', 'opt-1'] }])
  })

  it('remaps label-stored single select values across records', () => {
    const renames = [
      { optionId: 'opt-1', fromValues: ['Draft', 'opt-1'], toLabel: 'In Progress' },
    ]

    expect(
      remapStoredSelectValue('Draft', 'single_select', renames, []).changed
    ).toBe(true)
    expect(
      remapStoredSelectValue('Draft', 'single_select', renames, []).next
    ).toBe('In Progress')
    expect(
      remapStoredSelectValue('Live', 'single_select', renames, []).changed
    ).toBe(false)
  })

  it('keeps id-stored values when only the label changes', () => {
    const renames = [
      { optionId: 'opt-1', fromValues: ['Draft', 'opt-1'], toLabel: 'In Progress' },
    ]

    const result = remapStoredSelectValue('opt-1', 'single_select', renames, [])
    expect(result.changed).toBe(false)
    expect(result.next).toBe('opt-1')
  })

  it('remaps multi-select arrays and removes deleted values', () => {
    const renames = [
      { optionId: 'opt-1', fromValues: ['Draft', 'opt-1'], toLabel: 'In Progress' },
    ]
    const deletions = [{ fromValues: ['Archived', 'opt-3'] }]

    const result = remapStoredSelectValue(
      ['Draft', 'Archived', 'Live'],
      'multi_select',
      renames,
      deletions
    )

    expect(result.changed).toBe(true)
    expect(result.next).toEqual(['In Progress', 'Live'])
  })
})
