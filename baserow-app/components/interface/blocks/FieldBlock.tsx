"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { PageBlock } from "@/lib/interface/types"
import type { TableField } from "@/types/fields"
import { Paperclip } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import AttachmentPreview, { type Attachment } from "@/components/attachments/AttachmentPreview"
import InlineFieldEditor from "@/components/records/InlineFieldEditor"
import { resolveSystemFieldAlias } from "@/lib/fields/systemFieldAliases"
import RecordModal from "@/components/calendar/RecordModal"
import { isAbortError } from "@/lib/api/error-handling"
import { FIELD_LABEL_CLASS_NO_MARGIN, FIELD_LABEL_GAP_CLASS } from "@/lib/fields/field-label"
import { getFieldDisplayName } from "@/lib/fields/display"

interface FieldBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null
  recordId?: string | null // Record ID from page context (required for field blocks)
  pageShowFieldNames?: boolean // Page-level: show field names on blocks (default true)
  hideEditButton?: boolean // Hide Edit button for top fields (inline editing only)
}

/**
 * FieldBlock - Displays a field label + value from a record
 * 
 * REQUIREMENTS:
 * - Must receive recordId from page context (Record Review pages)
 * - Displays field label + formatted value
 * - Shows setup state if field_id or recordId missing
 * - No editing capability (fields are edited via grid/form)
 */
export default function FieldBlock({ 
  block, 
  isEditing = false, 
  pageTableId = null,
  recordId = null,
  pageShowFieldNames = true,
  hideEditButton = false
}: FieldBlockProps) {
  const { config } = block
  const fieldId = config?.field_id
  const [field, setField] = useState<TableField | null>(null)
  const [fieldValue, setFieldValue] = useState<any>(null)
  const [isEditingValue, setIsEditingValue] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tableName, setTableName] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'admin' | 'member' | null>(null)
  const [canEditInline, setCanEditInline] = useState(false)
  const [createRecordModalOpen, setCreateRecordModalOpen] = useState(false)
  const [createRecordTableId, setCreateRecordTableId] = useState<string | null>(null)
  const [createRecordTableFields, setCreateRecordTableFields] = useState<any[]>([])
  const [createRecordResolve, setCreateRecordResolve] = useState<((id: string | null) => void) | null>(null)
  const { toast } = useToast()

  const allowInlineEdit = config?.allow_inline_edit || false
  const editPermission = config?.inline_edit_permission || 'both'

  // Handle creating new linked records
  const handleCreateLinkedRecord = useCallback(async (tableId: string): Promise<string | null> => {
    if (!tableId) return null
    
    return new Promise((resolve) => {
      const supabase = createClient()
      
      // Fetch table fields for the modal
      supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", tableId)
        .order("position", { ascending: true })
        .then(({ data: fields, error }) => {
          if (error) {
            console.error("[FieldBlock] Error loading table fields:", error)
            toast({
              title: "Failed to load fields",
              description: error.message || "Please try again",
              variant: "destructive",
            })
            resolve(null)
            return
          }

          // Store the resolve function and open modal
          setCreateRecordResolve(() => resolve)
          setCreateRecordTableId(tableId)
          setCreateRecordTableFields(fields || [])
          setCreateRecordModalOpen(true)
        })
    })
  }, [toast])

  // Handle modal save - called when RecordModal saves successfully
  const handleModalSave = useCallback((createdRecordId?: string | null) => {
    if (createRecordResolve) {
      createRecordResolve(createdRecordId || null)
      setCreateRecordResolve(null)
    }
    setCreateRecordModalOpen(false)
    setCreateRecordTableId(null)
    setCreateRecordTableFields([])
  }, [createRecordResolve])

  // Handle modal close - called when RecordModal is closed without saving
  const handleModalClose = useCallback(() => {
    if (createRecordResolve) {
      createRecordResolve(null)
      setCreateRecordResolve(null)
    }
    setCreateRecordModalOpen(false)
    setCreateRecordTableId(null)
    setCreateRecordTableFields([])
  }, [createRecordResolve])

  // Wrapper for onAddLinkedRecord that extracts tableId from field
  const handleAddLinkedRecord = useCallback((field: TableField) => {
    const tableId = field.options?.linked_table_id || field.options?.lookup_table_id
    if (tableId) {
      handleCreateLinkedRecord(tableId)
    }
  }, [handleCreateLinkedRecord])

  // Load user role (only if field is configured)
  useEffect(() => {
    if (fieldId) {
      loadUserRole()
    }
  }, [fieldId])

  // Determine if user can edit inline
  // Priority: allowInlineEdit from config (which includes page-level editability) > role-based permissions
  useEffect(() => {
    // If allowInlineEdit is explicitly false, disable editing
    if (allowInlineEdit === false) {
      setCanEditInline(false)
      return
    }
    
    // If allowInlineEdit is true, check role-based permissions (if configured)
    if (allowInlineEdit === true) {
      // If no user role loaded yet, wait (will be set to member by default)
      if (!userRole) {
        return
      }
      
      // If editPermission is 'both', allow editing for all roles
      // Otherwise, check role match
      const canEdit = 
        editPermission === 'both' ||
        (editPermission === 'admin' && userRole === 'admin') ||
        (editPermission === 'member' && userRole === 'member')
      
      setCanEditInline(canEdit)
      return
    }
    
    // Default: if allowInlineEdit is not explicitly set, disable editing
    setCanEditInline(false)
  }, [allowInlineEdit, editPermission, userRole, fieldId])

  async function loadUserRole() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setUserRole('member')
        return
      }
      
      // Try profiles table first (new system)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (!profileError && profile) {
        setUserRole(profile.role as 'admin' | 'member')
        return
      }
      
      // Fallback to user_roles table (legacy support)
      if (profileError?.code === 'PGRST116' || profileError?.message?.includes('relation') || profileError?.message?.includes('does not exist')) {
        const { data: legacyRole, error: legacyError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle()
        
        if (!legacyError && legacyRole) {
          // Map legacy roles: admin/editor -> admin, viewer -> member
          setUserRole(legacyRole.role === 'admin' || legacyRole.role === 'editor' ? 'admin' : 'member')
          return
        }
      }
      
      // Default to member if no profile found
      setUserRole('member')
    } catch (error) {
      // Ignore abort errors (expected during rapid navigation/unmount)
      if (!isAbortError(error)) {
        console.error("Error loading user role:", error)
      }
      setUserRole('member')
    }
  }

  // Load table name and field info
  useEffect(() => {
    if (pageTableId && fieldId) {
      loadFieldInfo()
    }
  }, [pageTableId, fieldId])

  // Load record value when recordId changes
  useEffect(() => {
    if (recordId && tableName && field) {
      loadFieldValue()
    } else {
      setFieldValue(null)
    }
  }, [recordId, tableName, field])

  async function loadFieldInfo() {
    if (!pageTableId || !fieldId) return

    setLoading(true)
    try {
      const supabase = createClient()
      
      // Load table name
      const { data: table } = await supabase
        .from("tables")
        .select("supabase_table")
        .eq("id", pageTableId)
        .single()

      if (table?.supabase_table) {
        setTableName(table.supabase_table)
      }

      // Load field definition
      const { data: fieldData } = await supabase
        .from("table_fields")
        .select("*")
        .eq("id", fieldId)
        .eq("table_id", pageTableId)
        .single()

      if (fieldData) {
        setField(fieldData as TableField)
      }
    } catch (error) {
      // Ignore abort errors (expected during rapid navigation/unmount)
      if (!isAbortError(error)) {
        console.error("Error loading field info:", error)
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadFieldValue() {
    if (!recordId || !tableName || !field) return

    setLoading(true)
    try {
      const supabase = createClient()
      
      // LOOKUP FIELDS: Compute value from linked field
      if (field.type === 'lookup') {
        const lookupFieldId = field.options?.lookup_field_id
        const lookupTableId = field.options?.lookup_table_id
        const lookupResultFieldId = field.options?.lookup_result_field_id
        
        if (!lookupFieldId || !lookupTableId || !lookupResultFieldId) {
          console.warn("[FieldBlock] Lookup field missing required configuration")
          setFieldValue(null)
          return
        }
        
        // Get the linked field definition to find its name
        const { data: linkedFieldData } = await supabase
          .from("table_fields")
          .select("name")
          .eq("id", lookupFieldId)
          .eq("table_id", pageTableId)
          .single()
        
        if (!linkedFieldData) {
          console.warn("[FieldBlock] Linked field not found:", lookupFieldId)
          setFieldValue(null)
          return
        }
        
        // Get the current record to read the linked field value
        const { data: currentRecord, error: recordError } = await supabase
          .from(tableName)
          .select("*")
          .eq("id", recordId)
          .single()
        
        if (recordError || !currentRecord) {
          console.error("[FieldBlock] Error loading current record:", recordError)
          setFieldValue(null)
          return
        }
        
        // Get the linked record ID(s) from the linked field
        const linkedFieldName = linkedFieldData.name
        const linkedRecordIds = currentRecord[linkedFieldName]
        
        if (!linkedRecordIds) {
          setFieldValue(null)
          return
        }
        
        // Normalize to array (single link is string, multi-link is array)
        const ids = Array.isArray(linkedRecordIds) ? linkedRecordIds : [linkedRecordIds]
        const validIds = ids.filter(id => id && typeof id === 'string')
        
        if (validIds.length === 0) {
          setFieldValue(null)
          return
        }
        
        // Get lookup table info
        const { data: lookupTable, error: tableError } = await supabase
          .from("tables")
          .select("supabase_table")
          .eq("id", lookupTableId)
          .single()
        
        if (tableError || !lookupTable) {
          console.error("[FieldBlock] Lookup table not found:", tableError)
          setFieldValue(null)
          return
        }
        
        // Get the lookup result field definition to find its name
        const { data: resultFieldData } = await supabase
          .from("table_fields")
          .select("name")
          .eq("id", lookupResultFieldId)
          .eq("table_id", lookupTableId)
          .single()
        
        if (!resultFieldData) {
          console.warn("[FieldBlock] Lookup result field not found:", lookupResultFieldId)
          setFieldValue(null)
          return
        }
        
        // Fetch the lookup result field value from linked records
        const resultFieldName = resultFieldData.name
        const { data: lookupRecords, error: lookupError } = await supabase
          .from(lookupTable.supabase_table)
          .select(`id, ${resultFieldName}`)
          .in("id", validIds)
        
        if (lookupError || !lookupRecords) {
          console.error("[FieldBlock] Error fetching lookup records:", lookupError)
          setFieldValue(null)
          return
        }
        
        // Extract values from lookup records
        // For single-link, return single value; for multi-link, return array
        const values = lookupRecords.map((r: any) => r[resultFieldName]).filter((v: any) => v != null)
        
        if (values.length === 0) {
          setFieldValue(null)
        } else if (Array.isArray(linkedRecordIds)) {
          // Multi-link: return array of values
          setFieldValue(values)
        } else {
          // Single link: return first value
          setFieldValue(values[0])
        }
        
        return
      }
      
      // REGULAR FIELDS: Read directly from table
      // IMPORTANT:
      // - Some "system" fields can exist in `table_fields` but not as physical columns
      //   on the dynamic data table. Selecting a missing column causes a PostgREST 400.
      // - Fetch the single row with `*` and then read the desired key (or alias) locally.
      const { data, error } = await supabase.from(tableName).select("*").eq("id", recordId).single()

      if (error) throw error
      if (data) {
        const row = data as Record<string, any>
        const alias = resolveSystemFieldAlias(field.name)
        const value =
          row[field.name] ??
          (alias ? row[alias] : undefined) ??
          null
        setFieldValue(value)
      }
    } catch (error) {
      // Ignore abort errors (expected during rapid navigation/unmount)
      if (!isAbortError(error)) {
        console.error("Error loading field value:", error)
      }
      setFieldValue(null)
    } finally {
      setLoading(false)
    }
  }

  // Setup state: Missing field_id
  if (!fieldId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-2">{isEditing ? "This block requires a field." : "No field configured"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Configure the field in block settings.</p>
          )}
        </div>
      </div>
    )
  }

  // Setup state: Missing recordId
  // In edit mode, show field name preview if field is loaded
  if (!recordId) {
    if (isEditing && field) {
      // Show field name preview in edit mode
      return (
        <div className="h-full flex flex-col p-4">
          <label className={cn(FIELD_LABEL_CLASS_NO_MARGIN, "flex-shrink-0")}>
            {getFieldDisplayName(field)}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <div className="flex-1 text-sm text-gray-400 italic border border-dashed border-gray-300 rounded p-3 flex items-center">
            <span>Field value will appear here when a record is selected</span>
          </div>
        </div>
      )
    }
    
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-2">No record selected</p>
          <p className="text-xs text-gray-400">Select a record to see field value</p>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading || !field) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto mb-2" />
          <p className="text-xs">Loading field...</p>
        </div>
      </div>
    )
  }

  const isEditable = canEditInline && !isEditing && !!field
  const showLabel = (pageShowFieldNames !== false) && (config?.appearance?.showTitle !== false) // Page and block both allow showing label
  const linkedFieldDisplayModeRaw = config?.appearance?.linked_field_display_mode || 'compact'
  const linkedFieldDisplayMode: 'compact' | 'inline' | 'expanded' | 'list' =
    (linkedFieldDisplayModeRaw === 'list' || linkedFieldDisplayModeRaw === 'inline' || linkedFieldDisplayModeRaw === 'expanded' || linkedFieldDisplayModeRaw === 'compact')
      ? linkedFieldDisplayModeRaw
      : 'compact'

  // Handle attachment fields specially
  const isAttachmentField = field?.type === 'attachment'
  const attachments: Attachment[] = isAttachmentField && fieldValue 
    ? (Array.isArray(fieldValue) ? fieldValue : [fieldValue])
    : []

  async function handleCommit(newValue: any) {
    if (!recordId || !tableName || !field) {
      setIsEditingValue(false)
      return
    }

    // Guard: system/virtual fields are read-only in record blocks.
    if (field.options?.system || field.type === "formula" || field.type === "lookup") {
      setIsEditingValue(false)
      toast({
        variant: "destructive",
        title: "Read-only field",
        description: "This field cannot be edited here.",
      })
      return
    }

    // No-op if unchanged
    if (newValue === fieldValue) {
      setIsEditingValue(false)
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from(tableName)
        .update({ [field.name]: newValue })
        .eq("id", recordId)

      if (error) throw error

      setFieldValue(newValue)
    } catch (error: any) {
      console.error("Error updating field value:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update field",
      })
    } finally {
      setIsEditingValue(false)
    }
  }

  const content = isAttachmentField ? (
    isEditable ? (
      <InlineFieldEditor
        field={field}
        value={fieldValue}
        onChange={handleCommit}
        isEditing={isEditingValue}
        onEditStart={() => {
          setIsEditingValue(true)
        }}
        onEditEnd={() => setIsEditingValue(false)}
        onLinkedRecordClick={(linkedTableId, linkedRecordId) => {
          // Never open the current record (self-link edge case)
          if (pageTableId && recordId && linkedTableId === pageTableId && linkedRecordId === recordId) {
            return
          }
          window.location.href = `/tables/${linkedTableId}/records/${linkedRecordId}`
        }}
        onAddLinkedRecord={handleAddLinkedRecord}
        isReadOnly={false}
        showLabel={false}
        tableId={pageTableId || undefined}
        recordId={recordId || undefined}
        tableName={tableName || undefined}
        displayMode={linkedFieldDisplayMode}
      />
    ) : (
      <div className="flex-1">
        {attachments.length > 0 ? (
          <AttachmentPreview
            attachments={attachments}
            maxVisible={
              (config?.appearance as any)?.attachment_max_visible ||
              field.options?.attachment_max_visible ||
              10
            }
            size={
              (config?.appearance as any)?.attachment_size ||
              field.options?.attachment_preview_size ||
              "medium"
            }
            displayStyle={
              (config?.appearance as any)?.attachment_display_style ||
              field.options?.attachment_display_style ||
              "thumbnails"
            }
          />
        ) : (
          <div className="px-3 py-2 bg-gray-50/50 border border-gray-200/50 rounded-md text-sm text-gray-400 italic flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            No attachments
          </div>
        )}
      </div>
    )
  ) : (
    <InlineFieldEditor
      field={field}
      value={fieldValue}
      onChange={handleCommit}
      isEditing={isEditable && isEditingValue}
      onEditStart={() => {
        if (!isEditable) return
        setIsEditingValue(true)
      }}
      onEditEnd={() => setIsEditingValue(false)}
      onLinkedRecordClick={(linkedTableId, linkedRecordId) => {
        // Never open the current record (self-link edge case)
        if (pageTableId && recordId && linkedTableId === pageTableId && linkedRecordId === recordId) {
          return
        }
        window.location.href = `/tables/${linkedTableId}/records/${linkedRecordId}`
      }}
      onAddLinkedRecord={handleAddLinkedRecord}
      isReadOnly={!isEditable}
      showLabel={false}
      displayMode={linkedFieldDisplayMode}
    />
  )

  return (
    <>
      <div className={cn("h-full p-3 flex flex-col min-h-0", FIELD_LABEL_GAP_CLASS)}>
        {showLabel ? (
          <>
            <label className={cn(FIELD_LABEL_CLASS_NO_MARGIN, "flex-shrink-0")}>
              {getFieldDisplayName(field)}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="flex-1 min-h-0 min-w-0">{content}</div>
          </>
        ) : (
          <div className="flex-1 min-h-0 min-w-0">{content}</div>
        )}
      </div>
      
      {/* Record creation modal */}
      {createRecordTableId && (
        <RecordModal
          open={createRecordModalOpen}
          onClose={handleModalClose}
          tableId={createRecordTableId}
          recordId={null}
          tableFields={createRecordTableFields}
          onSave={handleModalSave}
        />
      )}
    </>
  )
}

