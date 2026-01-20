"use client"

import { useState, useRef, useEffect, useMemo } from 'react'
import { Plus, Edit2, Palette, X, Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  resolveChoiceColor,
  normalizeHexColor,
  getChoiceThemePalette,
} from '@/lib/field-colors'
import type { FieldOptions, SelectOption } from '@/types/fields'
import { ChoicePill } from '@/components/fields/ChoicePill'
import { normalizeSelectOptionsForUi } from '@/lib/fields/select-options'

interface InlineSelectDropdownProps {
  value: string | string[] | null
  choices: string[]
  choiceColors?: Record<string, string>
  fieldOptions?: FieldOptions
  fieldType: 'single_select' | 'multi_select'
  fieldId: string
  tableId: string
  editable?: boolean
  canEditOptions?: boolean // Permission to edit field options
  onValueChange: (value: string | string[] | null) => Promise<void>
  onFieldOptionsUpdate?: () => void // Callback when field options are updated
  placeholder?: string
}

export default function InlineSelectDropdown({
  value,
  choices,
  choiceColors,
  fieldOptions,
  fieldType,
  fieldId,
  tableId,
  editable = true,
  canEditOptions = true,
  onValueChange,
  onFieldOptionsUpdate,
  placeholder = 'Select...',
}: InlineSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingChoice, setEditingChoice] = useState<string | null>(null)
  const [editingColor, setEditingColor] = useState<string | null>(null)
  const [newChoiceName, setNewChoiceName] = useState('')
  const [updatingOptions, setUpdatingOptions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isMulti = fieldType === 'multi_select'
  const selectedValues = useMemo((): string[] => {
    if (isMulti) {
      return Array.isArray(value) ? value : []
    }
    // For single select, value should be a string, but handle array case for safety
    if (Array.isArray(value)) {
      return value.length > 0 ? [value[0]] : []
    }
    return value ? [value] : []
  }, [value, isMulti])

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setSearchTerm('')
      setEditingChoice(null)
      setEditingColor(null)
      setNewChoiceName('')
    }
  }

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current && !editingChoice && !editingColor) {
      inputRef.current.focus()
    }
  }, [isOpen, editingChoice, editingColor])

  // Filter choices based on search term
  const filteredChoices = useMemo(() => {
    if (!searchTerm.trim()) return choices
    const term = searchTerm.toLowerCase()
    return choices.filter(choice => choice.toLowerCase().includes(term))
  }, [choices, searchTerm])

  // Check if search term matches a new option to create
  const canCreateNewOption = useMemo(() => {
    if (!canEditOptions || !searchTerm.trim()) return false
    const term = searchTerm.trim()
    return !choices.some(c => c.toLowerCase() === term.toLowerCase())
  }, [canEditOptions, searchTerm, choices])

  // Merge choiceColors into fieldOptions for proper resolution
  const mergedOptions: FieldOptions = useMemo(() => {
    return {
      ...fieldOptions,
      choiceColors: choiceColors || fieldOptions?.choiceColors,
    }
  }, [choiceColors, fieldOptions])

  const safeId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? (crypto as any).randomUUID()
      : `opt_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`

  const nowIso = () => {
    try {
      return new Date().toISOString()
    } catch {
      return ''
    }
  }

  const buildSelectOptionsPayload = (base: FieldOptions, input: SelectOption[]): FieldOptions => {
    const withColors = (Array.isArray(input) ? input : []).map((o, idx) => {
      const label = String(o?.label ?? '').trim()
      const color = o?.color || (base.choiceColors ? (base.choiceColors as any)[label] : undefined)
      return {
        ...o,
        id: String(o?.id || '').trim() || safeId(),
        label,
        color,
        sort_index: idx,
        created_at: typeof o?.created_at === 'string' && o.created_at ? o.created_at : nowIso(),
      }
    })

    const choices = withColors.map((o) => o.label)
    const choiceColorsOut: Record<string, string> = {}
    for (const o of withColors) {
      if (o.color) choiceColorsOut[o.label] = o.color
    }

    return {
      ...base,
      selectOptions: withColors,
      // Keep legacy keys in sync so older UI paths remain stable.
      choices,
      choiceColors: Object.keys(choiceColorsOut).length > 0 ? choiceColorsOut : undefined,
    }
  }

  // Get color for a choice
  const getChoiceColor = (choice: string, useSemantic: boolean = fieldType === 'single_select') => {
    return resolveChoiceColor(choice, fieldType, mergedOptions, useSemantic)
  }

  // Handle selecting a choice
  const handleSelectChoice = async (choice: string) => {
    if (isMulti) {
      const newValues = selectedValues.includes(choice)
        ? selectedValues.filter(v => v !== choice)
        : [...selectedValues, choice]
      await onValueChange(newValues)
    } else {
      // For single select, allow "toggle off" by clicking the currently-selected option.
      if (selectedValues[0] === choice) {
        await onValueChange(null)
      } else {
        await onValueChange(choice)
      }
      handleOpenChange(false)
    }
  }

  // Handle creating a new option
  const handleCreateOption = async () => {
    if (!canEditOptions || !searchTerm.trim()) return

    const newChoice = searchTerm.trim()
    setUpdatingOptions(true)

    try {
      const base =
        normalizeSelectOptionsForUi(fieldType, mergedOptions).repairedFieldOptions || mergedOptions
      const { selectOptions } = normalizeSelectOptionsForUi(fieldType, base)
      const nextSelectOptions = [
        ...selectOptions,
        { id: safeId(), label: newChoice, sort_index: selectOptions.length, created_at: nowIso() },
      ].sort((a, b) => a.sort_index - b.sort_index)

      const nextOptions = buildSelectOptionsPayload(base, nextSelectOptions)

      // Update field options via API
      const response = await fetch(`/api/tables/${tableId}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldId,
          options: {
            ...nextOptions,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create option')
      }

      // Select the newly created option
      if (isMulti) {
        await onValueChange([...selectedValues, newChoice])
      } else {
        await onValueChange(newChoice)
        handleOpenChange(false)
      }

      setSearchTerm('')
      onFieldOptionsUpdate?.()
    } catch (error: any) {
      console.error('Error creating option:', error)
      alert(error.message || 'Failed to create option')
    } finally {
      setUpdatingOptions(false)
    }
  }

  // Handle renaming a choice
  const handleRenameChoice = async (oldChoice: string, newName: string) => {
    if (!canEditOptions || !newName.trim() || newName === oldChoice) {
      setEditingChoice(null)
      setNewChoiceName('')
      return
    }

    setUpdatingOptions(true)

    try {
      const trimmed = newName.trim()
      const base =
        normalizeSelectOptionsForUi(fieldType, mergedOptions).repairedFieldOptions || mergedOptions
      const { selectOptions } = normalizeSelectOptionsForUi(fieldType, base)
      const nextSelectOptions = selectOptions.map((o) =>
        o.label === oldChoice ? { ...o, label: trimmed } : o
      )
      const nextOptions = buildSelectOptionsPayload(base, nextSelectOptions)

      // Update field options
      const response = await fetch(`/api/tables/${tableId}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldId,
          options: {
            ...nextOptions,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to rename option')
      }

      // Update selected values if the renamed choice was selected
      if (isMulti) {
        const newSelected: string[] = selectedValues.map(v => v === oldChoice ? newName.trim() : v)
        await onValueChange(newSelected)
      } else if (selectedValues[0] === oldChoice) {
        await onValueChange(newName.trim())
      }

      setEditingChoice(null)
      setNewChoiceName('')
      onFieldOptionsUpdate?.()
    } catch (error: any) {
      console.error('Error renaming option:', error)
      alert(error.message || 'Failed to rename option')
    } finally {
      setUpdatingOptions(false)
    }
  }

  // Handle changing a choice color
  const handleChangeColor = async (choice: string, newColor: string) => {
    if (!canEditOptions) return

    setUpdatingOptions(true)

    try {
      const base =
        normalizeSelectOptionsForUi(fieldType, mergedOptions).repairedFieldOptions || mergedOptions
      const { selectOptions } = normalizeSelectOptionsForUi(fieldType, base)
      const nextSelectOptions = selectOptions.map((o) =>
        o.label === choice ? { ...o, color: newColor } : o
      )
      const nextOptions = buildSelectOptionsPayload(base, nextSelectOptions)

      const response = await fetch(`/api/tables/${tableId}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldId,
          options: {
            ...nextOptions,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update color')
      }

      setEditingColor(null)
      onFieldOptionsUpdate?.()
    } catch (error: any) {
      console.error('Error updating color:', error)
      alert(error.message || 'Failed to update color')
    } finally {
      setUpdatingOptions(false)
    }
  }

  // Handle deleting a choice
  const handleDeleteChoice = async (choiceToDelete: string) => {
    if (!canEditOptions) return
    if (!confirm(`Delete option "${choiceToDelete}"? This will remove it from all records.`)) return

    setUpdatingOptions(true)

    try {
      const base =
        normalizeSelectOptionsForUi(fieldType, mergedOptions).repairedFieldOptions || mergedOptions
      const { selectOptions } = normalizeSelectOptionsForUi(fieldType, base)
      const nextSelectOptions = selectOptions.filter((o) => o.label !== choiceToDelete)
      const nextOptions = buildSelectOptionsPayload(base, nextSelectOptions)

      const response = await fetch(`/api/tables/${tableId}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldId,
          options: {
            ...nextOptions,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete option')
      }

      // Remove from selected values if it was selected
      if (isMulti) {
        const filteredValues: string[] = selectedValues.filter(v => v !== choiceToDelete)
        await onValueChange(filteredValues)
      } else if (selectedValues[0] === choiceToDelete) {
        await onValueChange(null)
      }

      onFieldOptionsUpdate?.()
    } catch (error: any) {
      console.error('Error deleting option:', error)
      alert(error.message || 'Failed to delete option')
    } finally {
      setUpdatingOptions(false)
    }
  }

  if (!editable) {
    // Read-only display
    return (
      <div className="flex flex-wrap gap-1.5">
        {selectedValues.length > 0 ? (
          selectedValues.map((val: string) => {
            return (
              <ChoicePill key={val} label={val} fieldType={fieldType} fieldOptions={mergedOptions} />
            )
          })
        ) : (
          <span className="text-gray-400 italic text-sm">{placeholder}</span>
        )}
      </div>
    )
  }

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {/* Dropdown trigger */}
        <button
          type="button"
          className="cell-editor w-full min-h-[32px] px-2.5 py-1.5 flex items-center flex-wrap gap-1.5 text-sm border border-gray-300 rounded-md hover:border-blue-400 hover:bg-blue-50/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2"
          onMouseDown={(e) => {
            // Prevent row-level mouse handlers from ever seeing this interaction.
            // Some grids select rows on mousedown/click; we want the dropdown to be isolated.
            e.stopPropagation()
          }}
          onClick={(e) => {
            // Prevent row-level click handlers (e.g. open record) from firing
            e.stopPropagation()
          }}
        >
          {selectedValues.length > 0 ? (
            selectedValues.map((val: string) => {
              return (
                <ChoicePill key={val} label={val} fieldType={fieldType} fieldOptions={mergedOptions} />
              )
            })
          ) : (
            <span className="text-gray-400 italic text-sm">{placeholder}</span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="z-[100] w-[var(--radix-popper-anchor-width)] p-0 bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-hidden flex flex-col"
        onMouseDown={(e) => {
          // Critical: PopoverContent is rendered inline (not in a portal) in this app's Popover.
          // Without stopping propagation, clicking options can bubble to the grid row and select it.
          e.stopPropagation()
        }}
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
          {/* Search input */}
          <div className="p-2 border-b border-gray-200">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              placeholder="Search or type to create..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={updatingOptions || !!editingChoice || !!editingColor}
            />
            {canCreateNewOption && (
              <div className="mt-1 text-xs text-gray-500 px-1">
                This will update the field everywhere.
              </div>
            )}
          </div>

          {/* Options list */}
          <div className="overflow-y-auto flex-1">
            {filteredChoices.length === 0 && !canCreateNewOption && (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                No options found
              </div>
            )}

            {filteredChoices.map((choice) => {
              const isSelected = selectedValues.includes(choice)
              const hexColor = getChoiceColor(choice)
              const textColorClass = getTextColorForBackground(hexColor)
              const bgColor = normalizeHexColor(hexColor)
              const isEditing = editingChoice === choice
              const isEditingColor = editingColor === choice

              return (
                <div
                  key={choice}
                  className={`px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                    isSelected ? 'bg-blue-50' : ''
                  }`}
                >
                  {isEditing ? (
                    // Edit mode for renaming
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newChoiceName || choice}
                        onChange={(e) => setNewChoiceName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameChoice(choice, newChoiceName || choice)
                          } else if (e.key === 'Escape') {
                            setEditingChoice(null)
                            setNewChoiceName('')
                          }
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRenameChoice(choice, newChoiceName || choice)}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                        title="Save"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingChoice(null)
                          setNewChoiceName('')
                        }}
                        className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                        title="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : isEditingColor ? (
                    // Edit mode for color
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={normalizeHexColor(hexColor)}
                          onChange={(e) => handleChangeColor(choice, e.target.value)}
                          className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                        />
                        <span className="text-sm text-gray-700 flex-1">{choice}</span>
                        <button
                          onClick={() => setEditingColor(null)}
                          className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                          title="Done"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {getChoiceThemePalette(
                          fieldType,
                          mergedOptions,
                          fieldType === 'single_select'
                        ).map((color) => (
                          <button
                            key={color}
                            onClick={() => handleChangeColor(choice, color)}
                            className="w-6 h-6 rounded border-2 border-transparent hover:border-gray-400"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    // Normal display
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={async (e) => {
                          e.stopPropagation()
                          await handleSelectChoice(choice)
                        }}
                        className="flex items-center gap-2 flex-1 text-left"
                      >
                        <input
                          type={isMulti ? 'checkbox' : 'radio'}
                          checked={isSelected}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            // Make the checkbox/radio itself interactive.
                            // We stop propagation so we don't also trigger the parent button click.
                            e.stopPropagation()
                            void handleSelectChoice(choice)
                          }}
                          onChange={() => {}} // handled via onClick above
                          className="w-4 h-4"
                        />
                        <ChoicePill label={choice} fieldType={fieldType} fieldOptions={mergedOptions} />
                      </button>
                      {canEditOptions && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingChoice(choice)
                              setNewChoiceName(choice)
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                            title="Rename option"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingColor(choice)
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                            title="Change color"
                          >
                            <Palette className="h-3.5 w-3.5" />
                          </button>
                          {!isSelected && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteChoice(choice)
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Delete option"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Create new option */}
            {canCreateNewOption && (
              <div className="px-3 py-2 border-t border-gray-200 bg-blue-50/50">
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCreateOption()
                  }}
                  disabled={updatingOptions}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100 rounded transition-colors disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create option &quot;{searchTerm.trim()}&quot;</span>
                </button>
              </div>
            )}
          </div>
      </PopoverContent>
    </Popover>
  )
}
