"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { X, Plus, Search, Loader2, GripVertical } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { createClient } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import { cn } from "@/lib/utils"

export interface LookupFieldConfig {
  // Required: field to use as primary label
  primaryLabelField: string
  
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
}: LookupFieldPickerProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [options, setOptions] = useState<RecordOption[]>([])
  const [loading, setLoading] = useState(false)
  const [previewRecord, setPreviewRecord] = useState<RecordOption | null>(null)
  const [previewPosition, setPreviewPosition] = useState<{ x: number; y: number } | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null)
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

  // Get primary and secondary label fields
  const primaryLabelField = config?.primaryLabelField || 'name' // Default fallback
  const secondaryLabelFields = config?.secondaryLabelFields || []

  // Load options when search query changes
  useEffect(() => {
    if (open && lookupTableId) {
      const timeoutId = setTimeout(() => {
        loadOptions(searchQuery)
      }, 300) // Debounce search

      return () => clearTimeout(timeoutId)
    }
  }, [open, searchQuery, lookupTableId])

  // Load selected records on mount/open
  useEffect(() => {
    if (open && selectedIds.length > 0 && lookupTableId) {
      loadSelectedRecords()
    }
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

      // Build select query - include primary label field and secondary fields
      const fieldsToSelect = [
        'id',
        primaryLabelField,
        ...secondaryLabelFields.slice(0, 2), // Max 2 secondary fields
      ].filter(Boolean)

      // Query records
      let queryBuilder = supabase
        .from(table.supabase_table)
        .select(fieldsToSelect.join(', '))
        .limit(50)

      // Apply search filter if query provided
      if (query.trim()) {
        // Search in primary label field
        const primaryField = lookupFields.find(f => f.name === primaryLabelField)
        if (primaryField) {
          if (primaryField.type === 'text' || primaryField.type === 'long_text') {
            queryBuilder = queryBuilder.ilike(primaryLabelField, `%${query}%`)
          } else {
            // For other types, use contains
            queryBuilder = queryBuilder.ilike(primaryLabelField, `%${query}%`)
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
        const primaryLabel = record[primaryLabelField] 
          ? String(record[primaryLabelField])
          : `Record ${record.id.substring(0, 8)}`
        
        const secondaryLabels = secondaryLabelFields
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

      const fieldsToSelect = [
        'id',
        primaryLabelField,
        ...secondaryLabelFields.slice(0, 2),
      ].filter(Boolean)

      const { data: records } = await supabase
        .from(table.supabase_table)
        .select(fieldsToSelect.join(', '))
        .in('id', selectedIds)

      if (records) {
        const transformed: RecordOption[] = records.map((record: any) => ({
          id: record.id,
          primaryLabel: record[primaryLabelField] 
            ? String(record[primaryLabelField])
            : `Record ${record.id.substring(0, 8)}`,
          secondaryLabels: secondaryLabelFields
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

  function handlePreview(option: RecordOption, event: React.MouseEvent) {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current)
    }

    previewTimeoutRef.current = setTimeout(() => {
      setPreviewRecord(option)
      setPreviewPosition({ x: event.clientX + 10, y: event.clientY + 10 })
    }, 300)
  }

  function handlePreviewLeave() {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current)
    }
    previewTimeoutRef.current = setTimeout(() => {
      setPreviewRecord(null)
      setPreviewPosition(null)
    }, 200)
  }

  // Get selected options
  const selectedOptions = options.filter(opt => selectedIds.includes(opt.id))

  // Filter out selected options from dropdown (unless multi-select and showing all)
  const availableOptions = isMultiSelect 
    ? options 
    : options.filter(opt => !selectedIds.includes(opt.id))

  return (
    <div className="space-y-2" ref={containerRef}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div
            className={cn(
              "min-h-[38px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
              "flex flex-wrap items-center gap-2 cursor-pointer",
              "hover:border-ring focus-within:border-ring focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => !disabled && setOpen(true)}
          >
            {selectedOptions.length > 0 ? (
              <>
                {selectedOptions.map((option) => (
                  <Badge
                    key={option.id}
                    variant="secondary"
                    className="flex items-center gap-1 pr-1"
                  >
                    <span className="font-medium">{option.primaryLabel}</span>
                    {!disabled && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemove(option.id)
                        }}
                        className="ml-1 rounded-full hover:bg-background/80 p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
                {isMultiSelect && (
                  <span className="text-muted-foreground text-xs">
                    {selectedOptions.length} selected
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
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
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : availableOptions.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
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
                        "px-3 py-2 cursor-pointer hover:bg-accent transition-colors",
                        isSelected && "bg-accent"
                      )}
                      onClick={() => handleSelect(option)}
                      onMouseEnter={(e) => handlePreview(option, e)}
                      onMouseLeave={handlePreviewLeave}
                    >
                      <div className="font-medium text-sm">{option.primaryLabel}</div>
                      {option.secondaryLabels && option.secondaryLabels.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {option.secondaryLabels.join(" • ")}
                        </div>
                      )}
                    </div>
                  )
                })}
                
                {config?.allowCreate && onCreateRecord && (
                  <div
                    className="px-3 py-2 border-t cursor-pointer hover:bg-accent transition-colors flex items-center gap-2 text-sm text-muted-foreground"
                    onClick={handleCreateNew}
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create new record</span>
                  </div>
                )}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Preview Card */}
      {previewRecord && previewPosition && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: `${previewPosition.x}px`,
            top: `${previewPosition.y}px`,
          }}
        >
          <Card className="w-64 shadow-lg">
            <CardContent className="p-3">
              <div className="font-medium text-sm mb-2">{previewRecord.primaryLabel}</div>
              {previewRecord.secondaryLabels && previewRecord.secondaryLabels.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-1">
                  {previewRecord.secondaryLabels.map((label, idx) => (
                    <div key={idx}>{label}</div>
                  ))}
                </div>
              )}
              {onRecordClick && (
                <button
                  className="mt-2 text-xs text-primary hover:underline"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRecordClick(lookupTableId!, previewRecord.id)
                  }}
                >
                  View record →
                </button>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

