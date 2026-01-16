"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { X, Plus, Search, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { createClient } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import { cn } from "@/lib/utils"
import { getPrimaryFieldName } from "@/lib/fields/primary"
import { toPostgrestColumn } from "@/lib/supabase/postgrest"

export interface LookupFieldConfig {
  // Optional: field to use as primary label (defaults to the table's primary field)
  primaryLabelField?: string
  
  // Optional: up to 2 fields for secondary context
  secondaryLabelFields?: string[]
  
  // Relationship type
  relationshipType?: 'one-to-one' | 'one-to-many' | 'many-to-many'
  
  // Max selections (for multi-select)
  maxSelections?: number
  
  // Required field
  required?: boolean
  
  // Allow creating new records
  allowCreate?: boolean
  
  // Table to lookup from
  lookupTableId: string
}

export interface LookupFieldPickerProps {
  field: TableField
  value: string | string[] | null
  onChange: (value: string | string[] | null) => void
  config?: LookupFieldConfig
  disabled?: boolean
  placeholder?: string
  onRecordClick?: (tableId: string, recordId: string) => void
  onCreateRecord?: (tableId: string) => Promise<string | null> // Returns new record ID
  isLookupField?: boolean // True for derived lookup fields, false for editable linked fields
}

interface RecordOption {
  id: string
  primaryLabel: string
  secondaryLabels?: string[]
  data: Record<string, any>
}

export default function LookupFieldPicker({
  field,
  value,
  onChange,
  config,
  disabled = false,
  placeholder = "Search and select...",
  onRecordClick,
  onCreateRecord,
  isLookupField = false,
}: LookupFieldPickerProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [options, setOptions] = useState<RecordOption[]>([])
  const [loading, setLoading] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Determine if multi-select
  const isMultiSelect = 
    config?.relationshipType === 'one-to-many' || 
    config?.relationshipType === 'many-to-many' ||
    field.type === 'multi_select' ||
    Array.isArray(value)

  // Get selected IDs - handle both array and comma-separated string (for filters)
  const selectedIds = Array.isArray(value) 
    ? value 
    : value 
      ? (typeof value === 'string' && value.includes(',') ? value.split(',').filter(Boolean) : [value])
      : []

  // Get lookup table ID
  const lookupTableId = config?.lookupTableId || 
    (field.type === 'link_to_table' ? field.options?.linked_table_id : field.options?.lookup_table_id) ||
    field.options?.linked_table_id

  // Requested label fields (may be undefined); effective fields are resolved per-table after loading fields.
  const requestedPrimaryLabelField = config?.primaryLabelField
  const requestedSecondaryLabelFields = config?.secondaryLabelFields || []

  // Get table name for display
  const [tableName, setTableName] = useState<string | null>(null)
  
  useEffect(() => {
    if (lookupTableId) {
      const supabase = createClient()
      supabase
        .from("tables")
        .select("name")
        .eq("id", lookupTableId)
        .single()
        .then(({ data }) => {
          if (data) setTableName(data.name)
        })
    } else {
      setTableName(null)
    }
  }, [lookupTableId])

  const isMirroredLinkedField =
    field.type === 'link_to_table' &&
    !isLookupField &&
    disabled &&
    !!field.options?.read_only

  const handleNavigateToRecord = useCallback(
    (e: React.MouseEvent, recordId: string) => {
      e.stopPropagation()
      if (onRecordClick && lookupTableId) {
        onRecordClick(lookupTableId, recordId)
      }
    },
    [onRecordClick, lookupTableId]
  )

  // Load options when search query changes
  useEffect(() => {
    if (open && lookupTableId) {
      const timeoutId = setTimeout(() => {
        loadOptions(searchQuery)
      }, 300) // Debounce search

      return () => clearTimeout(timeoutId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, searchQuery, lookupTableId])

  // Load selected records on mount/open
  useEffect(() => {
    if (open && selectedIds.length > 0 && lookupTableId) {
      loadSelectedRecords()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedIds.length, lookupTableId])

  async function loadOptions(query: string = "") {
    if (!lookupTableId) return

    setLoading(true)
    try {
      const supabase = createClient()
      
      // Get table info
      const { data: table, error: tableError } = await supabase
        .from("tables")
        .select("supabase_table, name")
        .eq("id", lookupTableId)
        .single()

      if (tableError || !table) {
        console.error("Table not found:", tableError)
        setOptions([])
        return
      }

      // Get fields for the lookup table
      const { data: lookupFields, error: fieldsError } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", lookupTableId)
        .order("position", { ascending: true })

      if (fieldsError) {
        console.error("Error loading fields:", fieldsError)
        setOptions([])
        return
      }

      // Also fetch physical columns, because table_fields metadata can drift from the real table schema.
      // If we select a non-existent column, PostgREST returns 400 and the picker breaks.
      const { data: physicalCols, error: colsError } = await supabase.rpc('get_table_columns', {
        table_name: table.supabase_table,
      })
      const physicalColSet = new Set(
        Array.isArray(physicalCols)
          ? physicalCols.map((c: any) => String(c?.column_name ?? '')).filter(Boolean)
          : []
      )
      const hasPhysical = physicalColSet.size > 0 && !colsError

      const candidatePrimary =
        (requestedPrimaryLabelField && lookupFields?.some((f: any) => f.name === requestedPrimaryLabelField))
          ? requestedPrimaryLabelField
          : (getPrimaryFieldName(lookupFields as any) || 'id')

      const effectivePrimaryLabelField =
        candidatePrimary !== 'id' && (!toPostgrestColumn(candidatePrimary) || (hasPhysical && !physicalColSet.has(candidatePrimary)))
          ? 'id'
          : candidatePrimary

      const effectiveSecondaryLabelFields = (requestedSecondaryLabelFields || [])
        .filter((fieldName) => fieldName && fieldName !== effectivePrimaryLabelField)
        .filter((fieldName) => lookupFields?.some((f: any) => f.name === fieldName))
        .slice(0, 2)

      // Build select query - include primary label field and secondary fields
      const fieldsToSelect = [
        'id',
        effectivePrimaryLabelField,
        ...effectiveSecondaryLabelFields, // Max 2 secondary fields
      ].filter(Boolean)

      // Query records
      let queryBuilder = supabase
        .from(table.supabase_table)
        .select(fieldsToSelect.join(', '))
        .limit(50)

      // Apply search filter if query provided
      if (query.trim()) {
        // Search in primary label field
        const primaryField = lookupFields.find((f: any) => f.name === effectivePrimaryLabelField)
        if (primaryField) {
          if (primaryField.type === 'text' || primaryField.type === 'long_text') {
            queryBuilder = queryBuilder.ilike(effectivePrimaryLabelField, `%${query}%`)
          } else {
            // For other types, use contains
            queryBuilder = queryBuilder.ilike(effectivePrimaryLabelField, `%${query}%`)
          }
        }
      }

      const { data: records, error } = await queryBuilder

      if (error) {
        console.error("Error loading records:", error)
        setOptions([])
        return
      }

      // Transform records to options
      const transformedOptions: RecordOption[] = (records || []).map((record: any) => {
        const primaryLabel = record[effectivePrimaryLabelField] 
          ? String(record[effectivePrimaryLabelField])
          : "Untitled"
        
        const secondaryLabels = effectiveSecondaryLabelFields
          .map(fieldName => record[fieldName])
          .filter(Boolean)
          .map(String)

        return {
          id: record.id,
          primaryLabel,
          secondaryLabels: secondaryLabels.length > 0 ? secondaryLabels : undefined,
          data: record,
        }
      })

      setOptions(transformedOptions)
    } catch (error) {
      console.error("Error in loadOptions:", error)
      setOptions([])
    } finally {
      setLoading(false)
    }
  }

  async function loadSelectedRecords() {
    if (!lookupTableId || selectedIds.length === 0) return

    setLoading(true)
    try {
      const supabase = createClient()
      
      const { data: table } = await supabase
        .from("tables")
        .select("supabase_table")
        .eq("id", lookupTableId)
        .single()

      if (!table) return

      // Load fields so we can resolve the effective primary/secondary label fields.
      const { data: lookupFields } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", lookupTableId)
        .order("position", { ascending: true })

      const effectivePrimaryLabelField =
        (requestedPrimaryLabelField && lookupFields?.some((f: any) => f.name === requestedPrimaryLabelField))
          ? requestedPrimaryLabelField
          : (getPrimaryFieldName(lookupFields as any) || 'id')

      const effectiveSecondaryLabelFields = (requestedSecondaryLabelFields || [])
        .filter((fieldName) => fieldName && fieldName !== effectivePrimaryLabelField)
        .filter((fieldName) => lookupFields?.some((f: any) => f.name === fieldName))
        .slice(0, 2)

      const fieldsToSelect = [
        'id',
        effectivePrimaryLabelField,
        ...effectiveSecondaryLabelFields,
      ].filter(Boolean)

      const { data: records } = await supabase
        .from(table.supabase_table)
        .select(fieldsToSelect.join(', '))
        .in('id', selectedIds)

      if (records) {
        const transformed: RecordOption[] = records.map((record: any) => ({
          id: record.id,
          primaryLabel: record[effectivePrimaryLabelField] 
            ? String(record[effectivePrimaryLabelField])
            : "Untitled",
          secondaryLabels: effectiveSecondaryLabelFields
            .map(fieldName => record[fieldName])
            .filter(Boolean)
            .map(String),
          data: record,
        }))

        // Merge with existing options, avoiding duplicates
        setOptions(prev => {
          const existingIds = new Set(prev.map(o => o.id))
          const newOptions = transformed.filter(o => !existingIds.has(o.id))
          return [...prev, ...newOptions]
        })
      }
    } catch (error) {
      console.error("Error loading selected records:", error)
    } finally {
      setLoading(false)
    }
  }

  function handleSelect(option: RecordOption) {
    if (disabled) return

    if (isMultiSelect) {
      const newValue = selectedIds.includes(option.id)
        ? selectedIds.filter(id => id !== option.id)
        : [...selectedIds, option.id]
      
      // Check max selections
      if (config?.maxSelections && newValue.length > config.maxSelections) {
        return
      }
      
      // For filters, return comma-separated string; otherwise return array
      const isFilterContext = typeof value === 'string' && value.includes(',')
      onChange(isFilterContext 
        ? (newValue.length > 0 ? newValue.join(',') : '')
        : (newValue.length > 0 ? newValue : null)
      )
    } else {
      onChange(option.id)
      setOpen(false)
    }
  }

  function handleRemove(id: string) {
    if (disabled) return
    
    if (isMultiSelect) {
      const newValue = selectedIds.filter(selectedId => selectedId !== id)
      // For filters, return comma-separated string; otherwise return array
      const isFilterContext = typeof value === 'string' && value.includes(',')
      onChange(isFilterContext 
        ? (newValue.length > 0 ? newValue.join(',') : '')
        : (newValue.length > 0 ? newValue : null)
      )
    } else {
      onChange(null)
    }
  }

  function handleCreateNew() {
    if (!onCreateRecord || !lookupTableId) return
    
    onCreateRecord(lookupTableId).then((newRecordId) => {
      if (newRecordId) {
        // Reload options to include new record
        loadOptions(searchQuery).then(() => {
          // Select the new record
          if (newRecordId) {
            handleSelect({ id: newRecordId, primaryLabel: 'New Record', data: {} })
          }
        })
      }
    })
  }


  // Get selected options
  const selectedOptions = options.filter(opt => selectedIds.includes(opt.id))

  // Filter out selected options from dropdown (unless multi-select and showing all)
  const availableOptions = isMultiSelect 
    ? options 
    : options.filter(opt => !selectedIds.includes(opt.id))

  // For lookup fields (read-only), render as informational pills without popover
  if (isLookupField || disabled) {
    return (
      <div className="space-y-2" ref={containerRef}>
        {isMirroredLinkedField && (
          <div className="text-xs text-gray-500">
            Linked from {tableName || 'linked table'}
          </div>
        )}
        <div
          className={cn(
            "min-h-[40px] w-full rounded-md border border-gray-200/50 bg-gray-50/50 px-3 py-2.5 text-sm",
            "flex flex-wrap items-center gap-2",
            isLookupField && "cursor-default"
          )}
        >
          {selectedOptions.length > 0 ? (
            selectedOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                  isLookupField 
                    ? "bg-gray-100/80 text-gray-600 border border-gray-200/50" 
                    : "bg-gray-100 text-gray-700",
                  onRecordClick && "group"
                )}
                style={{ boxShadow: isLookupField ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.05)' }}
                onClick={(e) => handleNavigateToRecord(e, option.id)}
                title="Open linked record"
                aria-label={`Open linked record: ${option.primaryLabel}`}
              >
                <span className={cn(onRecordClick && "hover:text-blue-600 hover:underline transition-colors")}>
                  {option.primaryLabel}
                </span>
              </button>
            ))
          ) : (
            <span className="text-gray-400 italic">{placeholder}</span>
          )}
        </div>
      </div>
    )
  }

  // For linked fields (editable), render with popover
  return (
    <div className="space-y-2" ref={containerRef}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div
            className={cn(
              "min-h-[40px] w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm",
              "flex flex-wrap items-center gap-2 transition-colors",
              !disabled && "cursor-pointer hover:border-blue-300 hover:bg-blue-50/30",
              "focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20 focus-within:ring-offset-1",
              disabled && "opacity-50 cursor-not-allowed bg-gray-50"
            )}
            onClick={() => !disabled && setOpen(true)}
          >
            {selectedOptions.length > 0 ? (
              <>
                {selectedOptions.map((option) => (
                  <span
                    key={option.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/50"
                    style={{ boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      // Clicking the pill navigates to the linked record (Airtable mental model).
                      if (onRecordClick && lookupTableId) {
                        onRecordClick(lookupTableId, option.id)
                      }
                    }}
                    title="Open linked record"
                    role="button"
                  >
                    <span
                      onClick={(e) => {
                        // Already handled by pill click; keep for accessibility/selection.
                        handleNavigateToRecord(e, option.id)
                      }}
                      className="cursor-pointer hover:text-blue-800 hover:underline transition-colors"
                    >
                      {option.primaryLabel}
                    </span>
                    {!disabled && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemove(option.id)
                        }}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-blue-200/50 transition-colors opacity-70 hover:opacity-100"
                        title="Remove"
                        aria-label="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
                {isMultiSelect && selectedOptions.length > 1 && (
                  <span className="text-gray-500 text-xs ml-1">
                    {selectedOptions.length} selected
                  </span>
                )}
                {/* Add button - only show when field is editable and not disabled */}
                {!disabled && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpen(true)
                    }}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors flex-shrink-0"
                    title={tableName ? `Add record from ${tableName}` : "Add record"}
                    aria-label={tableName ? `Add record from ${tableName}` : "Add record"}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between w-full">
                <span className="text-gray-400 italic">{placeholder}</span>
                {!disabled && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpen(true)
                    }}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors flex-shrink-0"
                    title={tableName ? `Add record from ${tableName}` : "Add record"}
                    aria-label={tableName ? `Add record from ${tableName}` : "Add record"}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[400px] p-0" 
          align="start"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            searchInputRef.current?.focus()
          }}
        >
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type to search..."
                className="pl-8"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : availableOptions.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                {searchQuery ? "No results found" : "Start typing to search"}
              </div>
            ) : (
              <>
                {availableOptions.map((option) => {
                  const isSelected = selectedIds.includes(option.id)
                  return (
                    <div
                      key={option.id}
                      className={cn(
                        "px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors",
                        isSelected && "bg-blue-50/50"
                      )}
                      onClick={() => handleSelect(option)}
                    >
                      <div className="font-medium text-sm text-gray-900">{option.primaryLabel}</div>
                      {option.secondaryLabels && option.secondaryLabels.length > 0 && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {option.secondaryLabels.join(" • ")}
                        </div>
                      )}
                    </div>
                  )
                })}
                
                {config?.allowCreate && onCreateRecord && (
                  <div
                    className="px-3 py-2 border-t border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm text-gray-600"
                    onClick={handleCreateNew}
                  >
                    <Plus className="h-4 w-4 text-gray-500" />
                    <span>Create new record</span>
                  </div>
                )}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

