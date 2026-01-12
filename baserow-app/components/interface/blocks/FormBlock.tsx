"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock } from "@/lib/interface/types"
import type { TableField as FieldType } from "@/types/fields"
import { useToast } from "@/components/ui/use-toast"
import { canCreateRecords, canEditBlock } from "@/lib/interface/block-permissions"
import FieldEditor from "@/components/fields/FieldEditor"

interface FormBlockProps {
  block: PageBlock
  isEditing?: boolean
  onSubmit?: (data: Record<string, any>) => void
  pageTableId?: string | null // Table ID from the page
  pageId?: string | null // Page ID
}

export default function FormBlock({ block, isEditing = false, onSubmit, pageTableId = null, pageId = null }: FormBlockProps) {
  const { config } = block
  const { toast } = useToast()
  // Form block MUST have table_id configured - no fallback to page table
  const tableId = config?.table_id
  const formFieldsConfig = config?.form_fields || []
  const [allFields, setAllFields] = useState<FieldType[]>([])
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')

  // Check block permissions
  const canEdit = canEditBlock(config)
  const canCreate = canCreateRecords(config)
  const isViewOnly = !canEdit

  useEffect(() => {
    if (tableId) {
      loadFields()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId])

  async function loadFields() {
    if (!tableId) return

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", tableId)
        .order("position", { ascending: true })

      // If table_fields doesn't exist, just use empty array
      if (error) {
        const errorCode = error.code || ''
        const errorMessage = error.message || ''
        if (errorCode === '42P01' || 
            errorCode === 'PGRST116' || 
            errorCode === '404' ||
            errorMessage?.includes('relation') || 
            errorMessage?.includes('does not exist')) {
          console.warn('table_fields table may not exist, using empty fields array')
          setAllFields([])
          return
        }
        throw error
      }

      setAllFields((data || []) as FieldType[])
    } catch (error) {
      console.warn('Error loading fields for form block:', error)
      setAllFields([])
    }
  }

  // Get visible fields from config, sorted by order
  const visibleFields = formFieldsConfig
    .filter((ff: any) => ff.visible !== false)
    .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
    .map((ff: any) => {
      const field = allFields.find(f => f.id === ff.field_id || f.name === ff.field_name)
      return field ? { ...field, formConfig: ff } : null
    })
    .filter(Boolean) as (FieldType & { formConfig: any })[]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tableId) return

    // Check permissions
    if (isViewOnly || !canCreate) {
      setSubmitStatus('error')
      setErrorMessage('This form is view-only. You cannot submit data.')
      setTimeout(() => setSubmitStatus('idle'), 5000)
      return
    }

    // Validate required fields
    const missingRequired = visibleFields
      .filter(f => f.formConfig.required && !formData[f.name])
      .map(f => f.name)

    if (missingRequired.length > 0) {
      setSubmitStatus('error')
      setErrorMessage(`Please fill in required fields: ${missingRequired.join(', ')}`)
      setTimeout(() => setSubmitStatus('idle'), 5000)
      return
    }

    setLoading(true)
    setSubmitStatus('idle')
    setErrorMessage('')

    try {
      const supabase = createClient()
      
      // Get table's supabase_table name
      const { data: table } = await supabase
        .from("tables")
        .select("supabase_table")
        .eq("id", tableId)
        .single()

      if (!table?.supabase_table) {
        throw new Error("Table not found")
      }

      // Prepare data - only include fields that are in the form
      const submitData: Record<string, any> = {}
      visibleFields.forEach(field => {
        const value = formData[field.name]
        if (value !== undefined && value !== null && value !== '') {
          submitData[field.name] = value
        }
      })

      // Submit based on action type
      const submitAction = config?.submit_action || 'create'
      
      if (submitAction === 'create') {
        const { error } = await supabase
          .from(table.supabase_table)
          .insert([submitData])

        if (error) throw error
      } else if (submitAction === 'update' && config?.record_id) {
        const { error } = await supabase
          .from(table.supabase_table)
          .update(submitData)
          .eq('id', config.record_id)

        if (error) throw error
      }

      // Success
      setSubmitStatus('success')
      setFormData({})
      
      // Call custom onSubmit if provided
      if (onSubmit) {
        await onSubmit(submitData)
      }

      // Reset success message after 3 seconds
      setTimeout(() => setSubmitStatus('idle'), 3000)
    } catch (error: any) {
      console.error("Form submission error:", error)
      setSubmitStatus('error')
      setErrorMessage(error.message || "Failed to submit form. Please try again.")
      setTimeout(() => setSubmitStatus('idle'), 5000)
    } finally {
      setLoading(false)
    }
  }

  function renderField(field: FieldType & { formConfig: any }) {
    const value = formData[field.name] ?? ""
    const isRequired = field.formConfig?.required || false

    // Handle create new record for linked fields
    const handleCreateRecord = async (tableId: string): Promise<string | null> => {
      try {
        const supabase = createClient()
        
        const { data: table } = await supabase
          .from("tables")
          .select("supabase_table")
          .eq("id", tableId)
          .single()

        if (!table) return null

        const { data: fields } = await supabase
          .from("table_fields")
          .select("*")
          .eq("table_id", tableId)
          .order("position", { ascending: true })
          .limit(5)

        const newRecord: Record<string, any> = {}
        fields?.forEach(f => {
          if (f.default_value !== null && f.default_value !== undefined) {
            newRecord[f.name] = f.default_value
          }
        })

        const { data, error } = await supabase
          .from(table.supabase_table)
          .insert([newRecord])
          .select()
          .single()

        if (error) {
          console.error("Error creating record:", error)
          toast({
            title: "Failed to create record",
            description: error.message || "Please try again",
            variant: "destructive",
          })
          return null
        }

        return data?.id || null
      } catch (error: any) {
        console.error("Error in handleCreateRecord:", error)
        return null
      }
    }

    return (
      <div key={field.id} className="mb-4">
        <FieldEditor
          field={field}
          value={value}
          onChange={(newValue) => setFormData({ ...formData, [field.name]: newValue })}
          isReadOnly={isEditing || isViewOnly}
          required={isRequired}
          onCreateRecord={handleCreateRecord}
        />
      </div>
    )
  }

  // Show setup state if table not selected
  if (!tableId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-2">{isEditing ? "This block requires a table connection." : "No table connection"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Configure the table in block settings.</p>
          )}
        </div>
      </div>
    )
  }

  // Show setup state if no fields configured
  if (formFieldsConfig.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-2">{isEditing ? "No fields configured" : "Form not configured"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Add fields in block settings</p>
          )}
        </div>
      </div>
    )
  }

  // Show setup state if no visible fields
  if (visibleFields.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-2">No visible fields</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Enable fields in block settings</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-auto p-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        {visibleFields.map((field) => renderField(field))}
        
        {/* Status Messages */}
        {submitStatus === 'success' && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
            Form submitted successfully!
          </div>
        )}
        {submitStatus === 'error' && errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
            {errorMessage}
          </div>
        )}
        
        {!isEditing && (
          <button
            type="submit"
            disabled={loading || isViewOnly || !canCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Submitting..." : "Submit"}
          </button>
        )}
        {isViewOnly && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
            This form is view-only. You cannot submit data.
          </div>
        )}
      </form>
    </div>
  )
}
