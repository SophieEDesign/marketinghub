"use client"

import { useState, useRef, useEffect, useMemo } from 'react'
import { Plus, Edit2, Palette, X, Check, GripVertical } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  resolveChoiceColor,
  getTextColorForBackground,
  normalizeHexColor,
  getChoiceThemePalette,
} from '@/lib/field-colors'
import type { FieldOptions, SelectOption } from '@/types/fields'
import {
  applySelectOptionsToFieldOptions,
  getSelectOptions,
  normalizeSelectFieldOptions,
  sortSelectOptionsByLabel,
  type SelectAlphabetizeMode,
} from '@/lib/fields/select-options'
import { getSchemaSafeMessage, logSchemaWarning } from '@/lib/errors/schema'

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
  displayVariant?: 'pills' | 'text'
  allowClear?: boolean
  clearLabel?: string
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
  displayVariant = 'pills',
  allowClear = false,
  clearLabel = 'Clear selection',
}: InlineSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingChoice, setEditingChoice] = useState<string | null>(null)
  const [editingColor, setEditingColor] = useState<string | null>(null)
  const [newChoiceName, setNewChoiceName] = useState('')
  const [updatingOptions, setUpdatingOptions] = useState(false)
  const [sortMode, setSortMode] = useState<SelectAlphabetizeMode>('manual')
  const [localSelectOptions, setLocalSelectOptions] = useState<SelectOption[] | null>(null)
  const [draggedOptionId, setDraggedOptionId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const normalizationRef = useRef<string | null>(null)

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

  // Merge choiceColors into fieldOptions for proper resolution
  const mergedOptions: FieldOptions = useMemo(() => {
    return {
      ...fieldOptions,
      choices: choices.length > 0 ? choices : fieldOptions?.choices,
      choiceColors: choiceColors || fieldOptions?.choiceColors,
    }
  }, [choiceColors, fieldOptions, choices])

  const { options: normalizedFieldOptions, selectOptions: normalizedSelectOptions, changed: normalizationChanged } = useMemo(
    () => normalizeSelectFieldOptions(fieldType, mergedOptions, mergedOptions),
    [fieldType, mergedOptions]
  )

  useEffect(() => {
    setLocalSelectOptions(normalizedSelectOptions)
  }, [normalizedSelectOptions])

  const selectOptions = localSelectOptions ?? normalizedSelectOptions

  const displayOptions = useMemo(() => {
    if (sortMode === 'manual') return selectOptions
    return sortSelectOptionsByLabel(selectOptions, sortMode === 'asc' ? 'asc' : 'desc')
  }, [selectOptions, sortMode])

  // Filter choices based on search term
  const filteredChoices = useMemo(() => {
    if (!searchTerm.trim()) return displayOptions
    const term = searchTerm.toLowerCase()
    return displayOptions.filter(option => option.label.toLowerCase().includes(term))
  }, [displayOptions, searchTerm])

  // Check if search term matches a new option to create
  const canCreateNewOption = useMemo(() => {
    if (!canEditOptions || !searchTerm.trim()) return false
    const term = searchTerm.trim()
    return !selectOptions.some(option => option.label.toLowerCase() === term.toLowerCase())
  }, [canEditOptions, searchTerm, selectOptions])

  // Ensure missing sort_index/id metadata is persisted once.
  useEffect(() => {
    if (!normalizationChanged || !fieldId || !tableId) return
    const payload = JSON.stringify(normalizedFieldOptions)
    if (normalizationRef.current === payload) return
    normalizationRef.current = payload
    void (async () => {
      try {
        await fetch(`/api/tables/${tableId}/fields`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fieldId,
            options: normalizedFieldOptions,
          }),
        })
        onFieldOptionsUpdate?.()
      } catch (error) {
        console.warn('Failed to normalize select options:', error)
      }
    })()
  }, [fieldId, tableId, normalizationChanged, normalizedFieldOptions, onFieldOptionsUpdate])

  // Get color for a choice
  const getChoiceColor = (choice: string, useSemantic: boolean = fieldType === 'single_select') => {
    return resolveChoiceColor(choice, fieldType, normalizedFieldOptions, useSemantic)
  }

  // Handle selecting a choice
  const handleSelectChoice = async (choice: string) => {
    if (isMulti) {
      const newValues = selectedValues.includes(choice)
        ? selectedValues.filter(v => v !== choice)
        : [...selectedValues, choice]
      await onValueChange(newValues)
    } else {
      await onValueChange(choice)
      handleOpenChange(false)
    }
  }

  const createSelectOptionId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    return `opt_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
  }

  const persistSelectOptions = async (nextSelectOptions: SelectOption[]) => {
    if (!fieldId || !tableId) return
    const previousOptions = localSelectOptions
    setLocalSelectOptions(nextSelectOptions)
    setUpdatingOptions(true)
    try {
      const nextOptions = applySelectOptionsToFieldOptions(fieldType, normalizedFieldOptions, nextSelectOptions)
      const response = await fetch(`/api/tables/${tableId}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldId,
          options: nextOptions,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update options')
      }

      onFieldOptionsUpdate?.()
    } catch (error: any) {
      console.error('Error updating options:', error)
      setLocalSelectOptions(previousOptions || normalizedSelectOptions)
      logSchemaWarning('InlineSelectDropdown update options', error)
      alert(getSchemaSafeMessage(error, 'Failed to update options'))
    } finally {
      setUpdatingOptions(false)
    }
  }

  // Handle creating a new option
  const handleCreateOption = async () => {
    if (!canEditOptions || !searchTerm.trim()) return

    const newChoice = searchTerm.trim()
    const newOption: SelectOption = {
      id: createSelectOptionId(),
      label: newChoice,
      sort_index: selectOptions.length,
      created_at: new Date().toISOString(),
      color: resolveChoiceColor(newChoice, fieldType, normalizedFieldOptions, fieldType === 'single_select'),
    }

    const nextSelectOptions = [...selectOptions, newOption].map((opt, index) => ({
      ...opt,
      sort_index: index,
    }))

    await persistSelectOptions(nextSelectOptions)

    // Select the newly created option
    if (isMulti) {
      await onValueChange([...selectedValues, newChoice])
    } else {
      await onValueChange(newChoice)
      handleOpenChange(false)
    }

    setSearchTerm('')
  }

  // Handle renaming a choice
  const handleRenameChoice = async (oldChoice: string, newName: string) => {
    if (!canEditOptions || !newName.trim() || newName === oldChoice) {
      setEditingChoice(null)
      setNewChoiceName('')
      return
    }

    try {
      const nextSelectOptions = selectOptions.map(option =>
        option.label === oldChoice
          ? { ...option, label: newName.trim() }
          : option
      )

      await persistSelectOptions(nextSelectOptions)

      // Update selected values if the renamed choice was selected
      if (isMulti) {
        const newSelected: string[] = selectedValues.map(v => v === oldChoice ? newName.trim() : v)
        await onValueChange(newSelected)
      } else if (selectedValues[0] === oldChoice) {
        await onValueChange(newName.trim())
      }

      setEditingChoice(null)
      setNewChoiceName('')
    } catch (error: any) {
      console.error('Error renaming option:', error)
      logSchemaWarning('InlineSelectDropdown rename option', error)
      alert(getSchemaSafeMessage(error, 'Failed to rename option'))
    }
  }

  // Handle changing a choice color
  const handleChangeColor = async (choice: string, newColor: string) => {
    if (!canEditOptions) return

    try {
      const nextSelectOptions = selectOptions.map(option =>
        option.label === choice
          ? { ...option, color: newColor }
          : option
      )

      await persistSelectOptions(nextSelectOptions)

      setEditingColor(null)
    } catch (error: any) {
      console.error('Error updating color:', error)
      logSchemaWarning('InlineSelectDropdown update color', error)
      alert(getSchemaSafeMessage(error, 'Failed to update color'))
    }
  }

  // Handle deleting a choice
  const handleDeleteChoice = async (choiceToDelete: string) => {
    if (!canEditOptions) return
    if (!confirm(`Delete option "${choiceToDelete}"? This will remove it from all records.`)) return

    try {
      const nextSelectOptions = selectOptions
        .filter(option => option.label !== choiceToDelete)
        .map((option, index) => ({ ...option, sort_index: index }))

      await persistSelectOptions(nextSelectOptions)

      // Remove from selected values if it was selected
      if (isMulti) {
        const filteredValues: string[] = selectedValues.filter(v => v !== choiceToDelete)
        await onValueChange(filteredValues)
      } else if (selectedValues[0] === choiceToDelete) {
        await onValueChange(null)
      }
    } catch (error: any) {
      console.error('Error deleting option:', error)
      logSchemaWarning('InlineSelectDropdown delete option', error)
      alert(getSchemaSafeMessage(error, 'Failed to delete option'))
    }
  }

  const reorderSelectOptions = (fromId: string, toId: string) => {
    const fromIndex = selectOptions.findIndex(option => option.id === fromId)
    const toIndex = selectOptions.findIndex(option => option.id === toId)
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      return selectOptions
    }
    const next = [...selectOptions]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    return next.map((option, index) => ({ ...option, sort_index: index }))
  }

  const handleDragStart = (optionId: string) => (event: React.DragEvent) => {
    if (sortMode !== 'manual' || !canEditOptions) return
    setDraggedOptionId(optionId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', optionId)
  }

  const handleDragOver = (event: React.DragEvent) => {
    if (sortMode !== 'manual' || !canEditOptions) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (targetId: string) => async (event: React.DragEvent) => {
    if (sortMode !== 'manual' || !canEditOptions) return
    event.preventDefault()
    const sourceId = draggedOptionId || event.dataTransfer.getData('text/plain')
    if (!sourceId || sourceId === targetId) {
      setDraggedOptionId(null)
      return
    }
    const nextOptions = reorderSelectOptions(sourceId, targetId)
    setDraggedOptionId(null)
    await persistSelectOptions(nextOptions)
  }

  if (!editable) {
    // Read-only display
    return (
      <div className="flex flex-wrap gap-1.5">
        {selectedValues.length > 0 ? (
          displayVariant === 'text' && !isMulti ? (
            <span className="text-sm text-gray-900">{selectedValues[0]}</span>
          ) : (
          selectedValues.map((val: string) => {
            const hexColor = getChoiceColor(val)
            const textColorClass = getTextColorForBackground(hexColor)
            const bgColor = normalizeHexColor(hexColor)
            return (
              <span
                key={val}
                className={`px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ${textColorClass}`}
                style={{ backgroundColor: bgColor }}
              >
                {val}
              </span>
            )
          })
          )
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
          className={`cell-editor w-full min-h-[32px] px-2.5 py-1.5 flex items-center ${
            displayVariant === 'text' ? 'gap-2' : 'flex-wrap gap-1.5'
          } text-sm border border-gray-300 rounded-md hover:border-blue-400 hover:bg-blue-50/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2`}
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
            displayVariant === 'text' && !isMulti ? (
              <span className="text-sm text-gray-900">{selectedValues[0]}</span>
            ) : (
              selectedValues.map((val: string) => {
                const hexColor = getChoiceColor(val)
                const textColorClass = getTextColorForBackground(hexColor)
                const bgColor = normalizeHexColor(hexColor)
                return (
                  <span
                    key={val}
                    className={`px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ${textColorClass}`}
                    style={{ backgroundColor: bgColor }}
                  >
                    {val}
                  </span>
                )
              })
            )
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
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50/60">
            <span className="text-[11px] uppercase tracking-wide text-gray-500">Order</span>
            <div className="flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setSortMode('manual')}
                className={`px-2 py-1 rounded ${sortMode === 'manual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Manual
              </button>
              <button
                type="button"
                onClick={() => setSortMode('asc')}
                className={`px-2 py-1 rounded ${sortMode === 'asc' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                A-Z
              </button>
              <button
                type="button"
                onClick={() => setSortMode('desc')}
                className={`px-2 py-1 rounded ${sortMode === 'desc' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Z-A
              </button>
            </div>
          </div>

          {/* Options list */}
          <div className="overflow-y-auto flex-1">
            {!isMulti && allowClear && selectedValues.length > 0 && (
              <div className="px-3 py-2 border-b border-gray-100">
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    void onValueChange(null)
                    handleOpenChange(false)
                  }}
                  className="w-full text-left text-sm text-gray-600 hover:text-gray-900"
                >
                  {clearLabel}
                </button>
              </div>
            )}
            {filteredChoices.length === 0 && !canCreateNewOption && (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                No options found
              </div>
            )}

            {filteredChoices.map((option) => {
              const choice = option.label
              const isSelected = selectedValues.includes(choice)
              const hexColor = getChoiceColor(choice)
              const textColorClass = getTextColorForBackground(hexColor)
              const bgColor = normalizeHexColor(hexColor)
              const isEditing = editingChoice === choice
              const isEditingColor = editingColor === choice

              return (
                <div
                  key={option.id}
                  className={`px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                    isSelected ? 'bg-blue-50' : ''
                  }`}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop(option.id)}
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
                          normalizedFieldOptions,
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
                      {canEditOptions && sortMode === 'manual' && (
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          draggable={!updatingOptions}
                          onDragStart={handleDragStart(option.id)}
                          onDragEnd={() => setDraggedOptionId(null)}
                          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
                          title="Drag to reorder"
                          aria-label="Drag to reorder"
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelectChoice(choice)
                        }}
                        className="flex items-center gap-2 flex-1 text-left"
                      >
                        <input
                          type={isMulti ? 'checkbox' : 'radio'}
                          checked={isSelected}
                          onChange={() => {}}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4"
                        />
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${textColorClass}`}
                          style={{ backgroundColor: bgColor }}
                        >
                          {choice}
                        </span>
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
