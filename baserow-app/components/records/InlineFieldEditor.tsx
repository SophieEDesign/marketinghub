"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Link2, Plus, X, Calculator, Link as LinkIcon, Paperclip, ExternalLink, Mail, Pencil } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatDateUK, cn } from "@/lib/utils"
import type { TableField } from "@/types/fields"
import { useToast } from "@/components/ui/use-toast"
import LookupFieldPicker, { type LookupFieldConfig } from "@/components/fields/LookupFieldPicker"
import RichTextEditor from "@/components/fields/RichTextEditor"
import AttachmentPreview, { type Attachment } from "@/components/attachments/AttachmentPreview"
import InlineSelectDropdown from "@/components/fields/InlineSelectDropdown"
import { isUserField, getUserDisplayName } from "@/lib/users/userDisplay"
import RecordModal from "@/components/calendar/RecordModal"
import { createLookupFieldConfig } from "@/lib/fields/linkedFieldConfig"

import {
  resolveChoiceColor,
  resolveFieldColor,
  getTextColorForBackground,
  normalizeHexColor,
} from "@/lib/field-colors"
import { getFieldDisplayName } from "@/lib/fields/display"
import { FIELD_LABEL_CLASS_NO_MARGIN, FIELD_LABEL_GAP_CLASS } from "@/lib/fields/field-label"

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
  showLabel?: boolean // Whether to render the field label (default: true)
  labelClassName?: string // Optional label classes
  tableId?: string // For attachment uploads
  recordId?: string // For attachment uploads
  tableName?: string // For attachment uploads (supabase table name)
  displayMode?: 'compact' | 'inline' | 'expanded' | 'list' // Display mode for linked fields (default: 'compact'); 'list' shows as vertical list (same as expanded)
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
  showLabel: propShowLabel = true,
  labelClassName: propLabelClassName,
  tableId,
  recordId,
  tableName,
  displayMode = 'compact',
}: InlineFieldEditorProps) {
  const { toast } = useToast()
  const [localValue, setLocalValue] = useState(value)
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)
  const [createRecordModalOpen, setCreateRecordModalOpen] = useState(false)
  const [createRecordTableId, setCreateRecordTableId] = useState<string | null>(null)
  const [createRecordTableFields, setCreateRecordTableFields] = useState<TableField[]>([])
  const [createRecordResolve, setCreateRecordResolve] = useState<((id: string | null) => void) | null>(null)
  const showLabel = propShowLabel
  const labelClassName = propLabelClassName ?? FIELD_LABEL_CLASS_NO_MARGIN
  const containerClassName = showLabel ? FIELD_LABEL_GAP_CLASS : ""
  
  // Check if this is a user field and fetch display name
  const isUserFieldType = isUserField(field.name)
  
  useEffect(() => {
    if (isUserFieldType && value && typeof value === "string") {
      getUserDisplayName(value).then(setUserDisplayName).catch(() => setUserDisplayName(null))
    } else {
      setUserDisplayName(null)
    }
  }, [isUserFieldType, value])
  const displayBoxClassName = showLabel
    ? "px-3 py-2.5 bg-white border border-gray-200 rounded-md hover:border-blue-400 hover:bg-blue-50/30 hover:border-l-4 hover:border-l-blue-500 transition-all duration-200 cursor-pointer text-sm text-gray-900 relative group"
    : "-mx-2 px-3 py-2.5 bg-white border border-gray-200 rounded-md text-sm text-gray-900 hover:bg-gray-50 hover:border-gray-300 hover:ring-1 hover:ring-gray-200 hover:border-l-4 hover:border-l-blue-500 transition-all duration-200 cursor-pointer relative group"
  const readOnlyBoxClassName = showLabel
    ? "px-3 py-2.5 bg-gray-50/50 border border-gray-200/50 rounded-md text-sm text-gray-600 italic"
    : "-mx-2 px-2 py-1.5 rounded-md text-sm text-gray-600"
  const inputBoxClassName = showLabel
    ? "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    : "w-full px-2 py-1.5 rounded-md ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"

  useEffect(() => {
    // Only update localValue from prop when NOT editing
    // This prevents the input from resetting while the user is typing
    if (!isEditing) {
      setLocalValue(value)
    }
  }, [value, isEditing])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.select()
      }
    }
  }, [isEditing])

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
      toast({
        title: "Cannot edit derived field",
        description: "This field is derived and can't be edited.",
        variant: "destructive",
      })
      return
    }
    // For linked fields, paste is handled by LookupFieldPicker
  }, [field.type, toast])

  const isVirtual = field.type === "formula" || field.type === "lookup"
  // Use prop override first, then check field-level read-only, then virtual
  const isReadOnly = propIsReadOnly !== undefined ? propIsReadOnly : (isVirtual || field.options?.read_only)
  
  // Determine if this is a lookup field (derived) vs linked field (editable)
  const isLookupField = field.type === "lookup"
  const isLinkedField = field.type === "link_to_table"

  // Handle modal save - called when RecordModal saves successfully
  // Must be at top level (before conditional returns) to satisfy React hooks rules
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
  // Must be at top level (before conditional returns) to satisfy React hooks rules
  const handleModalClose = useCallback(() => {
    if (createRecordResolve) {
      createRecordResolve(null)
      setCreateRecordResolve(null)
    }
    setCreateRecordModalOpen(false)
    setCreateRecordTableId(null)
    setCreateRecordTableFields([])
  }, [createRecordResolve])

  // Linked records and lookup fields - use LookupFieldPicker
  if (field.type === "link_to_table" || field.type === "lookup") {
    const linkedTableId = field.type === "link_to_table" 
      ? field.options?.linked_table_id 
      : field.options?.lookup_table_id

    // Build lookup config from field options
    // For link_to_table fields, use shared utility to ensure consistency with Grid block
    // For lookup fields, create config inline (lookup fields are read-only derived fields)
    const lookupConfig: LookupFieldConfig | undefined = field.type === "link_to_table"
      ? createLookupFieldConfig(field)
      : linkedTableId ? {
          lookupTableId: linkedTableId,
          relationshipType: field.options?.relationship_type || 'one-to-one',
          maxSelections: field.options?.max_selections,
          required: field.required,
          allowCreate: field.options?.allow_create,
        } : undefined

    // Handle create new record - opens RecordModal
    const handleCreateRecord = async (tableId: string): Promise<string | null> => {
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
              console.error("Error loading table fields:", error)
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
    }

    // LOOKUP FIELDS (derived, read-only) - Show as informational pills
    if (isLookupField) {
      return (
        <div className={containerClassName} onPaste={handlePaste}>
          {showLabel && (
            <label className={`${labelClassName} flex items-center gap-2`}>
              {getFieldDisplayName(field)}
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
              compact={displayMode === 'compact' || displayMode === 'inline'}
            />
          ) : (
            <div className={readOnlyBoxClassName}>
              {value !== null && value !== undefined ? String(value) : "—"}
            </div>
          )}
        </div>
      )
    }

    // LINKED FIELDS (editable) - Show as editable with clear affordances
    // list and expanded both use non-compact (vertical list) display
    return (
      <>
        <div className={containerClassName} onPaste={handlePaste}>
          {showLabel && (
            <label className={labelClassName}>{getFieldDisplayName(field)}</label>
          )}
          {lookupConfig ? (
            <LookupFieldPicker
              field={field}
              value={value}
              onChange={onChange}
              config={lookupConfig}
              disabled={isReadOnly}
              placeholder={`Add ${getFieldDisplayName(field)}...`}
              onRecordClick={onLinkedRecordClick}
              onCreateRecord={lookupConfig.allowCreate ? handleCreateRecord : undefined}
              isLookupField={false}
              compact={displayMode === 'compact' || displayMode === 'inline'}
            />
          ) : (
            <div className={readOnlyBoxClassName}>
              Configure linked table in field settings
            </div>
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

  // Select fields
  if (field.type === "single_select" || field.type === "multi_select") {
    const choices = field.options?.choices || []
    const isMulti = field.type === "multi_select"

    return (
      <div className={containerClassName}>
        {showLabel && (
          <label className={`${labelClassName} flex items-center gap-2`}>
            {getFieldDisplayName(field)}
            {isVirtual && (
              <span title="Formula or lookup field">
                <Calculator className="h-3 w-3 text-gray-400" />
              </span>
            )}
          </label>
        )}
        <InlineSelectDropdown
          value={isMulti ? (Array.isArray(value) ? value : value ? [value] : []) : value}
          choices={choices}
          choiceColors={field.options?.choiceColors}
          fieldOptions={field.options}
          fieldType={field.type}
          fieldId={field.id}
          tableId={field.table_id}
          editable={!isReadOnly}
          canEditOptions={!isReadOnly} // If they can edit the field, they can edit options
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
    const dateValueForInput = value ? new Date(value).toISOString().split("T")[0] : ""
    // For display: use UK format (DD/MM/YYYY)
    const dateValueForDisplay = value ? formatDateUK(value, "—") : ""

    if (isEditing && !isReadOnly) {
      return (
        <div className={containerClassName}>
          {showLabel && <label className={labelClassName}>{getFieldDisplayName(field)}</label>}
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
            {getFieldDisplayName(field)}
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
            className={`${displayBoxClassName} ${!dateValueForDisplay ? "bg-white" : ""}`}
          >
            {dateValueForDisplay || <span className="text-gray-400 italic">Click to set date...</span>}
            {!isReadOnly && (
              <Pencil className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-1/2 -translate-y-1/2" />
            )}
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
            {getFieldDisplayName(field)}
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

  // Long text — field grows with content; no internal scroll (scroll lives on record container only).
  if (field.type === "long_text") {
    const longTextContainerClass = cn("flex flex-col", containerClassName)
    if (isEditing && !isReadOnly) {
      return (
        <div className={longTextContainerClass}>
          {showLabel && <label className={cn(labelClassName, "flex-shrink-0 flex items-center gap-2")}>{getFieldDisplayName(field)}</label>}
          <div className="overflow-visible">
            <RichTextEditor
              value={localValue ?? ""}
              onChange={handleChange}
              onBlur={handleBlur}
              editable={true}
              showToolbar={true}
              minHeight="240px"
              className="overflow-visible"
            />
          </div>
        </div>
      )
    }

    return (
      <div className={longTextContainerClass}>
        {showLabel && (
          <label className={cn(labelClassName, "flex-shrink-0 flex items-center gap-2")}>
            {getFieldDisplayName(field)}
            {isVirtual && (
              <span title="Formula or lookup field">
                <Calculator className="h-3 w-3 text-gray-400" />
              </span>
            )}
          </label>
        )}
        {isReadOnly ? (
          <div className={cn("overflow-visible", readOnlyBoxClassName)}>
            {value ? (
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: value }}
              />
            ) : (
              <span className="italic">—</span>
            )}
          </div>
        ) : (
          <div
            onClick={onEditStart}
            className={cn("overflow-visible min-h-[40px]", displayBoxClassName, !value && "bg-white")}
          >
            {value ? (
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: value }}
              />
            ) : (
              <span className="text-gray-400 italic">Click to add text...</span>
            )}
            {!isReadOnly && (
              <Pencil className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-1/2 -translate-y-1/2" />
            )}
          </div>
        )}
      </div>
    )
  }

  // Attachment fields
  if (field.type === "attachment") {
    const attachments: Attachment[] = Array.isArray(value) ? value : value ? [value] : []
    
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
            {getFieldDisplayName(field)}
            {isVirtual && (
              <span title="Formula or lookup field">
                <Calculator className="h-3 w-3 text-gray-400" />
              </span>
            )}
          </label>
        )}
        <div
          onClick={(e) => {
            if (isReadOnly) return
            // Don't force edit mode when user is just previewing an attachment.
            if ((e.target as HTMLElement).closest('[data-attachment-preview]')) return
            onEditStart()
          }}
          className={
            isReadOnly
              ? `${readOnlyBoxClassName} ${attachments.length > 0 ? "not-italic" : ""}`
              : `${displayBoxClassName} ${showLabel ? "min-h-[48px] flex items-center" : ""} ${attachments.length === 0 ? "bg-white" : ""}`
          }
          role={!isReadOnly ? "button" : undefined}
          tabIndex={!isReadOnly ? 0 : undefined}
          onKeyDown={(e) => {
            if (isReadOnly) return
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onEditStart()
            }
          }}
        >
          {attachments.length > 0 ? (
            <div data-attachment-preview>
              <AttachmentPreview
                attachments={attachments}
                maxVisible={5}
                size="medium"
                displayStyle={field.options?.attachment_display_style || 'thumbnails'}
              />
            </div>
          ) : (
            <div className={`flex items-center gap-2 ${isReadOnly ? (showLabel ? "" : "text-gray-400 italic") : "text-gray-400"}`}>
              <Paperclip className="h-4 w-4" />
              {isReadOnly ? "No attachments" : <span className="text-gray-400 italic">Click to add attachments...</span>}
              {!isReadOnly && (
                <Pencil className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
              )}
            </div>
          )}
        </div>
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
          {showLabel && <label className={labelClassName}>{getFieldDisplayName(field)}</label>}
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
            {getFieldDisplayName(field)}
            {isVirtual && (
              <span title="Formula or lookup field">
                <Calculator className="h-3 w-3 text-gray-400" />
              </span>
            )}
          </label>
        )}
        {isReadOnly ? (
          <div className={`${readOnlyBoxClassName} ${showLabel ? "min-h-[36px] flex items-center" : ""}`}>
            {value ? (
              <a
                href={getFullUrl(value)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
              >
                {formatUrl(value)}
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
            {value ? (
              <a
                href={getFullUrl(value)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
              >
                {formatUrl(value)}
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </a>
            ) : (
              <span className="text-gray-400 italic">Click to edit...</span>
            )}
            {!isReadOnly && (
              <Pencil className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-1/2 -translate-y-1/2" />
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
          {showLabel && <label className={labelClassName}>{getFieldDisplayName(field)}</label>}
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
            {getFieldDisplayName(field)}
            {isVirtual && (
              <span title="Formula or lookup field">
                <Calculator className="h-3 w-3 text-gray-400" />
              </span>
            )}
          </label>
        )}
        {isReadOnly ? (
          <div className={`${readOnlyBoxClassName} ${showLabel ? "min-h-[36px] flex items-center gap-1" : "flex items-center gap-1"}`}>
            {value ? (
              <>
                <Mail className="h-3 w-3 text-gray-400 flex-shrink-0" />
                <a
                  href={`mailto:${value}`}
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  {value}
                </a>
              </>
            ) : (
              "—"
            )}
          </div>
        ) : (
          <div
            onClick={onEditStart}
            className={`${displayBoxClassName} ${showLabel ? "min-h-[36px] flex items-center" : "flex items-center"} ${!value ? "bg-white" : ""}`}
            title={value || undefined}
          >
            {value ? (
              <>
                <Mail className="h-3 w-3 text-gray-400 flex-shrink-0" />
                <a
                  href={`mailto:${value}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  {value}
                </a>
              </>
            ) : (
              <span className="text-gray-400 italic">Click to edit...</span>
            )}
            {!isReadOnly && (
              <Pencil className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-1/2 -translate-y-1/2" />
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
        {showLabel && <label className={labelClassName}>{getFieldDisplayName(field)}</label>}
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
          placeholder={`Enter ${getFieldDisplayName(field)}...`}
        />
      </div>
    )
  }

  return (
    <div className={containerClassName}>
      {showLabel && (
        <label className={`${labelClassName} flex items-center gap-2`}>
          {getFieldDisplayName(field)}
          {isVirtual && (
            <span title="Formula or lookup field">
              <Calculator className="h-3 w-3 text-gray-400" />
            </span>
          )}
        </label>
      )}
      {isReadOnly ? (
        <div className={readOnlyBoxClassName}>
          {isUserFieldType && userDisplayName ? (
            userDisplayName
          ) : value !== null && value !== undefined ? (
            String(value)
          ) : (
            "—"
          )}
          {field.type === "formula" && field.options?.formula && (
            <div className="text-xs text-gray-500 mt-1 font-mono">
              = {field.options.formula}
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={onEditStart}
          className={`${displayBoxClassName} ${showLabel ? "min-h-[36px] flex items-center" : ""} ${!value ? "bg-white" : ""}`}
        >
          {isUserFieldType && userDisplayName ? (
            userDisplayName
          ) : value !== null && value !== undefined ? (
            String(value)
          ) : (
            <span className="text-gray-400 italic">Click to edit...</span>
          )}
          {!isReadOnly && (
            <Pencil className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-1/2 -translate-y-1/2" />
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
      <label className="block text-sm font-medium text-gray-700">{getFieldDisplayName(field)}</label>
      
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

