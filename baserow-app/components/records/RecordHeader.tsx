"use client"

import { useState, useRef, useEffect } from "react"
import { Copy, Trash2, Copy as CopyIcon } from "lucide-react"
import { formatDateUK } from "@/lib/utils"
import type { TableField } from "@/types/fields"

interface RecordHeaderProps {
  record: Record<string, any> | null
  tableName: string
  fields: TableField[]
  formData: Record<string, any>
  onFieldChange: (fieldName: string, value: any) => void
  onSave: () => void
  onDelete: () => void
  onDuplicate: () => void
  onCopyLink: () => void
  saving: boolean
  hasChanges: boolean
  loading: boolean
}

export default function RecordHeader({
  record,
  tableName,
  fields,
  formData,
  onFieldChange,
  onSave,
  onDelete,
  onDuplicate,
  onCopyLink,
  saving,
  hasChanges,
  loading,
}: RecordHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameValue, setNameValue] = useState("")
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Find primary name field (priority: "name" > "title" > "subject" > first text field excluding "id")
  const primaryNameField = fields.find(
    (f) => f.type === "text" && f.name.toLowerCase() === "name"
  ) || fields.find(
    (f) =>
      f.type === "text" &&
      (f.name.toLowerCase() === "title" ||
        f.name.toLowerCase() === "subject")
  ) || fields.find((f) => f.type === "text" && f.name.toLowerCase() !== "id") || fields.find((f) => f.type === "text")

  const recordName = primaryNameField
    ? formData[primaryNameField.name] || ""
    : "Untitled"

  useEffect(() => {
    setNameValue(String(recordName || ""))
  }, [recordName])

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [isEditingName])

  const handleNameSave = () => {
    if (primaryNameField) {
      onFieldChange(primaryNameField.name, nameValue)
    }
    setIsEditingName(false)
  }

  const handleNameCancel = () => {
    setNameValue(String(recordName || ""))
    setIsEditingName(false)
  }

  // Find status field (single_select or checkbox field named "status", "state", etc.)
  const statusField = fields.find(
    (f) =>
      (f.type === "single_select" || f.type === "checkbox") &&
      (f.name.toLowerCase() === "status" ||
        f.name.toLowerCase() === "state" ||
        f.name.toLowerCase() === "stage")
  )

  const statusValue = statusField ? formData[statusField.name] : null

  // Get created/modified metadata (UK format: DD/MM/YYYY)
  const createdAt = record?.created_at
    ? formatDateUK(record.created_at)
    : null

  const updatedAt = record?.updated_at
    ? formatDateUK(record.updated_at)
    : null

  if (loading) {
    return (
      <div className="h-24 border-b border-gray-200 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="border-b border-gray-200 bg-white">
      {/* Primary Name */}
      <div className="px-6 py-4">
        {isEditingName && primaryNameField ? (
          <div className="flex items-center gap-2">
            <input
              ref={nameInputRef}
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleNameSave()
                } else if (e.key === "Escape") {
                  handleNameCancel()
                }
              }}
              onBlur={handleNameSave}
              className="flex-1 text-2xl font-semibold text-gray-900 border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
              placeholder="Record name"
            />
          </div>
        ) : (
          <h1
            className={`text-2xl font-semibold text-gray-900 flex-1 min-w-0 truncate ${
              primaryNameField ? "cursor-text hover:bg-gray-50 -mx-2 px-2 py-1 rounded-md transition-colors" : ""
            }`}
            onClick={() => {
              if (primaryNameField) setIsEditingName(true)
            }}
            title={primaryNameField ? "Click to edit" : undefined}
          >
            {recordName || "Untitled"}
          </h1>
        )}

        {/* Status and Metadata Row */}
        <div className="flex items-center gap-4 mt-3">
          {/* Status Pill */}
          {statusField && statusValue && (
            <div
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                statusField.type === "checkbox"
                  ? statusValue
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-600"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {statusField.type === "checkbox"
                ? statusValue
                  ? "Active"
                  : "Inactive"
                : String(statusValue)}
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {createdAt && (
              <span>
                Created {createdAt}
                {updatedAt && updatedAt !== createdAt && ` • Updated ${updatedAt}`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
        <div />
        <div className="flex items-center gap-1">
          <button
            onClick={onDuplicate}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="Duplicate record"
          >
            <Copy className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={onCopyLink}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="Copy link"
          >
            <CopyIcon className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 hover:bg-red-100 rounded transition-colors"
            title="Delete record"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </button>
        </div>
      </div>
    </div>
  )
}

