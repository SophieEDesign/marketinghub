"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import BlockFilterEditor from "./BlockFilterEditor"
import TableSelector from "./shared/TableSelector"
import GroupBySelector from "./shared/GroupBySelector"
import SortSelector from "./shared/SortSelector"
import ModalFieldsSelector from "./shared/ModalFieldsSelector"

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
  views: _views,
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
  const groupBy = config.group_by || ""
  const blockFilters = Array.isArray(config.filters) ? config.filters : []
  const choiceGroupsDefaultCollapsed =
    (config as any)?.list_groups_default_collapsed ??
    (config as any)?.list_choice_groups_default_collapsed ??
    true

  // Keep the local table select in sync when config.table_id is hydrated/changed upstream.
  useEffect(() => {
    setSelectedTableId(config.table_id || "")
  }, [config.table_id])

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
    // IMPORTANT: Use null (not undefined) to clear persisted keys.
    // undefined is dropped by JSON.stringify and won't reach the server, so old values "stick".
    const value = fieldName === "__none__" ? null : fieldName
    onUpdate({
      list_title_field: value as any,
      title_field: value as any, // Backward compatibility
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
    // IMPORTANT: Use null (not undefined) to clear persisted keys.
    const value = fieldName === "__none__" ? null : fieldName
    onUpdate({
      list_image_field: value as any,
      image_field: value as any, // Backward compatibility
    })
  }

  const handlePillFieldAdd = (fieldName: string) => {
    if (fieldName && !pillFields.includes(fieldName)) {
      onUpdate({
        list_pill_fields: [...pillFields, fieldName].filter(Boolean),
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
        list_meta_fields: [...metaFields, fieldName].filter(Boolean),
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

  // Get groupable fields (not formula, not lookup)
  const groupableFields = fields.filter(
    (f) => f.type !== "formula" && f.type !== "lookup"
  )

  return (
    <div className="space-y-6">
      {/* Table Selection */}
      <TableSelector
        value={selectedTableId}
        onChange={handleTableChange}
        tables={tables}
        required={true}
      />

      {/* Title Field (Required) */}
      <div className="space-y-2">
        <Label>
          Title Field <span className="text-red-500">*</span>
        </Label>
        <Select value={titleField || "__none__"} onValueChange={handleTitleFieldChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select title field" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
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
          return (
            <div key={index} className="flex items-center gap-2">
              <Select
                value={fieldName || "__none__"}
                onValueChange={(newFieldName) => {
                  const updated = [...subtitleFields]
                  updated[index] = newFieldName === "__none__" ? "" : newFieldName
                  // Never persist empty placeholders
                  onUpdate({ list_subtitle_fields: updated.filter(Boolean) })
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
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
        <Select value={imageField || "__none__"} onValueChange={handleImageFieldChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select image field" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
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
          return (
            <div key={index} className="flex items-center gap-2">
              <Select
                value={fieldName || "__none__"}
                onValueChange={(newFieldName) => {
                  const updated = [...pillFields]
                  updated[index] = newFieldName === "__none__" ? "" : newFieldName
                  // Never persist empty placeholders
                  onUpdate({ list_pill_fields: updated.filter(Boolean) })
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
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
          return (
            <div key={index} className="flex items-center gap-2">
              <Select
                value={fieldName || "__none__"}
                onValueChange={(newFieldName) => {
                  const updated = [...metaFields]
                  updated[index] = newFieldName === "__none__" ? "" : newFieldName
                  // Never persist empty placeholders
                  onUpdate({ list_meta_fields: updated.filter(Boolean) })
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
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

      {/* Group By (Optional) */}
      {config.table_id && fields.length > 0 && (
        <GroupBySelector
          value={groupBy}
          onChange={(value) => {
            onUpdate({
              // Persist clear as null so the server actually receives it.
              group_by: value === undefined ? (null as any) : value,
            })
          }}
          fields={fields}
          filterGroupableFields={true}
        />
      )}

      {/* Sort (Optional) */}
      {config.table_id && fields.length > 0 && (
        <SortSelector
          value={Array.isArray(config.sorts) ? config.sorts : undefined}
          onChange={(sorts) => onUpdate({ sorts: sorts as any })}
          fields={fields}
          allowMultiple={false}
        />
      )}

      {/* Group Load Behavior */}
      {config.table_id && fields.length > 0 && groupBy && groupBy !== "__none__" && (
        <div className="space-y-2">
          <Label>Groups on load</Label>
          <Select
            value={choiceGroupsDefaultCollapsed ? "closed" : "open"}
            onValueChange={(value) => {
              const closed = value === "closed"
              // Prefer the new key, but also write the legacy key for backward compatibility.
              onUpdate({
                list_groups_default_collapsed: closed,
                list_choice_groups_default_collapsed: closed,
              } as any)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="closed">Closed (collapsed)</SelectItem>
              <SelectItem value="open">Open (expanded)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">
            Control whether grouped sections start expanded or collapsed when the list loads.
          </p>
        </div>
      )}

      {/* Filters (Optional) */}
      {config.table_id && fields.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          <BlockFilterEditor
            filters={blockFilters}
            tableFields={fields}
            config={config}
            onChange={(filters) => onUpdate({ filters })}
            onConfigUpdate={(updates) => onUpdate(updates)}
          />
        </div>
      )}

      {/* Modal Fields (Optional) */}
      {config.table_id && fields.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          <ModalFieldsSelector
            value={(config as any).modal_fields || []}
            onChange={(fieldNames) => onUpdate({ modal_fields: fieldNames } as any)}
            fields={fields}
            label="Fields to Show in Record Modal"
            description="Choose which fields appear when creating or editing a record. Leave empty to show all fields."
          />
        </div>
      )}
    </div>
  )
}
