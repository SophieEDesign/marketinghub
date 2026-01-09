"use client"

/**
 * Record View Left Panel Settings Component
 * 
 * Simplified configuration for record_view pages:
 * - Title field (required)
 * - Subtitle field (optional)
 * - Additional field (optional)
 * 
 * Settings are stored in: page.config.leftPanel
 */

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface RecordViewLeftPanelSettingsProps {
  tableId: string | null
  currentSettings?: {
    titleFieldId?: string | null
    subtitleFieldId?: string | null
    additionalFieldId?: string | null
  }
  onSettingsChange: (settings: {
    titleFieldId: string | null
    subtitleFieldId: string | null
    additionalFieldId: string | null
  }) => void
}

export default function RecordViewLeftPanelSettings({
  tableId,
  currentSettings,
  onSettingsChange,
}: RecordViewLeftPanelSettingsProps) {
  const [fields, setFields] = useState<TableField[]>([])
  const [loading, setLoading] = useState(false)
  const [titleFieldId, setTitleFieldId] = useState<string | null>(
    currentSettings?.titleFieldId || null
  )
  const [subtitleFieldId, setSubtitleFieldId] = useState<string | null>(
    currentSettings?.subtitleFieldId || null
  )
  const [additionalFieldId, setAdditionalFieldId] = useState<string | null>(
    currentSettings?.additionalFieldId || null
  )

  // Load fields from table
  useEffect(() => {
    if (!tableId) return

    async function loadFields() {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from("table_fields")
          .select("*")
          .eq("table_id", tableId)
          .order("order_index", { ascending: true })

        if (data) {
          setFields(data as TableField[])
        }
      } catch (error) {
        console.error("Error loading fields:", error)
      } finally {
        setLoading(false)
      }
    }

    loadFields()
  }, [tableId])

  // Notify parent of settings change
  const notifyChange = (
    title: string | null,
    subtitle: string | null,
    additional: string | null
  ) => {
    onSettingsChange({
      titleFieldId: title,
      subtitleFieldId: subtitle,
      additionalFieldId: additional,
    })
  }

  const handleTitleChange = (fieldId: string) => {
    setTitleFieldId(fieldId)
    notifyChange(fieldId, subtitleFieldId, additionalFieldId)
  }

  const handleSubtitleChange = (fieldId: string) => {
    const value = fieldId === "__none__" ? null : fieldId
    setSubtitleFieldId(value)
    notifyChange(titleFieldId, value, additionalFieldId)
  }

  const handleAdditionalChange = (fieldId: string) => {
    const value = fieldId === "__none__" ? null : fieldId
    setAdditionalFieldId(value)
    notifyChange(titleFieldId, subtitleFieldId, value)
  }

  if (!tableId) {
    return (
      <div className="p-4 text-sm text-gray-500">
        No table selected. Please select a table in page settings.
      </div>
    )
  }

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">Loading fields...</div>
  }

  if (fields.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500">
        No fields found in this table.
      </div>
    )
  }

  // Filter out already selected fields from other dropdowns
  const getAvailableFields = (excludeFieldId: string | null) => {
    return fields.filter(f => f.id !== excludeFieldId)
  }

  return (
    <div className="space-y-4">
      {/* Title Field */}
      <div>
        <Label className="text-sm font-medium">Title Field *</Label>
        <p className="text-xs text-gray-500 mt-1 mb-2">
          The primary field displayed for each record
        </p>
        <Select
          value={titleFieldId || ""}
          onValueChange={handleTitleChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select title field" />
          </SelectTrigger>
          <SelectContent>
            {fields.map((field) => (
              <SelectItem key={field.id} value={field.id}>
                {field.name} ({field.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Subtitle Field */}
      <div>
        <Label className="text-sm font-medium">Subtitle Field</Label>
        <p className="text-xs text-gray-500 mt-1 mb-2">
          Optional secondary field displayed below the title
        </p>
        <Select
          value={subtitleFieldId || "__none__"}
          onValueChange={(value) => handleSubtitleChange(value === "__none__" ? "" : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select subtitle field (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {getAvailableFields(titleFieldId).map((field) => (
              <SelectItem key={field.id} value={field.id}>
                {field.name} ({field.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Additional Field */}
      <div>
        <Label className="text-sm font-medium">Additional Field</Label>
        <p className="text-xs text-gray-500 mt-1 mb-2">
          Optional third field displayed below the subtitle
        </p>
        <Select
          value={additionalFieldId || "__none__"}
          onValueChange={handleAdditionalChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select additional field (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {getAvailableFields(
              titleFieldId === subtitleFieldId ? titleFieldId : null
            )
              .filter(f => f.id !== titleFieldId && f.id !== subtitleFieldId)
              .map((field) => (
                <SelectItem key={field.id} value={field.id}>
                  {field.name} ({field.type})
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
