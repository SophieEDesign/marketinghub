"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { formatDateUK, cn } from "@/lib/utils"
import type { PageBlock } from "@/lib/interface/types"
import type { TableField } from "@/types/fields"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Save, X } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface FieldBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null
  recordId?: string | null // Record ID from page context (required for field blocks)
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
  recordId = null 
}: FieldBlockProps) {
  const { config } = block
  const fieldId = config?.field_id
  const [field, setField] = useState<TableField | null>(null)
  const [fieldValue, setFieldValue] = useState<any>(null)
  const [editingValue, setEditingValue] = useState<any>(null)
  const [isEditingValue, setIsEditingValue] = useState(false)
  const [saving, setSaving] = useState(false)
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
      setEditingValue(null)
    }
  }, [recordId, tableName, field])

  // Reset editing state when field value changes (but not when actively editing)
  useEffect(() => {
    if (!isEditingValue && fieldValue !== undefined) {
      setEditingValue(fieldValue)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldValue])

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

  // Format field value based on type
  const formatValue = (value: any, fieldType: string, options?: any): string => {
    if (value === null || value === undefined) return "—"

    switch (fieldType) {
      case 'checkbox':
        return value ? '✓' : '✗'
      case 'date':
        // Use UK date format (DD/MM/YYYY)
        return formatDateUK(String(value), "—")
      case 'currency':
        const currencySymbol = options?.currency_symbol || '$'
        const precision = options?.precision ?? 2
        return `${currencySymbol}${Number(value).toFixed(precision)}`
      case 'percent':
        const percentPrecision = options?.precision ?? 2
        return `${Number(value).toFixed(percentPrecision)}%`
      case 'number':
        const numPrecision = options?.precision ?? 2
        return Number(value).toFixed(numPrecision)
      case 'single_select':
      case 'multi_select':
        if (Array.isArray(value)) {
          return value.join(', ')
        }
        return String(value)
      case 'link_to_table':
        // For linked records, show count or ID
        if (Array.isArray(value)) {
          return `${value.length} linked record${value.length !== 1 ? 's' : ''}`
        }
        return value ? 'Linked' : '—'
      default:
        return String(value)
    }
  }

  async function handleSaveValue() {
    if (!recordId || !tableName || !field || editingValue === fieldValue) {
      setIsEditingValue(false)
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      const updateData: Record<string, any> = {
        [field.name]: editingValue
      }

      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq("id", recordId)

      if (error) throw error

      // Reload field value
      await loadFieldValue()
      setIsEditingValue(false)
      
      toast({
        title: "Saved",
        description: "Field value updated successfully",
      })
    } catch (error: any) {
      console.error("Error saving field value:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save field value",
      })
    } finally {
      setSaving(false)
    }
  }

  function handleCancelEdit() {
    setEditingValue(fieldValue)
    setIsEditingValue(false)
  }

  function handleStartEdit() {
    setEditingValue(fieldValue)
    setIsEditingValue(true)
  }

  const displayValue = field ? formatValue(fieldValue, field.type, field.options) : "—"
  const isEditable = canEditInline && !isEditing && field // Can't edit when in block edit mode or if field not loaded

  return (
    <div className="h-full flex flex-col p-4">
      {/* Field Label */}
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          {field.name}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {isEditable && !isEditingValue && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStartEdit}
            className="h-6 px-2 text-xs"
          >
            Edit
          </Button>
        )}
      </div>
      
      {/* Field Value - Editable or Display */}
      {isEditable && isEditingValue ? (
        <div className="flex-1 space-y-2">
          {renderEditableField()}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSaveValue}
              disabled={saving}
              className="h-7"
            >
              <Save className="h-3 w-3 mr-1" />
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancelEdit}
              disabled={saving}
              className="h-7"
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div 
          className={cn(
            "flex-1 text-sm text-gray-900",
            field.type === 'long_text' && "whitespace-pre-wrap",
            field.type === 'checkbox' && "text-lg",
            isEditable && "cursor-pointer hover:bg-gray-50 rounded p-1 -m-1",
            isEditable && !isEditingValue && "transition-colors"
          )}
          onClick={isEditable && !isEditingValue ? handleStartEdit : undefined}
          title={isEditable && !isEditingValue ? "Click to edit" : undefined}
        >
          {displayValue}
        </div>
      )}
    </div>
  )

  function renderEditableField() {
    if (!field) return null

    switch (field.type) {
      case 'text':
      case 'number':
      case 'currency':
      case 'percent':
        return (
          <Input
            type={field.type === 'number' ? 'number' : 'text'}
            value={editingValue ?? ''}
            onChange={(e) => {
              const value = field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
              setEditingValue(value)
            }}
            placeholder={field.required ? "Required" : "Enter value"}
            className="w-full"
          />
        )
      
      case 'long_text':
        return (
          <Textarea
            value={editingValue ?? ''}
            onChange={(e) => setEditingValue(e.target.value)}
            placeholder={field.required ? "Required" : "Enter text"}
            className="w-full min-h-[100px]"
          />
        )
      
      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`field-${field.id}`}
              checked={editingValue === true}
              onCheckedChange={(checked) => setEditingValue(checked === true)}
            />
            <label
              htmlFor={`field-${field.id}`}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {editingValue ? "Checked" : "Unchecked"}
            </label>
          </div>
        )
      
      case 'date':
        return (
          <Input
            type="date"
            value={editingValue ? new Date(editingValue).toISOString().split('T')[0] : ''}
            onChange={(e) => {
              const dateValue = e.target.value ? new Date(e.target.value).toISOString() : null
              setEditingValue(dateValue)
            }}
            className="w-full"
          />
        )
      
      default:
        return (
          <Input
            type="text"
            value={editingValue ?? ''}
            onChange={(e) => setEditingValue(e.target.value)}
            placeholder={field.required ? "Required" : "Enter value"}
            className="w-full"
          />
        )
    }
  }
}

