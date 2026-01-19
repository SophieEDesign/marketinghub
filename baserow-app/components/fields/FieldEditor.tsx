"use client"

import { useRef, useEffect, useCallback, useMemo, useState } from "react"
import { Calculator, Link as LinkIcon, Paperclip, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatDateUK } from "@/lib/utils"
import type { TableField } from "@/types/fields"
import { getFieldDisplayName } from "@/lib/fields/display"
import {
  resolveChoiceColor,
  getTextColorForBackground,
  normalizeHexColor,
} from "@/lib/field-colors"
import { getManualChoiceLabels, sortLabelsByManualOrder } from "@/lib/fields/select-options"
import { useToast } from "@/components/ui/use-toast"
import LookupFieldPicker, { type LookupFieldConfig } from "@/components/fields/LookupFieldPicker"
import RichTextEditor from "@/components/fields/RichTextEditor"
import AttachmentPreview, { type Attachment } from "@/components/attachments/AttachmentPreview"

function AttachmentFieldEditor({
  field,
  value,
  onChange,
  isReadOnly,
  showLabel,
  labelClassName,
  required,
  recordId,
  tableName,
}: {
  field: TableField
  value: any
  onChange: (value: any) => void
  isReadOnly: boolean
  showLabel: boolean
  labelClassName: string
  required: boolean
  recordId?: string
  tableName?: string
}) {
  const { toast } = useToast()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null)

  const attachments: Attachment[] = useMemo(() => {
    if (Array.isArray(value)) return value as Attachment[]
    if (typeof value === "string" && value.trim()) {
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? (parsed as Attachment[]) : []
      } catch {
        return []
      }
    }
    return []
  }, [value])

  const canUpload = !isReadOnly && !!recordId && !!tableName

  const generateUUID = (): string => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === "x" ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  const handleFiles = async (files: FileList) => {
    if (!canUpload || uploading) {
      if (!recordId || !tableName) {
        toast({
          variant: "destructive",
          title: "Upload unavailable",
          description: "Save the record first, then upload files.",
        })
      }
      return
    }

    setUploading(true)
    const uploaded: Attachment[] = []

    try {
      for (const file of Array.from(files)) {
        const ext = (file?.name || "").split(".").pop() || "bin"
        const filePath = `attachments/${tableName}/${recordId}/${field.name}/${generateUUID()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from("attachments")
          .upload(filePath, file, { upsert: false })

        if (uploadError) {
          console.error("Upload error:", uploadError)
          toast({
            variant: "destructive",
            title: "Upload failed",
            description: `Failed to upload ${file.name}`,
          })
          continue
        }

        const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(filePath)

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
          description: `${uploaded.length} file${uploaded.length !== 1 ? "s" : ""} uploaded successfully`,
        })
      }
    } catch (error) {
      console.error("Error uploading files:", error)
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
    if (isReadOnly) return
    const file = attachments[index]
    if (!file) return

    setDeletingIndex(index)
    try {
      // Extract storage path from public URL
      const urlParts = file.url.split("/storage/v1/object/public/attachments/")
      const storagePath = urlParts[1]

      if (storagePath) {
        const { error } = await supabase.storage.from("attachments").remove([storagePath])
        if (error) {
          console.error("Error deleting file from storage:", error)
        }
      }

      const updated = attachments.filter((_, i) => i !== index)
      onChange(updated)
      toast({
        title: "Deleted",
        description: "File deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting file:", error)
      toast({
        variant: "destructive",
        title: "Delete error",
        description: "Failed to delete file",
      })
    } finally {
      setDeletingIndex(null)
    }
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (canUpload) setDragActive(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (canUpload && e.dataTransfer.files.length > 0) {
      await handleFiles(e.dataTransfer.files)
    }
  }

  return (
    <div className="space-y-2.5">
      {showLabel && (
        <label className={`${labelClassName} flex items-center gap-2`}>
          {getFieldDisplayName(field)}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <input
        type="file"
        ref={fileInputRef}
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      <div
        className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
          dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
        } ${canUpload ? "cursor-pointer hover:border-gray-400" : "opacity-60 cursor-not-allowed"}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => canUpload && fileInputRef.current?.click()}
      >
        <div className="text-center">
          <Paperclip className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 mb-1">
            {uploading
              ? "Uploading..."
              : canUpload
                ? "Click or drag files to upload"
                : isReadOnly
                  ? "Uploads disabled (read-only)"
                  : "Save the record first to enable uploads"}
          </p>
          <p className="text-xs text-gray-400">Multiple files supported</p>
        </div>
      </div>

      {attachments.length > 0 && (
        <div className="space-y-2">
          <AttachmentPreview
            attachments={attachments}
            maxVisible={10}
            size={field.options?.attachment_preview_size || "medium"}
            displayStyle={field.options?.attachment_display_style || "thumbnails"}
          />
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment, index) => (
              <div
                key={`${attachment.url}-${index}`}
                className="flex items-center gap-2 px-2 py-1 bg-gray-100 rounded text-xs"
              >
                <span className="truncate max-w-[200px]">{attachment.name}</span>
                {!isReadOnly && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(index)
                    }}
                    className="text-red-600 hover:text-red-800 disabled:opacity-50"
                    aria-label="Delete"
                    disabled={deletingIndex === index}
                    title={deletingIndex === index ? "Deleting..." : "Delete"}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export interface FieldEditorProps {
  field: TableField
  value: any
  onChange: (value: any) => void
  isReadOnly?: boolean // Override read-only state (for field-level permissions)
  showLabel?: boolean // Whether to show the field label (default: true)
  labelClassName?: string // Custom classes for the label
  inputClassName?: string // Custom classes for the input container
  onLinkedRecordClick?: (tableId: string, recordId: string) => void
  onCreateRecord?: (tableId: string) => Promise<string | null> // For linked fields with allowCreate
  autoFocus?: boolean // Auto-focus the input when mounted
  required?: boolean // Show required indicator
  // Optional: enable attachment uploads (used by record modals/drawers)
  recordId?: string
  tableName?: string
}

/**
 * Centralized FieldEditor component
 * 
 * This is the single source of truth for field rendering and editing.
 * All UI surfaces (modals, forms, record views, tables) should use this component
 * to ensure consistent field behavior across the application.
 * 
 * Features:
 * - Renders appropriate input based on field type
 * - Handles field options (choices, colors, etc.)
 * - Respects read-only status (formula, lookup, read_only option)
 * - Supports all field types consistently
 */
export default function FieldEditor({
  field,
  value,
  onChange,
  isReadOnly: propIsReadOnly,
  showLabel = true,
  labelClassName = "block text-sm font-medium text-gray-700",
  inputClassName = "",
  onLinkedRecordClick,
  onCreateRecord,
  autoFocus = false,
  required = false,
  recordId,
  tableName,
}: FieldEditorProps) {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  const isVirtual = field.type === "formula" || field.type === "lookup"
  // Use prop override first, then check field-level read-only, then virtual
  const isReadOnly: boolean = propIsReadOnly ?? (isVirtual || !!field.options?.read_only)
  
  // Determine if this is a lookup field (derived) vs linked field (editable)
  const isLookupField = field.type === "lookup"

  // Handle paste - block for lookup fields
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (field.type === "lookup") {
      e.preventDefault()
      toast({
        title: "Cannot edit derived field",
        description: "This field is derived and can't be edited.",
        variant: "destructive",
      })
      return
    }
  }, [field.type, toast])

  // Attachment fields (upload + preview + delete)
  if (field.type === "attachment") {
    return (
      <AttachmentFieldEditor
        field={field}
        value={value}
        onChange={onChange}
        isReadOnly={isReadOnly}
        showLabel={showLabel}
        labelClassName={labelClassName}
        required={required}
        recordId={recordId}
        tableName={tableName}
      />
    )
  }

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
      required: field.required || required,
      allowCreate: field.options?.allow_create,
    } : undefined

    // LOOKUP FIELDS (derived, read-only) - Show as informational pills
    if (isLookupField) {
      return (
        <div className="space-y-2.5" onPaste={handlePaste}>
          {showLabel && (
            <label className={`${labelClassName} flex items-center gap-2`}>
              {getFieldDisplayName(field)}
              {required && <span className="text-red-500">*</span>}
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
            <div className={`px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/50 rounded-md text-sm text-gray-500 italic ${inputClassName}`}>
              {value !== null && value !== undefined ? String(value) : "—"}
            </div>
          )}
        </div>
      )
    }

    // LINKED FIELDS (editable) - Show as editable with clear affordances
    return (
      <div className="space-y-2.5" onPaste={handlePaste}>
        {showLabel && (
          <label className={`${labelClassName} flex items-center gap-2`}>
            {getFieldDisplayName(field)}
            {required && <span className="text-red-500">*</span>}
          </label>
        )}
        {lookupConfig ? (
          <LookupFieldPicker
            field={field}
            value={value}
            onChange={onChange}
            config={lookupConfig}
            disabled={isReadOnly}
            placeholder={`Select ${getFieldDisplayName(field)}...`}
            onRecordClick={onLinkedRecordClick}
            onCreateRecord={onCreateRecord || (lookupConfig.allowCreate ? async (tableId: string) => {
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
                  .limit(5)

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
            } : undefined)}
            isLookupField={false}
          />
        ) : (
          <div className={`px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-500 ${inputClassName}`}>
            Configure linked table in field settings
          </div>
        )}
      </div>
    )
  }

  // Select fields
  if (field.type === "single_select" || field.type === "multi_select") {
    const choices = getManualChoiceLabels(field.type, field.options)
    const isMulti = field.type === "multi_select"
    const selectedValuesRaw = isMulti
      ? (Array.isArray(value) ? value : value ? [value] : [])
      : value
        ? [value]
        : []
    // IMPORTANT: pills must always follow manual order (sort_index),
    // and must never be affected by any per-picker alphabetise UI.
    const selectedValues = sortLabelsByManualOrder(selectedValuesRaw, field.type, field.options)

    // Capture the narrowed type so TS keeps it inside closures.
    const selectFieldType: "single_select" | "multi_select" = field.type
    const useSemanticColors = selectFieldType === "single_select"
    const getChoiceColor = (choice: string): string =>
      resolveChoiceColor(choice, selectFieldType, field.options, useSemanticColors)

    if (isReadOnly) {
      return (
        <div className="space-y-2.5">
          {showLabel && (
            <label className={`${labelClassName} flex items-center gap-2`}>
              {getFieldDisplayName(field)}
              {required && <span className="text-red-500">*</span>}
              {isVirtual && (
                <span title="Formula or lookup field">
                  <Calculator className="h-3 w-3 text-gray-400" />
                </span>
              )}
            </label>
          )}
          <div className={`px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/50 rounded-md text-sm min-h-[40px] flex items-center flex-wrap gap-1.5 ${inputClassName}`}>
            {selectedValues.length > 0 ? (
              selectedValues.map((val: string) => {
                const hexColor = getChoiceColor(val)
                const textColorClass = getTextColorForBackground(hexColor)
                const bgColor = normalizeHexColor(hexColor)
                return (
                  <span
                    key={val}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap shadow-sm ${textColorClass}`}
                    style={{ backgroundColor: bgColor }}
                  >
                    {val}
                  </span>
                )
              })
            ) : (
              <span className="text-gray-400 italic">—</span>
            )}
          </div>
        </div>
      )
    }

    // Editable select - use dropdown for single, multi-select with checkboxes
    return (
      <div className="space-y-2.5">
        {showLabel && (
          <label className={`${labelClassName} flex items-center gap-2`}>
            {getFieldDisplayName(field)}
            {required && <span className="text-red-500">*</span>}
          </label>
        )}
        {isMulti ? (
          // Multi-select: show color pills that can be toggled
          <div className={`flex flex-wrap gap-2 ${inputClassName}`}>
            {choices.length === 0 ? (
              <div className="text-sm text-gray-500 italic px-2 py-1">No options configured</div>
            ) : (
              choices.map((choice: string) => {
                const isSelected = selectedValuesRaw.includes(choice)
                const hexColor = getChoiceColor(choice)
                const textColorClass = getTextColorForBackground(hexColor)
                const bgColor = normalizeHexColor(hexColor)
                
                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => {
                      const newValues = isSelected
                        ? selectedValuesRaw.filter((v) => v !== choice)
                        : [...selectedValuesRaw, choice]
                      onChange(newValues)
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shadow-sm transition-all ${
                      isSelected 
                        ? `${textColorClass} ring-2 ring-offset-1 ring-gray-400` 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    style={isSelected ? { backgroundColor: bgColor } : {}}
                  >
                    {choice}
                  </button>
                )
              })
            )}
          </div>
        ) : (
          // Single select: show color pills that can be clicked
          <div className={`flex flex-wrap gap-2 ${inputClassName}`}>
            {choices.length === 0 ? (
              <div className="text-sm text-gray-500 italic px-2 py-1">No options configured</div>
            ) : (
              <>
                {choices.map((choice: string) => {
                  const isSelected = selectedValuesRaw.includes(choice)
                  const hexColor = getChoiceColor(choice)
                  const textColorClass = getTextColorForBackground(hexColor)
                  const bgColor = normalizeHexColor(hexColor)
                  
                  return (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => onChange(choice)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shadow-sm transition-all ${
                        isSelected 
                          ? `${textColorClass} ring-2 ring-offset-1 ring-gray-400` 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      style={isSelected ? { backgroundColor: bgColor } : {}}
                    >
                      {choice}
                    </button>
                  )
                })}
                {value && (
                  <button
                    type="button"
                    onClick={() => onChange(null)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-300"
                  >
                    Clear
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  // Date fields
  if (field.type === "date") {
    // For input: use ISO format (YYYY-MM-DD) - HTML5 date input requires this
    const dateValueForInput = value ? new Date(value).toISOString().split("T")[0] : ""

    if (isReadOnly) {
      const dateValueForDisplay = value ? formatDateUK(value, "—") : ""
      return (
        <div className="space-y-2.5">
          {showLabel && (
            <label className={`${labelClassName} flex items-center gap-2`}>
              {getFieldDisplayName(field)}
              {required && <span className="text-red-500">*</span>}
              {isVirtual && (
                <span title="Formula or lookup field">
                  <Calculator className="h-3 w-3 text-gray-400" />
                </span>
              )}
            </label>
          )}
          <div className={`px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/50 rounded-md text-sm text-gray-600 italic ${inputClassName}`}>
            {dateValueForDisplay || "—"}
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-2.5">
        {showLabel && (
          <label className={`${labelClassName} flex items-center gap-2`}>
            {getFieldDisplayName(field)}
            {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="date"
          value={dateValueForInput}
          onChange={(e) => onChange(e.target.value || null)}
          className={`w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputClassName}`}
          required={required}
        />
      </div>
    )
  }

  // Checkbox
  if (field.type === "checkbox") {
    return (
      <div className="space-y-2.5">
        {showLabel ? (
          <label className={`${labelClassName} flex items-center gap-2 cursor-pointer`}>
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              disabled={isReadOnly}
              className="w-4 h-4 cursor-pointer"
              required={required}
            />
            <span>
              {getFieldDisplayName(field)}
              {required && <span className="text-red-500 ml-1">*</span>}
            </span>
            {isVirtual && (
              <span title="Formula or lookup field">
                <Calculator className="h-3 w-3 text-gray-400" />
              </span>
            )}
          </label>
        ) : (
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            disabled={isReadOnly}
            className="w-4 h-4 cursor-pointer"
            required={required}
          />
        )}
      </div>
    )
  }

  // Long text
  if (field.type === "long_text") {
    if (isReadOnly) {
      return (
        <div className="space-y-2.5">
          {showLabel && (
            <label className={`${labelClassName} flex items-center gap-2`}>
              {getFieldDisplayName(field)}
              {required && <span className="text-red-500">*</span>}
              {isVirtual && (
                <span title="Formula or lookup field">
                  <Calculator className="h-3 w-3 text-gray-400" />
                </span>
              )}
            </label>
          )}
          <div className={`px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/50 rounded-md text-sm text-gray-600 min-h-[60px] ${inputClassName}`}>
            {value ? (
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: value }}
              />
            ) : (
              <span className="italic">—</span>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-2.5">
        {showLabel && (
          <label className={`${labelClassName} flex items-center gap-2`}>
            {getFieldDisplayName(field)}
            {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <RichTextEditor
          value={value ?? ""}
          onChange={onChange}
          editable={true}
          showToolbar={true}
          minHeight="150px"
        />
      </div>
    )
  }

  // Default: Text, Number, Email, URL, etc.
  const inputType =
    field.type === "number" || field.type === "percent" || field.type === "currency"
      ? "number"
      : field.type === "email"
        ? "email"
        : field.type === "url"
          ? "url"
          : "text"

  if (isReadOnly) {
    return (
      <div className="space-y-2.5">
        {showLabel && (
          <label className={`${labelClassName} flex items-center gap-2`}>
            {getFieldDisplayName(field)}
            {required && <span className="text-red-500">*</span>}
            {isVirtual && (
              <span title="Formula or lookup field">
                <Calculator className="h-3 w-3 text-gray-400" />
              </span>
            )}
          </label>
        )}
        <div className={`px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/50 rounded-md text-sm text-gray-600 italic ${inputClassName}`}>
          {value !== null && value !== undefined ? String(value) : "—"}
          {field.type === "formula" && field.options?.formula && (
            <div className="text-xs text-gray-500 mt-1 font-mono">
              = {field.options.formula}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {showLabel && (
        <label className={`${labelClassName} flex items-center gap-2`}>
          {getFieldDisplayName(field)}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={inputType}
        value={value ?? ""}
        onChange={(e) =>
          onChange(inputType === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)
        }
        className={`w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputClassName}`}
        placeholder={`Enter ${getFieldDisplayName(field)}...`}
        required={required}
      />
    </div>
  )
}
