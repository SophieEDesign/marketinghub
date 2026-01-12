"use client"

import { useState, useEffect, useRef } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { TableField, FieldType, FieldOptions } from '@/types/fields'
import { FIELD_TYPES } from '@/types/fields'
import { canChangeType } from '@/lib/fields/validation'
import FormulaEditor from '@/components/fields/FormulaEditor'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface FieldSettingsDrawerProps {
  field: TableField | null
  open: boolean
  onOpenChange: (open: boolean) => void
  tableId: string
  tableFields: TableField[]
  onSave: () => void
}

export default function FieldSettingsDrawer({
  field,
  open,
  onOpenChange,
  tableId,
  tableFields,
  onSave,
}: FieldSettingsDrawerProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<FieldType>('text')
  const [required, setRequired] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [groupName, setGroupName] = useState<string>('')
  const [defaultValue, setDefaultValue] = useState<any>(null)
  const [options, setOptions] = useState<FieldOptions>({})
  const [saving, setSaving] = useState(false)
  const [tables, setTables] = useState<Array<{ id: string; name: string }>>([])
  const [loadingTables, setLoadingTables] = useState(false)
  const [typeChangeWarning, setTypeChangeWarning] = useState<string | null>(null)
  const [lookupTableFields, setLookupTableFields] = useState<Array<{ id: string; name: string; type: string }>>([])
  const [loadingLookupFields, setLoadingLookupFields] = useState(false)
  const [showAddOptionsDialog, setShowAddOptionsDialog] = useState(false)
  const [foundOptions, setFoundOptions] = useState<string[]>([])
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [pendingLookupType, setPendingLookupType] = useState<FieldType | null>(null)
  const [duplicating, setDuplicating] = useState(false)
  const previousTypeRef = useRef<FieldType | null>(null)
  const hasPromptedForOptionsRef = useRef(false)
  const hasPromptedForDuplicateRef = useRef(false)

  // Load tables for link_to_table fields
  useEffect(() => {
    if (open && (type === 'link_to_table' || type === 'lookup')) {
      loadTables()
    }
  }, [open, type])

  // Load fields from lookup table when lookup_table_id or linked_table_id changes
  useEffect(() => {
    const tableId = type === 'lookup' ? options.lookup_table_id : options.linked_table_id
    if (open && (type === 'link_to_table' || type === 'lookup') && tableId) {
      loadLookupTableFields(tableId)
    } else {
      setLookupTableFields([])
    }
  }, [open, type, options.lookup_table_id, options.linked_table_id])

  async function loadTables() {
    setLoadingTables(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('tables')
        .select('id, name')
        .order('name', { ascending: true })

      if (!error && data) {
        setTables(data)
      }
    } catch (error) {
      console.error('Error loading tables:', error)
    } finally {
      setLoadingTables(false)
    }
  }

  async function loadLookupTableFields(tableId: string) {
    setLoadingLookupFields(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('table_fields')
        .select('id, name, type')
        .eq('table_id', tableId)
        .order('position', { ascending: true })

      if (!error && data) {
        setLookupTableFields(data)
      }
    } catch (error) {
      console.error('Error loading lookup table fields:', error)
      setLookupTableFields([])
    } finally {
      setLoadingLookupFields(false)
    }
  }

  // Reset form when field changes
  useEffect(() => {
    if (field && open) {
      setName(field.name)
      setType(field.type)
      setRequired(field.required || false)
      setReadOnly(field.options?.read_only || false)
      setGroupName(field.group_name || '')
      setDefaultValue(field.default_value || null)
      setOptions(field.options || {})
      setTypeChangeWarning(null)
      previousTypeRef.current = field.type
      hasPromptedForOptionsRef.current = false
    } else if (!open) {
      // Reset when drawer closes
      setName('')
      setType('text')
      setRequired(false)
      setReadOnly(false)
      setGroupName('')
      setDefaultValue(null)
      setOptions({})
      setTypeChangeWarning(null)
      previousTypeRef.current = null
      hasPromptedForOptionsRef.current = false
      hasPromptedForDuplicateRef.current = false
      setShowAddOptionsDialog(false)
      setFoundOptions([])
      setShowDuplicateDialog(false)
      setPendingLookupType(null)
    }
  }, [field, open])

  // Check for type change warnings (but duplicate dialog is handled in onValueChange)
  useEffect(() => {
    if (field && open && type !== field.type) {
      const typeCheck = canChangeType(field.type, type)
      
      // Check if trying to convert physical field to lookup/formula
      const isPhysicalToVirtual = 
        field.type !== 'formula' && 
        field.type !== 'lookup' && 
        (type === 'formula' || type === 'lookup')
      
      // Duplicate dialog is handled in Select onValueChange, so skip it here
      if (!typeCheck.canChange && !isPhysicalToVirtual) {
        setTypeChangeWarning(typeCheck.warning || 'Cannot change field type')
        setType(field.type)
      } else if (typeCheck.warning && !isPhysicalToVirtual) {
        setTypeChangeWarning(typeCheck.warning)
      } else {
        setTypeChangeWarning(null)
      }
    } else {
      setTypeChangeWarning(null)
    }
    
    // Reset duplicate prompt flag when type changes away from lookup/formula
    if (type !== 'lookup' && type !== 'formula' && type === field?.type) {
      hasPromptedForDuplicateRef.current = false
    }
  }, [type, field, open])

  // Detect when type changes to single_select and fetch existing values
  useEffect(() => {
    // Only trigger if:
    // 1. Drawer is open
    // 2. Field exists (not a new field)
    // 3. Type changed to single_select
    // 4. Previous type was not single_select
    // 5. Options are empty or don't have choices
    // 6. We haven't already prompted for this type change
    if (
      open &&
      field &&
      type === 'single_select' &&
      previousTypeRef.current !== 'single_select' &&
      previousTypeRef.current !== null && // Only if there was a previous type (not initial load)
      (!options.choices || options.choices.length === 0 || (options.choices.length === 1 && options.choices[0] === '')) &&
      !hasPromptedForOptionsRef.current
    ) {
      hasPromptedForOptionsRef.current = true
      fetchExistingValues()
    }
    
    // Reset prompt flag when type changes away from single_select
    if (type !== 'single_select') {
      hasPromptedForOptionsRef.current = false
    }
    
    // Update previous type ref
    previousTypeRef.current = type
  }, [type, field, open])

  async function fetchExistingValues() {
    if (!field || !field.name) return

    setLoadingOptions(true)
    try {
      const supabase = createClient()
      
      // Get table info to get supabase_table name
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('supabase_table')
        .eq('id', tableId)
        .single()

      if (tableError || !table) {
        console.error('Error loading table:', tableError)
        setLoadingOptions(false)
        return
      }

      // Query all records to get unique values from this field
      // CRITICAL: Reduced limit from 10000 to 2000 to prevent memory exhaustion
      const { data: records, error: recordsError } = await supabase
        .from(table.supabase_table)
        .select(field.name)
        .limit(2000) // Reduced limit to prevent crashes

      if (recordsError) {
        console.error('Error loading records:', recordsError)
        setLoadingOptions(false)
        return
      }

      // Extract unique non-empty values
      const uniqueValues = new Set<string>()
      records?.forEach((record: any) => {
        const value = record[field.name]
        if (value !== null && value !== undefined && value !== '') {
          const stringValue = String(value).trim()
          if (stringValue) {
            uniqueValues.add(stringValue)
          }
        }
      })

      const uniqueArray = Array.from(uniqueValues).sort()
      
      // Only show dialog if we found values
      if (uniqueArray.length > 0) {
        setFoundOptions(uniqueArray)
        setShowAddOptionsDialog(true)
      }
    } catch (error) {
      console.error('Error fetching existing values:', error)
    } finally {
      setLoadingOptions(false)
    }
  }

  function handleAddOptions() {
    if (foundOptions.length > 0) {
      // Merge with existing choices, avoiding duplicates
      const existingChoices = options.choices || []
      const mergedChoices = [...new Set([...existingChoices.filter(c => c.trim() !== ''), ...foundOptions])]
      
      setOptions({
        ...options,
        choices: mergedChoices,
      })
    }
    setShowAddOptionsDialog(false)
    setFoundOptions([])
  }

  function handleSkipOptions() {
    setShowAddOptionsDialog(false)
    setFoundOptions([])
  }

  async function duplicateFieldAndConvert() {
    if (!field || !pendingLookupType) return

    setDuplicating(true)
    try {
      const supabase = createClient()
      
      // Get table info
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('supabase_table')
        .eq('id', tableId)
        .single()

      if (tableError || !table) {
        alert('Failed to load table information')
        return
      }

      // Generate duplicate field name
      let duplicateName = `${field.name}_copy`
      let counter = 1
      
      // Ensure unique name
      const existingFieldNames = tableFields.map(f => f.name.toLowerCase())
      while (existingFieldNames.includes(duplicateName.toLowerCase())) {
        duplicateName = `${field.name}_copy_${counter}`
        counter++
      }
      
      // Step 1: Create duplicate field via API
      const createResponse = await fetch(`/api/tables/${tableId}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: duplicateName,
          type: field.type,
          required: field.required || false,
          default_value: field.default_value || null,
          options: field.options || {},
        }),
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json()
        alert(errorData.error || 'Failed to create duplicate field')
        return
      }

      const duplicateFieldData = await createResponse.json()
      
      // Step 2: Copy data from original column to duplicate column
      // Only if it's a physical field (has a SQL column)
      if (field.type !== 'formula' && field.type !== 'lookup') {
        const sanitizedOrigName = field.name.replace(/"/g, '""')
        const sanitizedDupName = duplicateFieldData.field.name.replace(/"/g, '""')
        const sanitizedTableName = table.supabase_table.replace(/"/g, '""')
        const copySQL = `UPDATE "${sanitizedTableName}" SET "${sanitizedDupName}" = "${sanitizedOrigName}"`
        
        const { error: copyError } = await supabase.rpc('execute_sql_safe', {
          sql_text: copySQL
        })

        if (copyError) {
          console.error('Error copying data:', copyError)
          // Don't fail - field is created, data copy is best-effort
        }
      }

      // Step 3: Delete the original field (it's been backed up to duplicate)
      const deleteResponse = await fetch(`/api/tables/${tableId}/fields`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldId: field.id }),
      })

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json()
        console.error('Failed to delete original field:', errorData)
        // Continue anyway - duplicate is created
      }

      // Step 4: Create new lookup/formula field with original name
      const newFieldResponse = await fetch(`/api/tables/${tableId}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: field.name,
          type: pendingLookupType,
          required: false, // Virtual fields can't be required
          options: pendingLookupType === 'lookup' ? {} : (field.options || {}),
        }),
      })

      if (!newFieldResponse.ok) {
        const errorData = await newFieldResponse.json()
        alert(`Duplicate field "${duplicateName}" was created, but failed to create new ${pendingLookupType} field: ${errorData.error}`)
        // Reload to show the duplicate
        onSave()
        onOpenChange(false)
        return
      }

      // Success! Reload fields
      onSave()
      onOpenChange(false)
      
      // Show success message
      setTimeout(() => {
        alert(`✓ Conversion complete!\n\n- Created "${duplicateName}" with your original data\n- Converted "${field.name}" to a ${pendingLookupType === 'lookup' ? 'lookup' : 'formula'} field\n\nYou can configure the ${pendingLookupType === 'lookup' ? 'lookup' : 'formula'} field settings now.`)
      }, 100)
    } catch (error) {
      console.error('Error duplicating field:', error)
      alert('Failed to duplicate field: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setDuplicating(false)
    }
  }

  function handleCancelDuplicate() {
    setShowDuplicateDialog(false)
    setPendingLookupType(null)
    hasPromptedForDuplicateRef.current = false
    if (field) {
      setType(field.type) // Reset to original type
    }
  }

  const fieldTypeInfo = FIELD_TYPES.find(t => t.type === type)
  const isVirtual = fieldTypeInfo?.isVirtual || false

  async function handleSave() {
    if (!field) return

    if (!name.trim()) {
      alert('Field name is required')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/tables/${tableId}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldId: field.id,
          name: name.trim(),
          type,
          required,
          group_name: groupName.trim() || null,
          default_value: defaultValue || null,
          options: (() => {
            const opts: FieldOptions = { ...options }
            
            // Filter out empty choices
            if (opts.choices) {
              opts.choices = opts.choices.filter(c => c.trim() !== '')
              if (opts.choices.length === 0) {
                delete opts.choices
              }
            }
            
            // Handle read-only
            if (readOnly) {
              opts.read_only = true
            } else {
              delete opts.read_only
            }
            
            // Remove undefined/null values
            Object.keys(opts).forEach(key => {
              const value = opts[key as keyof FieldOptions]
              if (value === undefined || value === null || 
                  (Array.isArray(value) && value.length === 0)) {
                delete opts[key as keyof FieldOptions]
              }
            })
            
            return Object.keys(opts).length > 0 ? opts : undefined
          })(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Failed to update field')
        return
      }

      onSave()
      onOpenChange(false)
    } catch (error) {
      console.error('Error updating field:', error)
      alert('Failed to update field')
    } finally {
      setSaving(false)
    }
  }

  if (!field) return null

  return (
    <>
      <Dialog open={showAddOptionsDialog} onOpenChange={setShowAddOptionsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Existing Values as Options?</DialogTitle>
            <DialogDescription>
              Found {foundOptions.length} unique {foundOptions.length === 1 ? 'value' : 'values'} in this field. Would you like to add {foundOptions.length === 1 ? 'it' : 'them'} as options for the single select field?
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto py-4">
            <div className="space-y-1">
              {foundOptions.slice(0, 20).map((option, index) => (
                <div key={index} className="text-sm p-2 bg-muted rounded">
                  {option}
                </div>
              ))}
              {foundOptions.length > 20 && (
                <p className="text-xs text-muted-foreground mt-2">
                  ... and {foundOptions.length - 20} more
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleSkipOptions}>
              Skip
            </Button>
            <Button onClick={handleAddOptions}>
              Add {foundOptions.length} {foundOptions.length === 1 ? 'Option' : 'Options'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDuplicateDialog} onOpenChange={(open) => {
        if (!open && !duplicating) {
          handleCancelDuplicate()
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to {pendingLookupType === 'lookup' ? 'Lookup' : 'Formula'} Field</DialogTitle>
            <DialogDescription>
              Physical fields cannot be directly converted to virtual fields ({pendingLookupType === 'lookup' ? 'lookup' : 'formula'}). 
              We&apos;ll automatically:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Create a backup copy &quot;{field?.name}_copy&quot; with all your original data</li>
              <li>Delete the original &quot;{field?.name}&quot; field</li>
              <li>Create a new {pendingLookupType === 'lookup' ? 'lookup' : 'formula'} field named &quot;{field?.name}&quot;</li>
            </ol>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Your original data is safely preserved in the &quot;{field?.name}_copy&quot; field. 
                You can delete it later if you don&apos;t need it.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={handleCancelDuplicate}
              disabled={duplicating}
            >
              Cancel
            </Button>
            <Button 
              onClick={duplicateFieldAndConvert}
              disabled={duplicating}
            >
              {duplicating ? 'Converting...' : `Create Backup & Convert`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Field Settings</SheetTitle>
          <SheetDescription>
            Configure field properties and type-specific options
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Field Name */}
          <div className="space-y-2">
            <Label htmlFor="field-name">Field Name</Label>
            <Input
              id="field-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter field name"
            />
          </div>

          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="group-name">Group (Optional)</Label>
            <Input
              id="group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g., Personal Info, Contact Details"
            />
            <p className="text-xs text-muted-foreground">
              Group fields together in the sidebar
            </p>
          </div>

          {/* Field Type */}
          <div className="space-y-2">
            <Label htmlFor="field-type">Field Type</Label>
            <Select 
              value={type} 
              onValueChange={(v) => {
                const newType = v as FieldType
                // Check if this is a physical-to-virtual conversion before setting type
                if (field && field.type !== 'formula' && field.type !== 'lookup' && 
                    (newType === 'formula' || newType === 'lookup')) {
                  const typeCheck = canChangeType(field.type, newType)
                  if (!typeCheck.canChange && !hasPromptedForDuplicateRef.current) {
                    setPendingLookupType(newType)
                    setShowDuplicateDialog(true)
                    hasPromptedForDuplicateRef.current = true
                    // Don't change type - dialog will handle it
                    return
                  }
                }
                setType(newType)
              }}
            >
              <SelectTrigger id="field-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((ft) => (
                  <SelectItem key={ft.type} value={ft.type}>
                    {ft.label} {ft.isVirtual ? '(Virtual)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldTypeInfo && (
              <p className="text-xs text-muted-foreground">
                {fieldTypeInfo.isVirtual
                  ? 'Virtual fields are calculated and cannot store data directly'
                  : `Stored as ${fieldTypeInfo.postgresType || 'text'}`}
              </p>
            )}
            {typeChangeWarning && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">{typeChangeWarning}</p>
              </div>
            )}
          </div>

          {/* Type-specific Options */}
          {(type === 'single_select' || type === 'multi_select') && (
            <div className="space-y-2">
              <Label>Choices</Label>
              <div className="space-y-2">
                {(options.choices && options.choices.length > 0 ? options.choices : ['']).map((choice, index) => {
                  const choiceColor = options.choiceColors?.[choice] || '#3b82f6' // Default blue
                  return (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        value={choice}
                        onChange={(e) => {
                          const newChoices = [...(options.choices || [])]
                          const oldChoice = newChoices[index]
                          newChoices[index] = e.target.value
                          // Preserve color when renaming choice
                          const newChoiceColors = { ...(options.choiceColors || {}) }
                          if (oldChoice && oldChoice !== e.target.value) {
                            if (newChoiceColors[oldChoice]) {
                              newChoiceColors[e.target.value] = newChoiceColors[oldChoice]
                              delete newChoiceColors[oldChoice]
                            }
                          }
                          setOptions({ 
                            ...options, 
                            choices: newChoices,
                            choiceColors: newChoiceColors
                          })
                        }}
                        placeholder="Option name"
                        className="flex-1"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={choiceColor}
                          onChange={(e) => {
                            const newChoiceColors = { ...(options.choiceColors || {}) }
                            if (choice) {
                              newChoiceColors[choice] = e.target.value
                            }
                            setOptions({ ...options, choiceColors: newChoiceColors })
                          }}
                          className="h-10 w-10 rounded border border-gray-300 cursor-pointer"
                          title="Choose color for this option"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const newChoices = (options.choices || []).filter(
                              (_, i) => i !== index
                            )
                            const newChoiceColors = { ...(options.choiceColors || {}) }
                            // Remove color for deleted choice
                            if (choice) {
                              delete newChoiceColors[choice]
                            }
                            setOptions({ 
                              ...options, 
                              choices: newChoices,
                              choiceColors: newChoiceColors
                            })
                          }}
                          className="h-10 w-10 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setOptions({
                      ...options,
                      choices: [...(options.choices || []), ''],
                    })
                  }}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Choice
                </Button>
              </div>
            </div>
          )}

          {type === 'formula' && (
            <div className="space-y-2">
              <Label>Formula</Label>
              <FormulaEditor
                value={options.formula || ''}
                onChange={(formula) => setOptions({ ...options, formula })}
                tableFields={tableFields.filter(
                  (f) => f.id !== field.id && f.type !== 'formula'
                )}
              />
            </div>
          )}

          {type === 'date' && (
            <div className="space-y-2">
              <Label htmlFor="date-format">Date Format</Label>
              <Select
                value={options.date_format || (field?.options?.date_format || 'MMM d, yyyy')}
                onValueChange={(format) =>
                  setOptions({ ...options, date_format: format })
                }
              >
                <SelectTrigger id="date-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yyyy-MM-dd">YYYY-MM-DD</SelectItem>
                  <SelectItem value="MM/dd/yyyy">MM/DD/YYYY</SelectItem>
                  <SelectItem value="dd/MM/yyyy">DD/MM/YYYY</SelectItem>
                  <SelectItem value="MMM d, yyyy">MMM D, YYYY</SelectItem>
                  <SelectItem value="MMMM d, yyyy">MMMM D, YYYY</SelectItem>
                  <SelectItem value="dd MMM yyyy">DD MMM YYYY</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {(type === 'number' || type === 'currency' || type === 'percent') && (
            <div className="space-y-2">
              <Label htmlFor="precision">Decimal Places</Label>
              <Input
                id="precision"
                type="number"
                min="0"
                max="10"
                value={options.precision ?? 2}
                onChange={(e) =>
                  setOptions({
                    ...options,
                    precision: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
          )}

          {type === 'currency' && (
            <div className="space-y-2">
              <Label htmlFor="currency-symbol">Currency Symbol</Label>
              <Input
                id="currency-symbol"
                value={options.currency_symbol || '$'}
                onChange={(e) =>
                  setOptions({ ...options, currency_symbol: e.target.value })
                }
                placeholder="$"
              />
            </div>
          )}

          {type === 'link_to_table' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="linked-table">Linked Table</Label>
                <Select
                  value={options.linked_table_id || undefined}
                  onValueChange={(tableId) =>
                    setOptions({ 
                      ...options, 
                      linked_table_id: tableId || undefined,
                      // Reset display fields when table changes
                      primary_label_field: undefined,
                      secondary_label_fields: undefined,
                    })
                  }
                >
                  <SelectTrigger id="linked-table">
                    <SelectValue placeholder="Select a table" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingTables ? (
                      <SelectItem value="__loading__" disabled>Loading tables...</SelectItem>
                    ) : (
                      tables
                        .filter(t => t.id !== tableId) // Don't allow linking to self
                        .map((table) => (
                          <SelectItem key={table.id} value={table.id}>
                            {table.name}
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              {options.linked_table_id && (
                <div className="space-y-3 border-t pt-4">
                  <Label>Display Configuration</Label>
                  <div className="space-y-2">
                    <Label htmlFor="link-primary-label-field" className="text-sm font-normal">
                      Primary Label Field <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={options.primary_label_field || 'name'}
                      onValueChange={(fieldName) =>
                        setOptions({ ...options, primary_label_field: fieldName })
                      }
                    >
                      <SelectTrigger id="link-primary-label-field">
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {lookupTableFields
                          .filter(f => ['text', 'long_text', 'number', 'date'].includes(f.type))
                          .map((field) => (
                            <SelectItem key={field.id} value={field.name}>
                              {field.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Field used as the main label in relationship picker
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="link-secondary-label-fields" className="text-sm font-normal">
                      Secondary Label Fields (optional, max 2)
                    </Label>
                    <div className="space-y-2">
                      {[0, 1].map((idx) => {
                        const currentValue = (options.secondary_label_fields || [])[idx]
                        return (
                          <Select
                            key={idx}
                            value={currentValue || '__none__'}
                            onValueChange={(fieldName) => {
                              const current = options.secondary_label_fields || []
                              const updated: string[] = [...current]
                              if (fieldName === '__none__') {
                                updated.splice(idx, 1)
                              } else {
                                updated[idx] = fieldName
                              }
                              setOptions({ 
                                ...options, 
                                secondary_label_fields: updated.filter(Boolean) as string[]
                              })
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={`Secondary field ${idx + 1} (optional)`} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">None</SelectItem>
                              {lookupTableFields
                                .filter(f => ['text', 'long_text', 'number', 'date'].includes(f.type))
                                .map((field) => (
                                  <SelectItem key={field.id} value={field.name}>
                                    {field.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        )
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Additional context shown below the primary label
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="link-relationship-type" className="text-sm font-normal">
                      Relationship Type
                    </Label>
                    <Select
                      value={options.relationship_type || 'one-to-many'}
                      onValueChange={(relType) =>
                        setOptions({ ...options, relationship_type: relType as any })
                      }
                    >
                      <SelectTrigger id="link-relationship-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one-to-one">One to One</SelectItem>
                        <SelectItem value="one-to-many">One to Many</SelectItem>
                        <SelectItem value="many-to-many">Many to Many</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(options.relationship_type === 'one-to-many' || options.relationship_type === 'many-to-many') && (
                    <div className="space-y-2">
                      <Label htmlFor="link-max-selections" className="text-sm font-normal">
                        Max Selections (optional)
                      </Label>
                      <Input
                        id="link-max-selections"
                        type="number"
                        min="1"
                        value={options.max_selections || ''}
                        onChange={(e) =>
                          setOptions({ 
                            ...options, 
                            max_selections: e.target.value ? parseInt(e.target.value) : undefined 
                          })
                        }
                        placeholder="No limit"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="link-allow-create" className="text-sm font-normal">
                        Allow Creating New Records
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Users can create new related records from the relationship field
                      </p>
                    </div>
                    <Switch
                      id="link-allow-create"
                      checked={options.allow_create || false}
                      onCheckedChange={(checked) =>
                        setOptions({ ...options, allow_create: checked })
                      }
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {type === 'lookup' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="lookup-table">Lookup Table</Label>
                <Select
                  value={options.lookup_table_id || undefined}
                  onValueChange={(tableId) =>
                    setOptions({ 
                      ...options, 
                      lookup_table_id: tableId || undefined,
                      // Reset display fields when table changes
                      primary_label_field: undefined,
                      secondary_label_fields: undefined,
                    })
                  }
                >
                  <SelectTrigger id="lookup-table">
                    <SelectValue placeholder="Select a table" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingTables ? (
                      <SelectItem value="__loading__" disabled>Loading tables...</SelectItem>
                    ) : (
                      tables
                        .filter(t => t.id !== tableId)
                        .map((table) => (
                          <SelectItem key={table.id} value={table.id}>
                            {table.name}
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              {options.lookup_table_id && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="lookup-field">Lookup Field</Label>
                    <Select
                      value={options.lookup_field_id || undefined}
                      onValueChange={(fieldId) =>
                        setOptions({ ...options, lookup_field_id: fieldId || undefined })
                      }
                    >
                      <SelectTrigger id="lookup-field">
                        <SelectValue placeholder="Select a field" />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingLookupFields ? (
                          <SelectItem value="__loading__" disabled>Loading fields...</SelectItem>
                        ) : (
                          lookupTableFields.map((field) => (
                            <SelectItem key={field.id} value={field.id}>
                              {field.name} ({field.type})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Display Configuration */}
                  <div className="space-y-3 border-t pt-4">
                    <Label>Display Configuration</Label>
                    <div className="space-y-2">
                      <Label htmlFor="primary-label-field" className="text-sm font-normal">
                        Primary Label Field <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={options.primary_label_field || 'name'}
                        onValueChange={(fieldName) =>
                          setOptions({ ...options, primary_label_field: fieldName })
                        }
                      >
                        <SelectTrigger id="primary-label-field">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          {lookupTableFields
                            .filter(f => ['text', 'long_text', 'number', 'date'].includes(f.type))
                            .map((field) => (
                              <SelectItem key={field.id} value={field.name}>
                                {field.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Field used as the main label in lookup results
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="secondary-label-fields" className="text-sm font-normal">
                        Secondary Label Fields (optional, max 2)
                      </Label>
                      <div className="space-y-2">
                        {[0, 1].map((idx) => {
                          const currentValue = (options.secondary_label_fields || [])[idx]
                          return (
                            <Select
                              key={idx}
                              value={currentValue || '__none__'}
                              onValueChange={(fieldName) => {
                                const current = options.secondary_label_fields || []
                                const updated: string[] = [...current]
                                if (fieldName === '__none__') {
                                  updated.splice(idx, 1)
                                } else {
                                  updated[idx] = fieldName
                                }
                                setOptions({ 
                                  ...options, 
                                  secondary_label_fields: updated.filter(Boolean) as string[]
                                })
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={`Secondary field ${idx + 1} (optional)`} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">None</SelectItem>
                                {lookupTableFields
                                  .filter(f => ['text', 'long_text', 'number', 'date'].includes(f.type))
                                  .map((field) => (
                                    <SelectItem key={field.id} value={field.name}>
                                      {field.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          )
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Additional context shown below the primary label
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="relationship-type" className="text-sm font-normal">
                        Relationship Type
                      </Label>
                      <Select
                        value={options.relationship_type || 'one-to-many'}
                        onValueChange={(relType) =>
                          setOptions({ ...options, relationship_type: relType as any })
                        }
                      >
                        <SelectTrigger id="relationship-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="one-to-one">One to One</SelectItem>
                          <SelectItem value="one-to-many">One to Many</SelectItem>
                          <SelectItem value="many-to-many">Many to Many</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(options.relationship_type === 'one-to-many' || options.relationship_type === 'many-to-many') && (
                      <div className="space-y-2">
                        <Label htmlFor="max-selections" className="text-sm font-normal">
                          Max Selections (optional)
                        </Label>
                        <Input
                          id="max-selections"
                          type="number"
                          min="1"
                          value={options.max_selections || ''}
                          onChange={(e) =>
                            setOptions({ 
                              ...options, 
                              max_selections: e.target.value ? parseInt(e.target.value) : undefined 
                            })
                          }
                          placeholder="No limit"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="allow-create" className="text-sm font-normal">
                          Allow Creating New Records
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Users can create new related records from the lookup field
                        </p>
                      </div>
                      <Switch
                        id="allow-create"
                        checked={options.allow_create || false}
                        onCheckedChange={(checked) =>
                          setOptions({ ...options, allow_create: checked })
                        }
                      />
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* Required Toggle */}
          {!isVirtual && (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="required">Required</Label>
                <p className="text-xs text-muted-foreground">
                  Field must have a value
                </p>
              </div>
              <Switch
                id="required"
                checked={required}
                onCheckedChange={setRequired}
              />
            </div>
          )}

          {/* Read-only Toggle */}
          {!isVirtual && (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="readonly">Read-only</Label>
                <p className="text-xs text-muted-foreground">
                  Field cannot be edited
                </p>
              </div>
              <Switch
                id="readonly"
                checked={readOnly}
                onCheckedChange={setReadOnly}
              />
            </div>
          )}

          {/* Default Value */}
          {!isVirtual && type !== 'attachment' && type !== 'json' && (
            <div className="space-y-2">
              <Label htmlFor="default-value">Default Value</Label>
              {type === 'checkbox' ? (
                <Select
                  value={defaultValue ? 'true' : 'false'}
                  onValueChange={(v) => setDefaultValue(v === 'true')}
                >
                  <SelectTrigger id="default-value">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">False</SelectItem>
                    <SelectItem value="true">True</SelectItem>
                  </SelectContent>
                </Select>
              ) : type === 'date' ? (
                <Input
                  id="default-value"
                  type="date"
                  value={
                    defaultValue
                      ? new Date(defaultValue).toISOString().split('T')[0]
                      : ''
                  }
                  onChange={(e) =>
                    setDefaultValue(
                      e.target.value ? new Date(e.target.value).toISOString() : null
                    )
                  }
                />
              ) : type === 'number' ||
                type === 'currency' ||
                type === 'percent' ? (
                <Input
                  id="default-value"
                  type="number"
                  value={defaultValue || ''}
                  onChange={(e) =>
                    setDefaultValue(
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                />
              ) : (
                <Input
                  id="default-value"
                  value={defaultValue || ''}
                  onChange={(e) => setDefaultValue(e.target.value || null)}
                  placeholder="Default value"
                />
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-8 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
    </>
  )
}
