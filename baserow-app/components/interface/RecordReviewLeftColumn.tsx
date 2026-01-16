"use client"

/**
 * Record Review Left Column (Fixed Structural UI)
 * 
 * This is NOT a block - it's a fixed structural component that:
 * - Shows record list/table
 * - Provides search, filter, sort
 * - Manages field visibility settings
 * - Handles record selection (sets recordId in UI state)
 * 
 * The left column is always present, regardless of edit/view mode.
 * It's not draggable, not part of the canvas blocks.
 */

import { useState, useEffect, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import { Plus, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import CreateRecordModal from "@/components/records/CreateRecordModal"
import { useToast } from "@/components/ui/use-toast"
import { formatDateUK } from "@/lib/utils"
import { resolveChoiceColor, normalizeHexColor, getTextColorForBackground } from "@/lib/field-colors"
import { useUserRole } from "@/lib/hooks/useUserRole"
import { canCreateRecord } from "@/lib/interface/record-actions"

interface RecordReviewLeftColumnProps {
  pageId?: string
  tableId: string | null // From page.settings.tableId
  selectedRecordId: string | null
  onRecordSelect: (recordId: string) => void
  showAddRecord?: boolean
  pageConfig?: any
  leftPanelSettings?: {
    // For record_review pages: full field list
    visibleFieldIds?: string[]
    fieldOrder?: string[]
    showLabels?: boolean
    compact?: boolean
    // For record_view pages: simplified 3-field configuration
    titleFieldId?: string | null
    subtitleFieldId?: string | null
    additionalFieldId?: string | null
    // Backward compatibility: support old field name format (snake_case)
    title_field?: string | null
    field_1?: string | null
    field_2?: string | null
  }
  pageType?: 'record_view' | 'record_review' // To determine which settings format to use
}

export default function RecordReviewLeftColumn({
  pageId,
  tableId,
  selectedRecordId,
  onRecordSelect,
  showAddRecord = false,
  pageConfig,
  leftPanelSettings,
  pageType = 'record_review', // Default to record_review for backward compatibility
}: RecordReviewLeftColumnProps) {
  const { toast } = useToast()
  const { role: userRole } = useUserRole()
  const [records, setRecords] = useState<any[]>([])
  const [fields, setFields] = useState<TableField[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [tableName, setTableName] = useState<string | null>(null)
  const [supabaseTableName, setSupabaseTableName] = useState<string | null>(null)
  
  // Get settings based on page type
  const isRecordView = pageType === 'record_view'
  const isRecordReview = pageType === 'record_review'
  
  // For record_review: full field list configuration
  const visibleFieldIds = isRecordReview ? (leftPanelSettings?.visibleFieldIds || []) : []
  const fieldOrder = isRecordReview ? (leftPanelSettings?.fieldOrder || []) : []
  const showLabels = isRecordReview ? (leftPanelSettings?.showLabels ?? true) : false
  const compact = isRecordReview ? (leftPanelSettings?.compact ?? false) : false
  
  // For record_view: simplified 3-field configuration
  // CRITICAL: RecordViewPageSettings saves field names (title_field, field_1, field_2), not IDs
  // Support both field names and field IDs for backward compatibility
  const titleFieldNameOrId = isRecordView ? (
    leftPanelSettings?.title_field || 
    leftPanelSettings?.titleFieldId || 
    null
  ) : null
  const subtitleFieldNameOrId = isRecordView ? (
    leftPanelSettings?.field_1 || 
    leftPanelSettings?.subtitleFieldId || 
    null
  ) : null
  const additionalFieldNameOrId = isRecordView ? (
    leftPanelSettings?.field_2 || 
    leftPanelSettings?.additionalFieldId || 
    null
  ) : null
  
  // Convert field names to field IDs once fields are loaded
  const titleFieldId = useMemo(() => {
    if (!titleFieldNameOrId || fields.length === 0) return null
    // Check if it's already an ID (UUID format) or a field name
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(titleFieldNameOrId)
    if (isUUID) return titleFieldNameOrId
    // It's a field name, find the field ID
    const field = fields.find(f => f.name === titleFieldNameOrId)
    return field?.id || null
  }, [titleFieldNameOrId, fields])
  
  const subtitleFieldId = useMemo(() => {
    if (!subtitleFieldNameOrId || fields.length === 0) return null
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subtitleFieldNameOrId)
    if (isUUID) return subtitleFieldNameOrId
    const field = fields.find(f => f.name === subtitleFieldNameOrId)
    return field?.id || null
  }, [subtitleFieldNameOrId, fields])
  
  const additionalFieldId = useMemo(() => {
    if (!additionalFieldNameOrId || fields.length === 0) return null
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(additionalFieldNameOrId)
    if (isUUID) return additionalFieldNameOrId
    const field = fields.find(f => f.name === additionalFieldNameOrId)
    return field?.id || null
  }, [additionalFieldNameOrId, fields])

  const primaryCreateField = useMemo(() => {
    if (!isRecordView || !titleFieldId) return null
    return fields.find((f) => f.id === titleFieldId) ?? null
  }, [fields, isRecordView, titleFieldId])

  const canPrefillPrimaryCreateField =
    primaryCreateField?.type === "text" ||
    primaryCreateField?.type === "long_text" ||
    primaryCreateField?.type === "email" ||
    primaryCreateField?.type === "url"

  // Load table name and fields
  useEffect(() => {
    if (!tableId) return

    async function loadTableInfo() {
      const supabase = createClient()
      
      // Load table name
      const { data: table } = await supabase
        .from("tables")
        .select("name, supabase_table")
        .eq("id", tableId)
        .single()

      if (table) {
        setTableName(table.name)
        setSupabaseTableName(table.supabase_table || null)
        
        // Load fields
        const { data: tableFields } = await supabase
          .from("table_fields")
          .select("*")
          .eq("table_id", tableId)
          .order("order_index", { ascending: true })

        if (tableFields) {
          setFields(tableFields as TableField[])
        }

        // Load records
        await loadRecords(table.supabase_table)
      }
    }

    loadTableInfo()
  }, [tableId])

  const loadRecords = useCallback(async (supabaseTableName: string, searchOverride?: string) => {
    if (!supabaseTableName) return

    setLoading(true)
    try {
      const supabase = createClient()
      let query = supabase.from(supabaseTableName).select("*").limit(100)

      // Apply search filter
      const effectiveSearch = (searchOverride ?? searchQuery).trim()
      if (effectiveSearch) {
        // Simple search - can be enhanced
        query = query.or(`name.ilike.%${effectiveSearch}%,id.ilike.%${effectiveSearch}%`)
      }

      const { data, error } = await query

      if (error) {
        console.error("Error loading records:", error)
      } else {
        setRecords(data || [])
      }
    } catch (error) {
      console.error("Error loading records:", error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery])

  useEffect(() => {
    if (tableId) {
      const supabase = createClient()
      supabase
        .from("tables")
        .select("supabase_table")
        .eq("id", tableId)
        .single()
        .then(({ data: table }) => {
          if (table?.supabase_table) {
            setSupabaseTableName(table.supabase_table)
            loadRecords(table.supabase_table)
          }
        })
    }
  }, [tableId, loadRecords])

  const handleOpenCreateModal = useCallback(() => {
    // Only enable this UX for record_view pages (requested)
    if (!isRecordView) return
    if (!showAddRecord || !supabaseTableName || creating) return
    if (!canCreateRecord(userRole, pageConfig)) {
      toast({
        variant: "destructive",
        title: "Not allowed",
        description: "You don't have permission to create records on this page.",
      })
      return
    }
    setCreateModalOpen(true)
  }, [creating, isRecordView, pageConfig, showAddRecord, supabaseTableName, toast, userRole])

  const handleCreateRecord = useCallback(async (primaryValue: string) => {
    if (!isRecordView) return
    if (!showAddRecord || !supabaseTableName || creating) return
    if (!canCreateRecord(userRole, pageConfig)) {
      throw new Error("You don't have permission to create records on this page.")
    }

    setCreating(true)
    try {
      if (!pageId) {
        throw new Error('Missing page ID for create action.')
      }

      const fieldName =
        canPrefillPrimaryCreateField && primaryCreateField?.name ? primaryCreateField.name : null
      const fieldValue = fieldName ? primaryValue?.trim() : null

      const res = await fetch(`/api/interface-pages/${pageId}/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldName: fieldName || undefined,
          fieldValue: fieldValue || undefined,
        }),
      })

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to create record')
      }

      const createdId = payload?.recordId || payload?.record?.id
      if (!createdId) return

      // Ensure the newly created record is visible/selectable
      setSearchQuery("")
      await loadRecords(supabaseTableName, "")
      onRecordSelect(String(createdId))

      toast({
        title: "Record created",
        description: "Your new record has been created.",
      })
    } finally {
      setCreating(false)
    }
  }, [
    canPrefillPrimaryCreateField,
    creating,
    isRecordView,
    loadRecords,
    onRecordSelect,
    pageId,
    pageConfig,
    primaryCreateField?.name,
    showAddRecord,
    supabaseTableName,
    toast,
    userRole,
  ])

  // Auto-select first record when records are loaded and no record is selected
  useEffect(() => {
    if (records.length > 0 && !selectedRecordId && !loading) {
      const firstRecord = records[0]
      if (firstRecord?.id) {
        onRecordSelect(firstRecord.id)
      }
    }
  }, [records, selectedRecordId, loading, onRecordSelect])

  // Get ordered fields based on page settings
  const orderedFields = useMemo(() => {
    if (isRecordView) {
      // For record_view: return fields in order: title, subtitle, additional
      const titleField = titleFieldId ? fields.find(f => f.id === titleFieldId) : null
      const subtitleField = subtitleFieldId ? fields.find(f => f.id === subtitleFieldId) : null
      const additionalField = additionalFieldId ? fields.find(f => f.id === additionalFieldId) : null
      
      return [titleField, subtitleField, additionalField].filter((f): f is TableField => f !== null)
    } else {
      // For record_review: use fieldOrder or table field order
      if (fieldOrder.length > 0) {
        return fieldOrder
          .map(id => fields.find(f => f.id === id))
          .filter((f): f is TableField => f !== undefined)
          .concat(fields.filter(f => !fieldOrder.includes(f.id)))
      }
      return fields
    }
  }, [fields, fieldOrder, isRecordView, titleFieldId, subtitleFieldId, additionalFieldId])

  const renderValue = useCallback((field: TableField | null | undefined, value: any) => {
    if (!field) return <span className="text-gray-400">—</span>
    if (value === null || value === undefined || value === "") {
      return <span className="text-gray-400">—</span>
    }

    // Dates
    if (field.type === "date") {
      return <span>{formatDateUK(String(value), "—")}</span>
    }

    // Multi-select pills
    if (field.type === "multi_select") {
      const values = Array.isArray(value) ? value : [value]
      return (
        <div className="flex flex-wrap gap-1">
          {values.slice(0, 4).map((v: any, i: number) => {
            const normalizedColor = normalizeHexColor(
              resolveChoiceColor(String(v), "multi_select", field.options, false)
            )
            const textColor = getTextColorForBackground(normalizedColor)
            return (
              <Badge
                key={`${field.id}-${i}`}
                className={`text-[11px] font-medium ${textColor} border border-opacity-20`}
                style={{ backgroundColor: normalizedColor }}
              >
                {String(v)}
              </Badge>
            )
          })}
          {values.length > 4 && (
            <span className="text-[11px] text-gray-500">+{values.length - 4}</span>
          )}
        </div>
      )
    }

    // Single select pill
    if (field.type === "single_select") {
      const normalizedColor = normalizeHexColor(
        resolveChoiceColor(String(value), "single_select", field.options, true)
      )
      const textColor = getTextColorForBackground(normalizedColor)
      return (
        <Badge
          className={`text-[11px] font-medium ${textColor} border border-opacity-20`}
          style={{ backgroundColor: normalizedColor }}
        >
          {String(value)}
        </Badge>
      )
    }

    return <span>{String(value)}</span>
  }, [])

  if (!tableId) {
    return (
      <div className="w-80 border-r border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-500">No table selected</p>
      </div>
    )
  }

  return (
    <div className="w-80 border-r border-gray-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{tableName || "Records"}</h3>

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          {isRecordView && showAddRecord && canCreateRecord(userRole, pageConfig) && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={handleOpenCreateModal}
              disabled={creating || !supabaseTableName}
              aria-label="Add record"
              title={!supabaseTableName ? "No table configured" : "Add a new record"}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Create record modal (record_view only) */}
      {isRecordView && (
        <CreateRecordModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          tableName={tableName || undefined}
          primaryFieldLabel={canPrefillPrimaryCreateField ? primaryCreateField?.name : null}
          primaryFieldPlaceholder={
            canPrefillPrimaryCreateField && primaryCreateField?.name
              ? `Enter ${primaryCreateField.name}`
              : undefined
          }
          isSaving={creating}
          onCreate={handleCreateRecord}
        />
      )}

      {/* Record List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-sm text-gray-500">Loading records...</div>
        ) : records.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No records found</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {records.map((record) => {
              const isSelected = record.id === selectedRecordId
              
              if (isRecordView) {
                // For record_view: display title, subtitle, and additional field
                const titleField = titleFieldId ? (fields.find(f => f.id === titleFieldId) ?? null) : null
                const subtitleField = subtitleFieldId ? (fields.find(f => f.id === subtitleFieldId) ?? null) : null
                const additionalField = additionalFieldId ? (fields.find(f => f.id === additionalFieldId) ?? null) : null
                
                const titleValue = titleField ? (record[titleField.name] || "Untitled") : "Untitled"
                const subtitleValue = subtitleField ? record[subtitleField.name] : null
                const additionalValue = additionalField ? record[additionalField.name] : null

                return (
                  <button
                    key={record.id}
                    onClick={() => onRecordSelect(record.id)}
                    className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors ${
                      isSelected ? "bg-blue-50 border-l-4 border-blue-500" : ""
                    }`}
                  >
                    {/* Title */}
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {String(titleValue || "Untitled")}
                    </div>
                    
                    {/* Subtitle */}
                    {subtitleValue && (
                      <div className="mt-1 text-xs text-gray-600 truncate">
                        {renderValue(subtitleField, subtitleValue)}
                      </div>
                    )}
                    
                    {/* Additional Field */}
                    {additionalValue && (
                      <div className="mt-1 text-xs text-gray-500 truncate">
                        {renderValue(additionalField, additionalValue)}
                      </div>
                    )}
                  </button>
                )
              } else {
                // For record_review: use full field list configuration
                const displayFields = visibleFieldIds.length === 0
                  ? orderedFields
                  : orderedFields.filter(f => visibleFieldIds.includes(f.id))
                
                const displayField = displayFields[0]
                const displayValue = displayField 
                  ? record[displayField.name] || "Untitled"
                  : record.name || "Untitled"

                return (
                  <button
                    key={record.id}
                    onClick={() => onRecordSelect(record.id)}
                    className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors ${
                      isSelected ? "bg-blue-50 border-l-4 border-blue-500" : ""
                    } ${compact ? "py-2" : ""}`}
                  >
                    <div className={`font-medium text-gray-900 truncate ${compact ? "text-xs" : "text-sm"}`}>
                      {String(displayValue || "Untitled")}
                    </div>
                    {showLabels && displayField && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {displayField.name}
                      </div>
                    )}
                  </button>
                )
              }
            })}
          </div>
        )}
      </div>
    </div>
  )
}
