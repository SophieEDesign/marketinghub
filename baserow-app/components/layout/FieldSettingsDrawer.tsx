"use client"

import { useState, useEffect, useRef } from 'react'
import { format as formatDate } from 'date-fns'
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
import { X, Plus, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { TableField, FieldType, FieldOptions, ChoiceColorTheme } from '@/types/fields'
import { FIELD_TYPES } from '@/types/fields'
import { CHOICE_COLOR_THEME_LABELS, isChoiceColorTheme, resolveChoiceColor } from '@/lib/field-colors'
import { canChangeType } from '@/lib/fields/validation'
import { getFieldDisplayName } from '@/lib/fields/display'
import { getPrimaryFieldName } from '@/lib/fields/primary'
import FormulaEditor from '@/components/fields/FormulaEditor'
import type { SelectOption } from '@/types/fields'
import { normalizeSelectOptionsForUi } from '@/lib/fields/select-options'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const DATE_FORMAT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'yyyy-MM-dd', label: 'ISO' },
  { value: 'MM/dd/yyyy', label: 'US' },
  { value: 'dd/MM/yyyy', label: 'UK' },
  { value: 'MMM d, yyyy', label: 'Short month' },
  { value: 'MMMM d, yyyy', label: 'Long month' },
  { value: 'dd MMM yyyy', label: 'Day first' },
]

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
  const [lookupTableFields, setLookupTableFields] = useState<Array<{ id: string; name: string; label?: string | null; type: string }>>([])
  const [loadingLookupFields, setLoadingLookupFields] = useState(false)
  const [showAddOptionsDialog, setShowAddOptionsDialog] = useState(false)
  const [foundOptions, setFoundOptions] = useState<string[]>([])
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [pendingLookupType, setPendingLookupType] = useState<FieldType | null>(null)
  const [duplicating, setDuplicating] = useState(false)
  const [reciprocalFieldInfo, setReciprocalFieldInfo] = useState<{
    field: { id: string; name: string; label?: string | null }
    table: { id: string; name: string }
  } | null>(null)
  const [sourceFieldInfo, setSourceFieldInfo] = useState<{
    field: { id: string; name: string; label?: string | null }
    table: { id: string; name: string }
  } | null>(null)
  const previousTypeRef = useRef<FieldType | null>(null)
  const hasPromptedForOptionsRef = useRef(false)
  const hasPromptedForDuplicateRef = useRef(false)
  const dragChoiceIndexRef = useRef<number | null>(null)

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

  // Load reciprocal/source field info for link_to_table fields
  useEffect(() => {
    if (open && type === 'link_to_table' && field?.id) {
      loadLinkedFieldInfo()
    } else {
      setReciprocalFieldInfo(null)
      setSourceFieldInfo(null)
    }
  }, [open, type, field?.id, options.linked_field_id])

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
      // Prefer a minimal select to avoid PostgREST 400s in environments where `table_fields.label`
      // hasn't been migrated yet. UI can still display `name` as the label fallback.
      const { data, error } = await supabase
        .from('table_fields')
        .select('id, name, type')
        .eq('table_id', tableId)
        .order('position', { ascending: true })

      if (!error && data) {
        setLookupTableFields(data as any)
      } else {
        console.error('Error loading lookup table fields:', error)
        setLookupTableFields([])
      }
    } catch (error) {
      console.error('Error loading lookup table fields:', error)
      setLookupTableFields([])
    } finally {
      setLoadingLookupFields(false)
    }
  }

  async function loadLinkedFieldInfo() {
    if (!field?.id || type !== 'link_to_table') return

    try {
      const supabase = createClient()
      const linkedFieldId = options.linked_field_id

      // Check if this field has a reciprocal field (linked_field_id points to another field)
      if (linkedFieldId) {
        // This field has a reciprocal - load the reciprocal field info
        const { data: reciprocalField, error: fieldError } = await supabase
          .from('table_fields')
          .select('id, name, label, table_id')
          .eq('id', linkedFieldId)
          .single()

        if (!fieldError && reciprocalField) {
          const { data: reciprocalTable, error: tableError } = await supabase
            .from('tables')
            .select('id, name')
            .eq('id', reciprocalField.table_id)
            .single()

          if (!tableError && reciprocalTable) {
            setReciprocalFieldInfo({
              field: {
                id: reciprocalField.id,
                name: reciprocalField.name,
                label: reciprocalField.label,
              },
              table: {
                id: reciprocalTable.id,
                name: reciprocalTable.name,
              },
            })
          }
        }
      }

      // Check if this field IS a reciprocal field (another field's linked_field_id points to this field)
      const { data: sourceFields, error: sourceFieldsError } = await supabase
        .from('table_fields')
        .select('id, name, label, table_id, options')
        .eq('type', 'link_to_table')
        .contains('options', { linked_field_id: field.id })

      if (!sourceFieldsError && sourceFields && sourceFields.length > 0) {
        // This field is a reciprocal - find the source field
        const sourceField = sourceFields[0]
        const { data: sourceTable, error: sourceTableError } = await supabase
          .from('tables')
          .select('id, name')
          .eq('id', sourceField.table_id)
          .single()

        if (!sourceTableError && sourceTable) {
          setSourceFieldInfo({
            field: {
              id: sourceField.id,
              name: sourceField.name,
              label: sourceField.label,
            },
            table: {
              id: sourceTable.id,
              name: sourceTable.name,
            },
          })
        }
      }
    } catch (error) {
      console.error('Error loading linked field info:', error)
    }
  }

  // Reset form when field changes
  useEffect(() => {
    if (field && open) {
      setName(getFieldDisplayName(field))
      setType(field.type)
      setRequired(field.required || false)
      setReadOnly(field.options?.read_only || false)
      setGroupName(field.group_name || '')
      // Preserve valid falsy defaults like 0/false
      setDefaultValue(field.default_value ?? null)
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

  function safeId(): string {
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

  function syncSelectOptionsPayload(
    base: FieldOptions,
    input: SelectOption[],
    { dropEmpty }: { dropEmpty: boolean }
  ): FieldOptions {
    const mapped = (Array.isArray(input) ? input : [])
      .map((o) => ({
        id: String(o?.id || '').trim() || safeId(),
        // Preserve in-progress typing (don't trim until save)
        label: typeof o?.label === 'string' ? o.label : String(o?.label ?? ''),
        color: (() => {
          if (typeof o?.color === 'string' && o.color) return o.color
          const label = typeof o?.label === 'string' ? o.label : String(o?.label ?? '')
          const m = (base?.choiceColors || {}) as Record<string, string>
          const direct = typeof m[label] === 'string' ? m[label] : undefined
          const trimmed = typeof m[label.trim()] === 'string' ? m[label.trim()] : undefined
          return direct || trimmed
        })(),
        sort_index:
          typeof o?.sort_index === 'number' && Number.isFinite(o.sort_index) ? Math.trunc(o.sort_index) : 0,
        created_at: typeof o?.created_at === 'string' && o.created_at ? o.created_at : nowIso(),
      }))
      .sort((a, b) => a.sort_index - b.sort_index)
      .map((o, idx) => ({ ...o, sort_index: idx }))

    const kept = dropEmpty ? mapped.filter((o) => String(o.label).trim().length > 0) : mapped
    const reindexed = kept.map((o, idx) => ({ ...o, sort_index: idx }))

    const choices = reindexed.map((o) => o.label)
    const choiceColors: Record<string, string> = {}
    for (const o of reindexed) {
      const key = String(o.label).trim()
      if (!key) continue
      if (o.color) choiceColors[key] = o.color
    }

    const next: FieldOptions = {
      ...base,
      selectOptions: reindexed,
      // Keep legacy keys in sync so older UI paths remain stable.
      choices,
      choiceColors: Object.keys(choiceColors).length > 0 ? choiceColors : undefined,
    }
    return next
  }

  // When editing select fields, ensure we always have a normalized selectOptions model in state.
  useEffect(() => {
    if (!open) return
    if (type !== 'single_select' && type !== 'multi_select') return
    const { didRepair, repairedFieldOptions } = normalizeSelectOptionsForUi(type, options)
    if (didRepair && repairedFieldOptions) {
      setOptions(repairedFieldOptions)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type])

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
    // Auto-import when changing from 'text' to 'single_select'
    if (
      open &&
      field &&
      type === 'single_select' &&
      previousTypeRef.current === 'text' && // Only when changing from text
      previousTypeRef.current !== null && // Only if there was a previous type (not initial load)
      (!options.choices || options.choices.length === 0 || (options.choices.length === 1 && options.choices[0] === '')) &&
      !hasPromptedForOptionsRef.current
    ) {
      hasPromptedForOptionsRef.current = true
      fetchExistingValues(true) // Auto-import mode
    }
    // Show dialog for other type changes to single_select
    else if (
      open &&
      field &&
      type === 'single_select' &&
      previousTypeRef.current !== 'single_select' &&
      previousTypeRef.current !== 'text' && // Not from text (handled above)
      previousTypeRef.current !== null && // Only if there was a previous type (not initial load)
      (!options.choices || options.choices.length === 0 || (options.choices.length === 1 && options.choices[0] === '')) &&
      !hasPromptedForOptionsRef.current
    ) {
      hasPromptedForOptionsRef.current = true
      fetchExistingValues(false) // Show dialog mode
    }
    
    // Reset prompt flag when type changes away from single_select
    if (type !== 'single_select') {
      hasPromptedForOptionsRef.current = false
    }
    
    // Update previous type ref
    previousTypeRef.current = type
  }, [type, field, open, options.choices])

  async function fetchExistingValues(autoImport: boolean = false) {
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
      
      // Auto-import when changing from text to single_select
      if (autoImport && uniqueArray.length > 0) {
        // Automatically add all values to options (canonical selectOptions + legacy keys)
        const { selectOptions } = normalizeSelectOptionsForUi('single_select', options)
        const existingLabels = new Set(selectOptions.map((o) => o.label))
        const appended: SelectOption[] = []
        for (const label of uniqueArray) {
          const trimmed = String(label).trim()
          if (!trimmed || existingLabels.has(trimmed)) continue
          appended.push({
            id: safeId(),
            label: trimmed,
            sort_index: selectOptions.length + appended.length,
            created_at: nowIso(),
          })
        }
        setOptions((prev) =>
          syncSelectOptionsPayload(prev, [...selectOptions, ...appended], { dropEmpty: true })
        )
      }
      // Show dialog for other type changes
      else if (uniqueArray.length > 0) {
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
      // Merge with existing options, avoiding duplicates
      const { selectOptions } = normalizeSelectOptionsForUi(type === 'multi_select' ? 'multi_select' : 'single_select', options)
      const existingLabels = new Set(selectOptions.map((o) => o.label))
      const appended: SelectOption[] = []
      for (const label of foundOptions) {
        const trimmed = String(label).trim()
        if (!trimmed || existingLabels.has(trimmed)) continue
        appended.push({
          id: safeId(),
          label: trimmed,
          sort_index: selectOptions.length + appended.length,
          created_at: nowIso(),
        })
      }
      setOptions((prev) =>
        syncSelectOptionsPayload(prev, [...selectOptions, ...appended], { dropEmpty: true })
      )
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
      const deleteResponse = await fetch(
        `/api/tables/${tableId}/fields?fieldId=${encodeURIComponent(field.id)}`,
        { method: 'DELETE' }
      )

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
        alert(`✓ Conversion complete!\n\n- Created "${duplicateName}" with your original data\n- Converted "${getFieldDisplayName(field)}" to a ${pendingLookupType === 'lookup' ? 'lookup' : 'formula'} field\n\nYou can configure the ${pendingLookupType === 'lookup' ? 'lookup' : 'formula'} field settings now.`)
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
          label: name.trim(),
          type,
          required,
          group_name: groupName.trim() || null,
          // Preserve valid falsy defaults like 0/false (only null/undefined become null)
          default_value: defaultValue ?? null,
          options: (() => {
            let opts: FieldOptions = { ...options }

            // Canonicalize select field options (ordering + colors)
            if (type === 'single_select' || type === 'multi_select') {
              const normalized = normalizeSelectOptionsForUi(type, opts)
              opts = normalized.repairedFieldOptions || opts
              const { selectOptions } = normalizeSelectOptionsForUi(type, opts)
              // Persist without blank/whitespace-only options.
              const trimmed = selectOptions.map((o) => ({ ...o, label: String(o.label ?? '').trim() }))
              opts = syncSelectOptionsPayload(opts, trimmed, { dropEmpty: true })
            }
            
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
            
            // Important: return empty object when clearing options so the API can persist removals
            // (e.g. unchecking read_only should update options to {} rather than omitting it).
            return opts
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
              <div className="space-y-2 rounded-md border border-gray-200 p-3 bg-gray-50/50">
                <Label className="text-xs text-gray-700">Colour theme</Label>
                <Select
                  value={
                    (isChoiceColorTheme(options.choiceColorTheme)
                      ? options.choiceColorTheme
                      : 'vibrant') as ChoiceColorTheme
                  }
                  onValueChange={(theme) => {
                    const next: FieldOptions = { ...options }
                    if (theme === 'vibrant') {
                      delete next.choiceColorTheme
                    } else {
                      next.choiceColorTheme = theme as ChoiceColorTheme
                    }
                    setOptions(next)
                  }}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CHOICE_COLOR_THEME_LABELS) as ChoiceColorTheme[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {CHOICE_COLOR_THEME_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Applies to pills without a custom colour.
                </p>
              </div>
              <div className="space-y-2">
                {(() => {
                  const { selectOptions } = normalizeSelectOptionsForUi(type as any, options)
                  const ordered = (selectOptions.length > 0 ? selectOptions : [{ id: safeId(), label: '', sort_index: 0, created_at: nowIso() }]).slice().sort((a, b) => a.sort_index - b.sort_index)

                  const applyReindexed = (next: SelectOption[]) => {
                    const reindexed = next.map((o, idx) => ({ ...o, sort_index: idx }))
                    setOptions((prev) => syncSelectOptionsPayload(prev, reindexed, { dropEmpty: false }))
                  }

                  const sortByLabel = (dir: 1 | -1) => {
                    const sorted = ordered
                      .filter((o) => String(o.label || '').trim().length > 0)
                      .slice()
                      .sort((a, b) => dir * String(a.label).localeCompare(String(b.label), undefined, { sensitivity: 'base' }))
                    applyReindexed(sorted)
                  }

                  const move = (from: number, to: number) => {
                    if (from === to) return
                    if (from < 0 || to < 0) return
                    if (from >= ordered.length || to >= ordered.length) return
                    const next = ordered.slice()
                    const [item] = next.splice(from, 1)
                    next.splice(to, 0, item)
                    applyReindexed(next)
                  }

                  return (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          Drag to reorder, or sort alphabetically.
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => sortByLabel(1)}
                            disabled={ordered.filter((o) => String(o.label || '').trim().length > 0).length < 2}
                            className="h-8"
                            title="Sort A to Z (updates manual order)"
                          >
                            Sort A→Z
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => sortByLabel(-1)}
                            disabled={ordered.filter((o) => String(o.label || '').trim().length > 0).length < 2}
                            className="h-8"
                            title="Sort Z to A (updates manual order)"
                          >
                            Sort Z→A
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {ordered.map((opt, index) => {
                          const label = String(opt.label || '')
                          const defaultColor = resolveChoiceColor(
                            label,
                            type as 'single_select' | 'multi_select',
                            options,
                            type === 'single_select'
                          )
                          const colorValue = opt.color || options.choiceColors?.[label] || defaultColor

                          return (
                            <div
                              key={opt.id || `${index}`}
                              className="flex gap-2 items-center rounded-md border border-gray-200 bg-white px-2 py-2"
                              onDragOver={(e) => {
                                e.preventDefault()
                              }}
                              onDrop={(e) => {
                                e.preventDefault()
                                const fromStr = e.dataTransfer.getData('text/plain')
                                const from = Number.parseInt(fromStr, 10)
                                if (Number.isFinite(from)) move(from, index)
                                dragChoiceIndexRef.current = null
                              }}
                            >
                              <button
                                type="button"
                                className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 select-none px-1"
                                draggable
                                onDragStart={(e) => {
                                  dragChoiceIndexRef.current = index
                                  e.dataTransfer.setData('text/plain', String(index))
                                  e.dataTransfer.effectAllowed = 'move'
                                }}
                                onDragEnd={() => {
                                  dragChoiceIndexRef.current = null
                                }}
                                aria-label="Drag to reorder"
                                title="Drag to reorder"
                              >
                                ⋮⋮
                              </button>

                              <Input
                                value={label}
                                onChange={(e) => {
                                  const next = ordered.slice()
                                  const preservedColor =
                                    next[index]?.color ||
                                    options.choiceColors?.[label] ||
                                    options.choiceColors?.[label.trim()] ||
                                    undefined
                                  next[index] = {
                                    ...next[index],
                                    label: e.target.value,
                                    color: preservedColor,
                                    created_at: next[index]?.created_at || nowIso(),
                                  }
                                  applyReindexed(next)
                                }}
                                placeholder="Option name"
                                className="flex-1 bg-white"
                              />

                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={colorValue}
                                  onChange={(e) => {
                                    const next = ordered.slice()
                                    next[index] = { ...next[index], color: e.target.value, created_at: next[index]?.created_at || nowIso() }
                                    applyReindexed(next)
                                  }}
                                  className="h-10 w-10 rounded border border-gray-300 cursor-pointer"
                                  title="Choose color for this option"
                                />

                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    const next = ordered.filter((_, i) => i !== index)
                                    applyReindexed(next)
                                  }}
                                  className="h-10 w-10 p-0"
                                  title="Delete"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )
                })()}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const { selectOptions } = normalizeSelectOptionsForUi(type as any, options)
                    const next = [...selectOptions].sort((a, b) => a.sort_index - b.sort_index)
                    next.push({
                      id: safeId(),
                      label: '',
                      sort_index: next.length,
                      created_at: nowIso(),
                    })
                    setOptions((prev) => syncSelectOptionsPayload(prev, next, { dropEmpty: false }))
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
                  {DATE_FORMAT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label} ({formatDate(new Date(2026, 0, 15), opt.value)})
                    </SelectItem>
                  ))}
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
                {options.linked_table_id && (() => {
                  const selectedTable = tables.find(t => t.id === options.linked_table_id)
                  return (
                    <p className="text-xs text-muted-foreground">
                      This field lets you pull records from the {selectedTable?.name || 'selected'} table. Each row can contain one or more records from that table.
                    </p>
                  )
                })()}
              </div>

              {/* Linked Field Information */}
              {(reciprocalFieldInfo || sourceFieldInfo) && (
                <div className="space-y-2 border-t pt-4">
                  <Label>Linked Field</Label>
                  {reciprocalFieldInfo && (
                    <div className="px-3 py-2 border border-gray-200 rounded-md bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            Reciprocal field
                          </p>
                          <p className="text-xs text-gray-600 mt-0.5">
                            {getFieldDisplayName(reciprocalFieldInfo.field as any)} in {reciprocalFieldInfo.table.name}
                          </p>
                        </div>
                        <Link
                          href={`/tables/${reciprocalFieldInfo.table.id}/fields`}
                          className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View
                        </Link>
                      </div>
                    </div>
                  )}
                  {sourceFieldInfo && (
                    <div className="px-3 py-2 border border-gray-200 rounded-md bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            Linked to
                          </p>
                          <p className="text-xs text-gray-600 mt-0.5">
                            {getFieldDisplayName(sourceFieldInfo.field as any)} in {sourceFieldInfo.table.name}
                          </p>
                        </div>
                        <Link
                          href={`/tables/${sourceFieldInfo.table.id}/fields`}
                          className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View
                        </Link>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {reciprocalFieldInfo 
                      ? 'This field has a reciprocal field that automatically syncs bidirectionally.'
                      : 'This field is a reciprocal field that automatically syncs with the source field.'}
                  </p>
                </div>
              )}

              {options.linked_table_id && (
                <div className="space-y-3 border-t pt-4">
                  <Label>Display Configuration</Label>
                  <div className="space-y-2">
                    <Label className="text-sm font-normal">Primary Field</Label>
                    <div className="px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-700">
                      {getPrimaryFieldName(lookupTableFields as any) || '(no fields found)'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This is the table’s core “primary field” used to identify records (also used for CSV import and record pickers).
                    </p>
                  </div>

                  <div className="space-y-2">
                        <Label htmlFor="link-relationship-type" className="text-sm font-normal">
                      How many records can be selected
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
                        Users can create new records in the linked table from this field
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
                {options.lookup_table_id && options.lookup_field_id && (() => {
                  const lookupField = lookupTableFields.find(f => f.id === options.lookup_field_id)
                  const linkField = tableFields.find(f => 
                    f.type === 'link_to_table' && 
                    f.options?.linked_table_id === options.lookup_table_id
                  )
                  return (
                    <p className="text-xs text-muted-foreground">
                      {linkField 
                        ? `This field shows information pulled from records in the "${getFieldDisplayName(linkField)}" field.`
                        : `This field shows information pulled from records in the linked table.`}
                    </p>
                  )
                })()}
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
                              {getFieldDisplayName(field)} ({field.type})
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
                      <Label className="text-sm font-normal">Primary Field</Label>
                      <div className="px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-700">
                        {getPrimaryFieldName(lookupTableFields as any) || '(no fields found)'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        This is the table’s core “primary field” used to identify records (also used for CSV import and record pickers).
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="relationship-type" className="text-sm font-normal">
                        How many records can be selected
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
                          Users can create new records in the linked table from this field
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
