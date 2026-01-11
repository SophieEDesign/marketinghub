"use client"

/**
 * Related Records List Block
 * 
 * Displays a list of related records from a linked table.
 * Supports filters, different display modes, and clicking to open records.
 */

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { ChevronRight, Plus, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PageBlock, BlockFilter } from "@/lib/interface/types"
import { applyFiltersToQuery, type FilterConfig } from "@/lib/interface/filters"

interface RelatedRecordsListBlockProps {
  block: PageBlock
  isEditing?: boolean
  recordId?: string | null // Current record ID (for filtering related records)
  pageTableId?: string | null // Table ID from the page
  onRecordClick?: (recordId: string, tableId: string) => void // Callback when a record is clicked
}

type DisplayMode = "compact" | "table" | "cards"

export default function RelatedRecordsListBlock({
  block,
  isEditing = false,
  recordId = null,
  pageTableId = null,
}: RelatedRecordsListBlockProps) {
  const { toast } = useToast()
  const { config } = block
  
  // Configuration
  const relatedTableId = config?.table_id || config?.related_table_id || null
  const linkFieldName = config?.link_field_name || null // Field name in related table that links back
  const displayMode: DisplayMode = config?.display_mode || "compact"
  const filters: BlockFilter[] = Array.isArray(config?.filters) ? config.filters : []
  const title = config?.title || "Related Records"
  const allowCreate = config?.permissions?.allowInlineCreate ?? false
  const allowDelete = config?.permissions?.allowInlineDelete ?? false
  const allowOpenRecord = config?.permissions?.allowOpenRecord ?? true

  const [records, setRecords] = useState<any[]>([])
  const [fields, setFields] = useState<any[]>([])
  const [tableName, setTableName] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [supabaseTableName, setSupabaseTableName] = useState<string | null>(null)

  // Convert BlockFilter[] to FilterConfig[]
  const filterConfigs: FilterConfig[] = useMemo(() => {
    return filters.map((f) => ({
      field: f.field,
      operator: f.operator as any,
      value: f.value,
    }))
  }, [filters])

  // Load related records
  useEffect(() => {
    if (!relatedTableId) {
      setRecords([])
      return
    }

    async function loadRelatedRecords() {
      setLoading(true)
      try {
        const supabase = createClient()

        // Get table info
        const { data: table } = await supabase
          .from("tables")
          .select("name, supabase_table")
          .eq("id", relatedTableId)
          .single()

        if (!table) {
          setLoading(false)
          return
        }

        setTableName(table.name)
        setSupabaseTableName(table.supabase_table)

        // Load fields
        const { data: tableFields } = await supabase
          .from("table_fields")
          .select("*")
          .eq("table_id", relatedTableId)
          .order("order_index", { ascending: true })

        if (tableFields) {
          setFields(tableFields)
        }

        // Build query
        let query = supabase.from(table.supabase_table).select("*")

        // Apply link field filter if recordId and linkFieldName are provided
        if (recordId && linkFieldName) {
          // Use type assertion to avoid "excessively deep" type error with dynamic field names
          query = (query as any).eq(linkFieldName, recordId)
        }

        // Apply additional filters
        if (filterConfigs.length > 0) {
          query = applyFiltersToQuery(query, filterConfigs, tableFields || [])
        }

        // Execute query
        const { data, error } = await query.order("created_at", { ascending: false })

        if (error) throw error

        setRecords(data || [])
      } catch (error: any) {
        console.error("Error loading related records:", error)
        toast({
          title: "Failed to load related records",
          description: error.message || "Please try again",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    loadRelatedRecords()
  }, [relatedTableId, recordId, linkFieldName, filterConfigs, toast])

  // Handle record click
  const handleRecordClick = (clickedRecordId: string) => {
    if (!allowOpenRecord || !relatedTableId) return
    
    // Navigate to record view
    window.location.href = `/tables/${relatedTableId}/records/${clickedRecordId}`
  }

  // Handle create new record
  const handleCreateRecord = () => {
    if (!relatedTableId) return
    
    // Navigate to create record page or open modal
    toast({
      title: "Create record",
      description: "This will open a record creation form.",
    })
  }

  // Get display value for a field
  const getFieldValue = (record: any, fieldName: string): string => {
    const value = record[fieldName]
    if (value === null || value === undefined) return ""
    
    if (typeof value === "object") {
      return JSON.stringify(value)
    }
    
    return String(value)
  }

  // Get primary display field (first text field or first field)
  const primaryField = fields.find((f) => f.type === "text") || fields[0]
  const secondaryField = fields.find((f) => f.type === "text" && f.id !== primaryField?.id)

  if (loading) {
    return (
      <div className="p-4 border border-gray-200 rounded-lg">
        <div className="text-sm text-gray-500">Loading related records...</div>
      </div>
    )
  }

  if (!relatedTableId) {
    return (
      <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
        <div className="text-sm text-gray-500">
          {isEditing ? "Configure related table in block settings" : "No related table configured"}
        </div>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {tableName && (
            <p className="text-xs text-gray-500 mt-0.5">{tableName}</p>
          )}
        </div>
        {allowCreate && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleCreateRecord}
            className="h-7 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        )}
      </div>

      {/* Records List */}
      <div className="divide-y divide-gray-200">
        {records.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            No related records found
          </div>
        ) : (
          records.map((record) => {
            if (displayMode === "compact") {
              return (
                <div
                  key={record.id}
                  className="px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => handleRecordClick(record.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      {primaryField && (
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {getFieldValue(record, primaryField.name)}
                        </div>
                      )}
                      {secondaryField && (
                        <div className="text-xs text-gray-500 truncate mt-0.5">
                          {getFieldValue(record, secondaryField.name)}
                        </div>
                      )}
                    </div>
                    {allowOpenRecord && (
                      <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" />
                    )}
                  </div>
                </div>
              )
            } else if (displayMode === "table") {
              // Table view - show first few fields as columns
              const visibleFields = fields.slice(0, 4)
              
              return (
                <div
                  key={record.id}
                  className="px-4 py-2 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => handleRecordClick(record.id)}
                >
                  <div className="grid grid-cols-4 gap-4">
                    {visibleFields.map((field) => (
                      <div key={field.id} className="min-w-0">
                        <div className="text-xs text-gray-500 mb-0.5">{field.name}</div>
                        <div className="text-sm text-gray-900 truncate">
                          {getFieldValue(record, field.name)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            } else {
              // Cards view
              return (
                <div
                  key={record.id}
                  className="px-4 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => handleRecordClick(record.id)}
                >
                  <div className="space-y-2">
                    {fields.slice(0, 3).map((field) => (
                      <div key={field.id}>
                        <div className="text-xs text-gray-500 mb-0.5">{field.name}</div>
                        <div className="text-sm text-gray-900">
                          {getFieldValue(record, field.name)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }
          })
        )}
      </div>
    </div>
  )
}
