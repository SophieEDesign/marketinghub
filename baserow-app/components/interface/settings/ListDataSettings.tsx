"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X, Plus } from "lucide-react"
import type { BlockConfig } from "@/lib/interface/types"
import type { Table, View, TableField } from "@/types/database"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

interface ListDataSettingsProps {
  config: BlockConfig
  tables: Table[]
  views: View[]
  fields: TableField[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
}

export default function ListDataSettings({
  config,
  tables,
  views,
  fields,
  onUpdate,
  onTableChange,
}: ListDataSettingsProps) {
  const [selectedTableId, setSelectedTableId] = useState<string>(config.table_id || "")

  // List-specific field configuration
  const titleField = config.list_title_field || config.title_field || ""
  const subtitleFields = config.list_subtitle_fields || []
  const imageField = config.list_image_field || config.image_field || ""
  const pillFields = config.list_pill_fields || []
  const metaFields = config.list_meta_fields || []

  // Get available fields for selection
  const textFields = fields.filter(f => f.type === 'text' || f.type === 'long_text')
  const allFields = fields
  const selectFields = fields.filter(f => f.type === 'single_select' || f.type === 'multi_select')
  const attachmentFields = fields.filter(f => f.type === 'attachment')
  const dateFields = fields.filter(f => f.type === 'date')
  const numberFields = fields.filter(f => f.type === 'number' || f.type === 'percent' || f.type === 'currency')

  const handleTableChange = async (tableId: string) => {
    setSelectedTableId(tableId)
    await onTableChange(tableId)
    onUpdate({ table_id: tableId })
  }

  const handleTitleFieldChange = (fieldName: string) => {
    onUpdate({
      list_title_field: fieldName || undefined,
      title_field: fieldName || undefined, // Backward compatibility
    })
  }

  const handleSubtitleFieldAdd = (fieldName: string) => {
    if (fieldName && !subtitleFields.includes(fieldName) && subtitleFields.length < 3) {
      onUpdate({
        list_subtitle_fields: [...subtitleFields, fieldName],
      })
    }
  }

  const handleSubtitleFieldRemove = (index: number) => {
    onUpdate({
      list_subtitle_fields: subtitleFields.filter((_, i) => i !== index),
    })
  }

  const handleImageFieldChange = (fieldName: string) => {
    onUpdate({
      list_image_field: fieldName || undefined,
      image_field: fieldName || undefined, // Backward compatibility
    })
  }

  const handlePillFieldAdd = (fieldName: string) => {
    if (fieldName && !pillFields.includes(fieldName)) {
      onUpdate({
        list_pill_fields: [...pillFields, fieldName],
      })
    }
  }

  const handlePillFieldRemove = (index: number) => {
    onUpdate({
      list_pill_fields: pillFields.filter((_, i) => i !== index),
    })
  }

  const handleMetaFieldAdd = (fieldName: string) => {
    if (fieldName && !metaFields.includes(fieldName)) {
      onUpdate({
        list_meta_fields: [...metaFields, fieldName],
      })
    }
  }

  const handleMetaFieldRemove = (index: number) => {
    onUpdate({
      list_meta_fields: metaFields.filter((_, i) => i !== index),
    })
  }

  // Get available fields for subtitle (exclude title field)
  const getAvailableSubtitleFields = () => {
    return allFields.filter(f => f.name !== titleField)
  }

  // Get available fields for pills (only select fields, exclude already selected)
  const getAvailablePillFields = () => {
    return selectFields.filter(f => !pillFields.includes(f.name))
  }

  // Get available fields for meta (date, number, exclude already selected)
  const getAvailableMetaFields = () => {
    return [...dateFields, ...numberFields].filter(f => !metaFields.includes(f.name))
  }

  return (
    <div className="space-y-6">
      {/* Table Selection */}
      <div className="space-y-2">
        <Label>Table</Label>
        <Select value={selectedTableId} onValueChange={handleTableChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a table" />
          </SelectTrigger>
          <SelectContent>
            {tables.map((table) => (
              <SelectItem key={table.id} value={table.id}>
                {table.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Title Field (Required) */}
      <div className="space-y-2">
        <Label>
          Title Field <span className="text-red-500">*</span>
        </Label>
        <Select value={titleField} onValueChange={handleTitleFieldChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select title field" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            {textFields.map((field) => (
              <SelectItem key={field.id} value={field.name}>
                {field.name}
              </SelectItem>
            ))}
            {/* Fallback: show all fields if no text fields */}
            {textFields.length === 0 && allFields.map((field) => (
              <SelectItem key={field.id} value={field.name}>
                {field.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          The primary field displayed as the list item title
        </p>
      </div>

      {/* Subtitle Fields (Optional, up to 3) */}
      <div className="space-y-2">
        <Label>Subtitle Fields (Optional, up to 3)</Label>
        {subtitleFields.map((fieldName, index) => {
          const field = fields.find(f => f.name === fieldName)
          return (
            <div key={index} className="flex items-center gap-2">
              <Select
                value={fieldName}
                onValueChange={(newFieldName) => {
                  const updated = [...subtitleFields]
                  updated[index] = newFieldName
                  onUpdate({ list_subtitle_fields: updated })
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {getAvailableSubtitleFields().map((f) => (
                    <SelectItem key={f.id} value={f.name}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleSubtitleFieldRemove(index)}
                className="flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )
        })}
        {subtitleFields.length < 3 && (
          <Select
            value=""
            onValueChange={handleSubtitleFieldAdd}
          >
            <SelectTrigger>
              <SelectValue placeholder="Add subtitle field" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Select a field</SelectItem>
              {getAvailableSubtitleFields().map((field) => (
                <SelectItem key={field.id} value={field.name}>
                  {field.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <p className="text-xs text-gray-500">
          Additional fields displayed below the title (1-3 fields)
        </p>
      </div>

      {/* Image Field (Optional) */}
      <div className="space-y-2">
        <Label>Image Field (Optional)</Label>
        <Select value={imageField} onValueChange={handleImageFieldChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select image field" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            {attachmentFields.map((field) => (
              <SelectItem key={field.id} value={field.name}>
                {field.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          Field containing images/attachments to display as thumbnails
        </p>
      </div>

      {/* Pill Fields (Optional) */}
      <div className="space-y-2">
        <Label>Pill Fields (Optional)</Label>
        {pillFields.map((fieldName, index) => {
          const field = fields.find(f => f.name === fieldName)
          return (
            <div key={index} className="flex items-center gap-2">
              <Select
                value={fieldName}
                onValueChange={(newFieldName) => {
                  const updated = [...pillFields]
                  updated[index] = newFieldName
                  onUpdate({ list_pill_fields: updated })
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {selectFields.map((f) => (
                    <SelectItem key={f.id} value={f.name}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handlePillFieldRemove(index)}
                className="flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )
        })}
        <Select
          value=""
          onValueChange={handlePillFieldAdd}
        >
          <SelectTrigger>
            <SelectValue placeholder="Add pill field" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Select a field</SelectItem>
            {getAvailablePillFields().map((field) => (
              <SelectItem key={field.id} value={field.name}>
                {field.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          Select/multi-select fields displayed as colored pills
        </p>
      </div>

      {/* Meta Fields (Optional) */}
      <div className="space-y-2">
        <Label>Meta Fields (Optional)</Label>
        {metaFields.map((fieldName, index) => {
          const field = fields.find(f => f.name === fieldName)
          return (
            <div key={index} className="flex items-center gap-2">
              <Select
                value={fieldName}
                onValueChange={(newFieldName) => {
                  const updated = [...metaFields]
                  updated[index] = newFieldName
                  onUpdate({ list_meta_fields: updated })
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {[...dateFields, ...numberFields].map((f) => (
                    <SelectItem key={f.id} value={f.name}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleMetaFieldRemove(index)}
                className="flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )
        })}
        <Select
          value=""
          onValueChange={handleMetaFieldAdd}
        >
          <SelectTrigger>
            <SelectValue placeholder="Add meta field" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Select a field</SelectItem>
            {getAvailableMetaFields().map((field) => (
              <SelectItem key={field.id} value={field.name}>
                {field.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          Date or number fields displayed as metadata
        </p>
      </div>
    </div>
  )
}
