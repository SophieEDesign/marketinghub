"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Link2, Plus, X, Calculator, Link as LinkIcon, Paperclip, ExternalLink, Mail } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatDateUK } from "@/lib/utils"
import type { TableField } from "@/types/fields"
import { useToast } from "@/components/ui/use-toast"
import LookupFieldPicker, { type LookupFieldConfig } from "@/components/fields/LookupFieldPicker"
import RichTextEditor from "@/components/fields/RichTextEditor"
import AttachmentPreview, { type Attachment } from "@/components/attachments/AttachmentPreview"
import InlineSelectDropdown from "@/components/fields/InlineSelectDropdown"
import { getInlineEditState, isFieldValueError } from "@/lib/fields/display"
import { useSchemaContract } from "@/hooks/useSchemaContract"


interface InlineFieldEditorProps {
  field: TableField
  value: any
  onChange: (value: any) => void
  isEditing: boolean
  onEditStart: () => void
  onEditEnd: () => void
  onLinkedRecordClick: (tableId: string, recordId: string) => void
  onAddLinkedRecord: (field: TableField) => void
  isReadOnly?: boolean // Override read-only state (for field-level permissions)
  selectOptionsEditable?: boolean // Allow editing select field options
  suppressDerivedFieldErrors?: boolean // Suppress derived-field error UI
  showLabel?: boolean // Whether to render the field label (default: true)
  labelClassName?: string // Optional label classes
  tableId?: string // For attachment uploads
  recordId?: string // For attachment uploads
  tableName?: string // For attachment uploads (supabase table name)
}

export default function InlineFieldEditor({
  field,
  value,
  onChange,
  isEditing,
  onEditStart,
  onEditEnd,
  onLinkedRecordClick,
  onAddLinkedRecord,
  isReadOnly: propIsReadOnly,
  selectOptionsEditable = true,
  suppressDerivedFieldErrors = false,
  showLabel: propShowLabel = true,
  labelClassName: propLabelClassName,
  tableId,
  recordId,
  tableName,
}: InlineFieldEditorProps) {
  const { toast } = useToast()
  const { schemaAvailable } = useSchemaContract()
  const [localValue, setLocalValue] = useState(value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)
  const showLabel = propShowLabel
  const labelClassName = propLabelClassName || "block text-sm font-medium text-gray-700"
  const containerClassName = showLabel ? "space-y-1.5" : ""
  const displayBoxClassName = showLabel
    ? "px-3 py-2 border border-gray-200 rounded-md hover:border-blue-400 hover:bg-blue-50/30 transition-colors cursor-pointer text-sm text-gray-900"
    : "-mx-2 px-2 py-1.5 rounded-md text-sm text-gray-900 hover:bg-gray-50 hover:ring-1 hover:ring-gray-200 transition-colors cursor-pointer"
  const readOnlyBoxClassName = showLabel
    ? "px-3 py-2 bg-gray-50/50 border border-gray-200/50 rounded-md text-sm text-gray-600 italic"
    : "-mx-2 px-2 py-1.5 rounded-md text-sm text-gray-600"
  const inputBoxClassName = showLabel
    ? "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    : "w-full px-2 py-1.5 rounded-md ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.select()
      }
    }
  }, [isEditing])

  const isErrorValue = isFieldValueError(value)
  const safeValue = isErrorValue ? null : value

  const suppressDerivedErrors = suppressDerivedFieldErrors && (field.type === "lookup" || field.type === "formula")

  useEffect(() => {
    if (isErrorValue && !suppressDerivedErrors) {
      console.error(`Invalid value for field "${field.name}".`, value)
    }
  }, [isErrorValue, suppressDerivedErrors, value, field.name])

  const selectDiagnostics = useMemo(() => {
    if (field.type !== "single_select" && field.type !== "multi_select") {
      return null
    }
    const choices = field.options?.choices || []
    const isMulti = field.type === "multi_select"
    const rawValues = isMulti
      ? (Array.isArray(safeValue) ? safeValue : safeValue ? [safeValue] : [])
      : (typeof safeValue === "string" ? [safeValue] : [])
    const validValues = choices.length > 0
      ? rawValues.filter((val) => choices.includes(val))
      : rawValues
    const hasInvalidValues = rawValues.length !== validValues.length
    const normalizedSingleValue = !isMulti ? (validValues[0] ?? null) : null
    return {
      choices,
      isMulti,
      rawValues,
      validValues,
      hasInvalidValues,
      normalizedSingleValue,
    }
  }, [field.type, field.options?.choices, safeValue])

  useEffect(() => {
    if (selectDiagnostics?.hasInvalidValues) {
      console.warn(`Invalid select value for field "${field.name}".`, selectDiagnostics.rawValues)
    }
  }, [selectDiagnostics?.hasInvalidValues, selectDiagnostics?.rawValues, field.name])

  const handleChange = (newValue: any) => {
    setLocalValue(newValue)
  }

  const handleBlur = () => {
    onChange(localValue)
    onEditEnd()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && field.type !== "long_text") {
      e.preventDefault()
      handleBlur()
    } else if (e.key === "Escape") {
      setLocalValue(value) // Reset to original value
      onEditEnd()
    }
  }

  // Handle paste - block for lookup fields, allow for linked fields
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (field.type === "lookup") {
      e.preventDefault()
      if (suppressDerivedErrors) return
      toast({
        title: "Cannot edit derived field",
        description: "This field is derived and can't be edited.",
        variant: "destructive",
      })
      return
    }
    // For linked fields, paste is handled by LookupFieldPicker
  }, [field.type, suppressDerivedErrors, toast])

  const schemaLocked = !schemaAvailable
  const { isReadOnly, isVirtual } = getInlineEditState({
    editable: true,
    fieldType: field.type,
    fieldOptions: field.options,
    isReadOnlyOverride: propIsReadOnly || schemaLocked,
  })
  
  // Determine if this is a lookup field (derived) vs linked field (editable)
  const isLookupField = field.type === "lookup"
  const isLinkedField = field.type === "link_to_table"

  // Linked records and lookup fields - use LookupFieldPicker
  if (field.type === "link_to_table" || field.type === "lookup") {
    const linkedTableId = field.type === "link_to_table" 
      ? field.options?.linked_table_id 
      : field.options?.lookup_table_id

    // Build lookup config from field options
    const lookupConfig: LookupFieldConfig | undefined = linkedTableId ? {
      lookupTableId: linkedTableId,
      relationshipType: field.options?.relationship_type || (field.type === "link_to_table" ? 'one-to-many' : 'one-to-one'),
      maxSelections: field.options?.max_selections,
      required: field.required,
      allowCreate: field.options?.allow_create,
    } : undefined

    // Handle create new record
    const handleCreateRecord = async (tableId: string): Promise<string | null> => {
      try {
        const supabase = createClient()
        
        // Get table info
        const { data: table } = await supabase
          .from("tables")
          .select("supabase_table")
          .eq("id", tableId)
          .single()

        if (!table) return null

        // Get fields to create a minimal record
        const { data: fields } = await supabase
          .from("table_fields")
          .select("*")
          .eq("table_id", tableId)
          .order("position", { ascending: true })
          .limit(5) // Just get first few fields

        // Create minimal record with default values
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

    // LOOKUP FIELDS (derived, read-only) - Show as informational pills
    if (isLookupField) {
      return (
        <div className={containerClassName} onPaste={handlePaste}>
          {showLabel && (
            <label className={`${labelClassName} flex items-center gap-2`}>
              {field.name}
              <span title="Derived field (read-only)" className="flex items-center gap-1 text-xs text-gray-400 font-normal">
                <LinkIcon className="h-3 w-3" />
                <span>Derived</span>
              </span>
            </label>
          )}
          {lookupConfig ? (
            <LookupFieldPicker
              field={field}
              value={value}
              onChange={() => {}} // No-op for lookup fields
              config={lookupConfig}
              disabled={true}
              placeholder="No linked records"
              onRecordClick={onLinkedRecordClick}
              isLookupField={true}
            />
          ) : (
            <div className={readOnlyBoxClassName}>
              {safeValue !== null && safeValue !== undefined ? String(safeValue) : "—"}
            </div>
          )}
        </div>
      )
    }

    // LINKED FIELDS (editable) - Show as editable with clear affordances
    return (
      <div className={containerClassName} onPaste={handlePaste}>
        {showLabel && (
          <label className={labelClassName}>{field.name}</label>
        )}
        {lookupConfig ? (
          <LookupFieldPicker
            field={field}
            value={value}
            onChange={onChange}
            config={lookupConfig}
            disabled={isReadOnly}
            placeholder={`Add ${field.name}...`}
            onRecordClick={onLinkedRecordClick}
            onCreateRecord={lookupConfig.allowCreate ? handleCreateRecord : undefined}
            isLookupField={false}
          />
        ) : (
          <div className={readOnlyBoxClassName}>
            Configure linked table in field settings
          </div>
        )}
      </div>
    )
  }

  // Select fields
  if (field.type === "single_select" || field.type === "multi_select") {
    const choices = selectDiagnostics?.choices || []
    const isMulti = selectDiagnostics?.isMulti ?? field.type === "multi_select"
    const validValues = selectDiagnostics?.validValues || []
    const normalizedSingleValue = selectDiagnostics?.normalizedSingleValue ?? null

    return (
      <div className={containerClassName}>
        {showLabel && (
          <label className={`${labelClassName} flex items-center gap-2`}>
            {field.name}
            {isVirtual && (
              <span title="Formula or lookup field">
                <Calculator className="h-3 w-3 text-gray-400" />
              </span>
            )}
          </label>
        )}
        <InlineSelectDropdown
          value={isMulti ? validValues : normalizedSingleValue}
          choices={choices}
          choiceColors={field.options?.choiceColors}
          fieldOptions={field.options}
          fieldType={field.type}
          fieldId={field.id}
          tableId={field.table_id}
          editable={!isReadOnly}
          canEditOptions={!isReadOnly && selectOptionsEditable} // If they can edit the field, they can edit options
          displayVariant="pills"
          allowClear={!isReadOnly}
          onValueChange={async (newValue) => {
            onChange(newValue)
          }}
          placeholder="Click to select..."
        />
      </div>
    )
  }

  // Date fields
  if (field.type === "date") {
    // For input: use ISO format (YYYY-MM-DD) - HTML5 date input requires this
    const parsedDate = safeValue ? new Date(safeValue) : null
    const isValidDate = !!parsedDate && !isNaN(parsedDate.getTime())
    const dateValueForInput = isValidDate ? parsedDate.toISOString().split("T")[0] : ""
    // For display: use UK format (DD/MM/YYYY)
    const dateValueForDisplay = isValidDate ? formatDateUK(parsedDate, "—") : ""

    if (isEditing && !isReadOnly) {
      return (
        <div className={containerClassName}>
          {showLabel && <label className={labelClassName}>{field.name}</label>}
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="date"
            value={dateValueForInput}
            onChange={(e) => handleChange(e.target.value || null)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={inputBoxClassName}
          />
        </div>
      )
    }

    return (
      <div className={containerClassName}>
        {showLabel && (
          <label className={`${labelClassName} flex items-center gap-2`}>
            {field.name}
            {isVirtual && (
              <span title="Formula or lookup field">
                <Calculator className="h-3 w-3 text-gray-400" />
              </span>
            )}
          </label>
        )}
        {isReadOnly ? (
          <div className={readOnlyBoxClassName}>
            {dateValueForDisplay || "—"}
          </div>
        ) : (
          <div
            onClick={onEditStart}
            className={displayBoxClassName}
          >
            {dateValueForDisplay || <span className="text-gray-400">Click to set date...</span>}
          </div>
        )}
      </div>
    )
  }

  // Checkbox
  if (field.type === "checkbox") {
    return (
      <div className={containerClassName}>
        {showLabel && (
          <label className={`${labelClassName} flex items-center gap-2`}>
            {field.name}
            {isVirtual && (
              <span title="Formula or lookup field">
                <Calculator className="h-3 w-3 text-gray-400" />
              </span>
            )}
          </label>
        )}
        {isReadOnly ? (
          <div className={readOnlyBoxClassName}>
            {value ? "Yes" : "No"}
          </div>
        ) : (
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              className="w-4 h-4 cursor-pointer"
            />
            <span className="text-sm text-gray-700">{value ? "Yes" : "No"}</span>
          </label>
        )}
      </div>
    )
  }

  // Long text
  if (field.type === "long_text") {
    if (isEditing && !isReadOnly) {
      return (
        <div className={containerClassName}>
          {showLabel && <label className={labelClassName}>{field.name}</label>}
          <RichTextEditor
            value={localValue ?? ""}
            onChange={handleChange}
            onBlur={handleBlur}
            editable={true}
            showToolbar={true}
            minHeight="120px"
          />
        </div>
      )
    }

    return (
      <div className={containerClassName}>
        {showLabel && (
          <label className={`${labelClassName} flex items-center gap-2`}>
            {field.name}
            {isVirtual && (
              <span title="Formula or lookup field">
                <Calculator className="h-3 w-3 text-gray-400" />
              </span>
            )}
          </label>
        )}
        {isReadOnly ? (
          <div className={`${readOnlyBoxClassName} ${showLabel ? "min-h-[48px]" : ""}`}>
            {safeValue ? (
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: safeValue }}
              />
            ) : (
              <span className="italic">—</span>
            )}
          </div>
        ) : (
          <div
            onClick={onEditStart}
            className={`${displayBoxClassName} ${showLabel ? "min-h-[48px]" : ""}`}
          >
            {safeValue ? (
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: safeValue }}
              />
            ) : (
              <span className="text-gray-400">Click to add text...</span>
            )}
          </div>
        )}
      </div>
    )
  }

  // Attachment fields
  if (field.type === "attachment") {
    const attachments: Attachment[] = Array.isArray(safeValue) ? safeValue : safeValue ? [safeValue] : []
    
    if (isEditing && !isReadOnly && tableId && recordId && tableName) {
      // Show attachment editor with upload capability
      return (
        <AttachmentFieldEditor
          field={field}
          attachments={attachments}
          onChange={onChange}
          onEditEnd={onEditEnd}
          tableId={tableId}
          recordId={recordId}
          tableName={tableName}
        />
      )
    }
    
    // Display mode - show previews
    return (
      <div className={containerClassName}>
        {showLabel && (
          <label className={`${labelClassName} flex items-center gap-2`}>
            {field.name}
            {isVirtual && (
              <span title="Formula or lookup field">
                <Calculator className="h-3 w-3 text-gray-400" />
              </span>
            )}
          </label>
        )}
        {attachments.length > 0 ? (
          <AttachmentPreview
            attachments={attachments}
            maxVisible={5}
            size="medium"
            displayStyle={field.options?.attachment_display_style || 'thumbnails'}
          />
        ) : (
          <div className={`${readOnlyBoxClassName} flex items-center gap-2 ${showLabel ? "" : "text-gray-400 italic"}`}>
            <Paperclip className="h-4 w-4" />
            No attachments
          </div>
        )}
      </div>
    )
  }

  // URL fields - display as clickable links
  if (field.type === "url") {
    const formatUrl = (url: string): string => {
      if (!url) return ''
      try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
        return urlObj.hostname.replace('www.', '')
      } catch {
        return url
      }
    }

    const getFullUrl = (url: string): string => {
      if (!url) return ''
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url
      }
      return `https://${url}`
    }

    if (isEditing && !isReadOnly) {
      return (
        <div className={containerClassName}>
          {showLabel && <label className={labelClassName}>{field.name}</label>}
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="url"
            value={localValue ?? ""}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={inputBoxClassName}
            placeholder="https://example.com"
          />
        </div>
      )
    }

    return (
      <div className={containerClassName}>
        {showLabel && (
          <label className={`${labelClassName} flex items-center gap-2`}>
            {field.name}
            {isVirtual && (
              <span title="Formula or lookup field">
                <Calculator className="h-3 w-3 text-gray-400" />
              </span>
            )}
          </label>
        )}
        {isReadOnly ? (
          <div className={`${readOnlyBoxClassName} ${showLabel ? "min-h-[36px] flex items-center" : ""}`}>
            {safeValue ? (
              <a
                href={getFullUrl(safeValue)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
              >
                {formatUrl(safeValue)}
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
            ) : (
              "—"
            )}
          </div>
        ) : (
          <div
            onClick={onEditStart}
            className={`${displayBoxClassName} ${showLabel ? "min-h-[36px] flex items-center group" : "group"}`}
            title={value || undefined}
          >
            {safeValue ? (
              <a
                href={getFullUrl(safeValue)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
              >
                {formatUrl(safeValue)}
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </a>
            ) : (
              <span className="text-gray-400">Click to edit...</span>
            )}
          </div>
        )}
      </div>
    )
  }

  // Email fields - display as clickable mailto links
  if (field.type === "email") {
    if (isEditing && !isReadOnly) {
      return (
        <div className={containerClassName}>
          {showLabel && <label className={labelClassName}>{field.name}</label>}
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="email"
            value={localValue ?? ""}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={inputBoxClassName}
            placeholder="email@example.com"
          />
        </div>
      )
    }

    return (
      <div className={containerClassName}>
        {showLabel && (
          <label className={`${labelClassName} flex items-center gap-2`}>
            {field.name}
            {isVirtual && (
              <span title="Formula or lookup field">
                <Calculator className="h-3 w-3 text-gray-400" />
              </span>
            )}
          </label>
        )}
        {isReadOnly ? (
          <div className={`${readOnlyBoxClassName} ${showLabel ? "min-h-[36px] flex items-center gap-1" : "flex items-center gap-1"}`}>
            {safeValue ? (
              <>
                <Mail className="h-3 w-3 text-gray-400 flex-shrink-0" />
                <a
                  href={`mailto:${safeValue}`}
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  {safeValue}
                </a>
              </>
            ) : (
              "—"
            )}
          </div>
        ) : (
          <div
            onClick={onEditStart}
            className={`${displayBoxClassName} ${showLabel ? "min-h-[36px] flex items-center" : "flex items-center"}`}
            title={value || undefined}
          >
            {safeValue ? (
              <>
                <Mail className="h-3 w-3 text-gray-400 flex-shrink-0" />
                <a
                  href={`mailto:${safeValue}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  {safeValue}
                </a>
              </>
            ) : (
              <span className="text-gray-400">Click to edit...</span>
            )}
          </div>
        )}
      </div>
    )
  }

  // Default: Text, Number, etc.
  if (isEditing && !isReadOnly) {
    const inputType = field.type === "number" ? "number" : "text"

    return (
      <div className={containerClassName}>
        {showLabel && <label className={labelClassName}>{field.name}</label>}
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={inputType}
          value={localValue ?? ""}
          onChange={(e) =>
            handleChange(inputType === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)
          }
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={inputBoxClassName}
          placeholder={`Enter ${field.name}...`}
        />
      </div>
    )
  }

  return (
    <div className={containerClassName}>
      {showLabel && (
        <label className={`${labelClassName} flex items-center gap-2`}>
          {field.name}
          {isVirtual && (
            <span title="Formula or lookup field">
              <Calculator className="h-3 w-3 text-gray-400" />
            </span>
          )}
        </label>
      )}
      {isReadOnly ? (
        <div className={readOnlyBoxClassName}>
          {safeValue !== null && safeValue !== undefined ? String(safeValue) : "—"}
          {field.type === "formula" && field.options?.formula && (
            <div className="text-xs text-gray-500 mt-1 font-mono">
              = {field.options.formula}
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={onEditStart}
          className={`${displayBoxClassName} ${showLabel ? "min-h-[36px] flex items-center" : ""}`}
        >
          {value !== null && value !== undefined ? (
            String(value)
          ) : (
            <span className="text-gray-400">Click to edit...</span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Attachment Field Editor Component
 * Handles upload, delete, and preview for attachment fields in record views
 */
function AttachmentFieldEditor({
  field,
  attachments,
  onChange,
  onEditEnd,
  tableId,
  recordId,
  tableName,
}: {
  field: TableField
  attachments: Attachment[]
  onChange: (value: Attachment[]) => void
  onEditEnd: () => void
  tableId: string
  recordId: string
  tableName: string
}) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const supabase = createClient()
  const { toast } = useToast()

  // Generate UUID helper
  const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  const handleFiles = async (files: FileList) => {
    if (uploading) return

    setUploading(true)
    const uploaded: Attachment[] = []

    try {
      for (const file of Array.from(files)) {
        const ext = (file?.name || '').split('.').pop() || 'bin'
        const filePath = `attachments/${tableName}/${recordId}/${field.name}/${generateUUID()}.${ext}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, file, { upsert: false })

        if (uploadError) {
          console.error('Upload error:', uploadError)
          toast({
            variant: "destructive",
            title: "Upload failed",
            description: `Failed to upload ${file.name}`,
          })
          continue
        }

        const { data: urlData } = supabase.storage
          .from('attachments')
          .getPublicUrl(filePath)

        uploaded.push({
          url: urlData.publicUrl,
          name: file.name,
          size: file.size,
          type: file.type,
        })
      }

      if (uploaded.length > 0) {
        onChange([...attachments, ...uploaded])
        toast({
          title: "Uploaded",
          description: `${uploaded.length} file${uploaded.length !== 1 ? 's' : ''} uploaded successfully`,
        })
      }
    } catch (error) {
      console.error('Error uploading files:', error)
      toast({
        variant: "destructive",
        title: "Upload error",
        description: "An error occurred while uploading files",
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (index: number) => {
    const file = attachments[index]
    if (!file) return

    try {
      // Extract storage path from public URL
      const urlParts = file.url.split('/storage/v1/object/public/attachments/')
      const storagePath = urlParts[1]

      if (storagePath) {
        await supabase.storage.from('attachments').remove([storagePath])
      }

      const updated = attachments.filter((_, i) => i !== index)
      onChange(updated)
      toast({
        title: "Deleted",
        description: "File deleted successfully",
      })
    } catch (error) {
      console.error('Error deleting file:', error)
      toast({
        variant: "destructive",
        title: "Delete error",
        description: "Failed to delete file",
      })
    }
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files.length > 0) {
      await handleFiles(e.dataTransfer.files)
    }
  }

  return (
    <div className="space-y-2.5">
      <label className="block text-sm font-medium text-gray-700">{field.name}</label>
      
      <input
        type="file"
        ref={fileInputRef}
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      <div
        className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="text-center">
          <Paperclip className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 mb-1">
            {uploading ? 'Uploading...' : 'Click or drag files to upload'}
          </p>
          <p className="text-xs text-gray-400">Multiple files supported</p>
        </div>
      </div>

      {attachments.length > 0 && (
        <div className="space-y-2">
          <AttachmentPreview
            attachments={attachments}
            maxVisible={10}
            size="medium"
            displayStyle={field.options?.attachment_display_style || 'thumbnails'}
          />
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-2 py-1 bg-gray-100 rounded text-xs"
              >
                <span className="truncate max-w-[200px]">{attachment.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(index)
                  }}
                  className="text-red-600 hover:text-red-800"
                  aria-label="Delete"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onEditEnd}
          className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  )
}

