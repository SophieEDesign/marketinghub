"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { PageBlock } from "@/lib/interface/types"
import type { TableField } from "@/types/fields"
import { Paperclip } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import AttachmentPreview, { type Attachment } from "@/components/attachments/AttachmentPreview"
import InlineFieldEditor from "@/components/records/InlineFieldEditor"

interface FieldBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null
  recordId?: string | null // Record ID from page context (required for field blocks)
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
  const { toast } = useToast()

  const allowInlineEdit = config?.allow_inline_edit || false
  const editPermission = config?.inline_edit_permission || 'both'

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
      console.error("Error loading user role:", error)
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
      console.error("Error loading field info:", error)
    } finally {
      setLoading(false)
    }
  }

  async function loadFieldValue() {
    if (!recordId || !tableName || !field) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from(tableName)
        .select(field.name)
        .eq("id", recordId)
        .single()

      if (error) throw error
      if (data) {
        // Type assertion needed because Supabase returns dynamic field names
        setFieldValue((data as Record<string, any>)[field.name])
      }
    } catch (error) {
      console.error("Error loading field value:", error)
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {field.name}
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
  const showLabel = config?.appearance?.showTitle !== false // Default to true if not set

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
    <div className="flex-1">
      {attachments.length > 0 ? (
        <AttachmentPreview
          attachments={attachments}
          maxVisible={10}
          size={(config?.appearance as any)?.attachment_size || "medium"}
          displayStyle={
            field.options?.attachment_display_style ||
            (config?.appearance as any)?.attachment_display_style ||
            "thumbnails"
          }
        />
      ) : (
        <div className="px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/50 rounded-md text-sm text-gray-400 italic flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          No attachments
        </div>
      )}
    </div>
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
        window.location.href = `/tables/${linkedTableId}/records/${linkedRecordId}`
      }}
      onAddLinkedRecord={() => {
        toast({
          title: "Not implemented",
          description: "Adding linked records is not available here yet.",
        })
      }}
      isReadOnly={!isEditable}
      showLabel={false}
    />
  )

  return (
    <div className="h-full p-4">
      {showLabel ? (
        <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-x-6 items-start">
          <div className="pt-2 text-xs font-medium text-gray-500">
            {field.name}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </div>
          <div className="min-w-0">{content}</div>
        </div>
      ) : (
        content
      )}
    </div>
  )
}

