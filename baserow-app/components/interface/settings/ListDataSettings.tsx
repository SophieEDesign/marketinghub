"use client"

import { useState } from "react"
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
  const choiceGroupsDefaultCollapsed = (config as any)?.list_choice_groups_default_collapsed ?? true

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
    const value = fieldName === "__none__" ? undefined : fieldName
    onUpdate({
      list_title_field: value || undefined,
      title_field: value || undefined, // Backward compatibility
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
    const value = fieldName === "__none__" ? undefined : fieldName
    onUpdate({
      list_image_field: value || undefined,
      image_field: value || undefined, // Backward compatibility
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

  // Get groupable fields (not formula, not lookup)
  const groupableFields = fields.filter(
    (f) => f.type !== "formula" && f.type !== "lookup"
  )

  // Get operators for field type
  const getOperatorsForFieldType = (fieldType: string) => {
    switch (fieldType) {
      case "text":
      case "long_text":
        return [
          { value: "equal", label: "Equals" },
          { value: "not_equal", label: "Not equals" },
          { value: "contains", label: "Contains" },
          { value: "not_contains", label: "Does not contain" },
          { value: "is_empty", label: "Is empty" },
          { value: "is_not_empty", label: "Is not empty" },
        ]
      case "number":
      case "currency":
      case "percent":
        return [
          { value: "equal", label: "Equals" },
          { value: "not_equal", label: "Not equals" },
          { value: "greater_than", label: "Greater than" },
          { value: "less_than", label: "Less than" },
          { value: "is_empty", label: "Is empty" },
          { value: "is_not_empty", label: "Is not empty" },
        ]
      case "date":
        return [
          { value: "equal", label: "Equals" },
          { value: "greater_than", label: "After" },
          { value: "less_than", label: "Before" },
          { value: "is_empty", label: "Is empty" },
          { value: "is_not_empty", label: "Is not empty" },
        ]
      case "single_select":
      case "multi_select":
        return [
          { value: "equal", label: "Is" },
          { value: "not_equal", label: "Is not" },
          { value: "is_empty", label: "Is empty" },
          { value: "is_not_empty", label: "Is not empty" },
        ]
      case "checkbox":
        return [
          { value: "equal", label: "Is checked" },
          { value: "not_equal", label: "Is unchecked" },
        ]
      default:
        return [
          { value: "equal", label: "Equals" },
          { value: "not_equal", label: "Not equals" },
          { value: "is_empty", label: "Is empty" },
          { value: "is_not_empty", label: "Is not empty" },
        ]
    }
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
                  onUpdate({ list_subtitle_fields: updated })
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
                  onUpdate({ list_pill_fields: updated })
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
                  onUpdate({ list_meta_fields: updated })
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
        <div className="space-y-2">
          <Label>Group By (Optional)</Label>
          <Select
            value={groupBy || "__none__"}
            onValueChange={(value) => {
              onUpdate({
                group_by: value === "__none__" ? undefined : value,
              })
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a field to group by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No grouping</SelectItem>
              {groupableFields.map((field) => (
                <SelectItem key={field.id} value={field.name}>
                  {field.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">
            Group records by a field value. Records with the same value will be grouped together.
          </p>
        </div>
      )}

      {/* Choice Group Load Behavior */}
      {config.table_id && fields.length > 0 && groupBy && groupBy !== "__none__" && (() => {
        const groupField = fields.find(f => f.name === groupBy || f.id === groupBy)
        const isChoice = groupField && (groupField.type === 'single_select' || groupField.type === 'multi_select')
        if (!isChoice) return null
        return (
          <div className="space-y-2">
            <Label>Choice options on load</Label>
            <Select
              value={choiceGroupsDefaultCollapsed ? "closed" : "open"}
              onValueChange={(value) => {
                onUpdate({ list_choice_groups_default_collapsed: value === "closed" } as any)
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
              When grouping by a choice field, control whether all choice groups start expanded or collapsed.
            </p>
          </div>
        )
      })()}

      {/* Filters (Optional) */}
      {config.table_id && fields.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Filters (Optional)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onUpdate({
                  filters: [
                    ...blockFilters,
                    { field: fields[0]?.name || '', operator: 'equal', value: '' }
                  ]
                })
              }}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Filter
            </Button>
          </div>
          <div className="space-y-2">
            {blockFilters.map((filter: any, index: number) => {
              const selectedField = fields.find(f => f.name === filter.field)
              const operators = selectedField ? getOperatorsForFieldType(selectedField.type) : []
              
              return (
                <div key={index} className="flex gap-2 items-start p-2 border rounded-md">
                  <Select
                    value={filter.field || ''}
                    onValueChange={(value) => {
                      const updated = [...blockFilters]
                      updated[index] = { ...updated[index], field: value, operator: 'equal', value: '' }
                      onUpdate({ filters: updated })
                    }}
                  >
                    <SelectTrigger className="h-8 flex-1">
                      <SelectValue placeholder="Field" />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map((field) => (
                        <SelectItem key={field.id} value={field.name}>
                          {field.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={filter.operator || 'equal'}
                    onValueChange={(value) => {
                      const updated = [...blockFilters]
                      updated[index] = { 
                        ...updated[index], 
                        operator: value as 'equal' | 'not_equal' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty'
                      }
                      onUpdate({ filters: updated })
                    }}
                  >
                    <SelectTrigger className="h-8 w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {filter.operator !== 'is_empty' && filter.operator !== 'is_not_empty' && (() => {
                    // For single_select or multi_select fields, show dropdown with choices
                    if (selectedField && (selectedField.type === 'single_select' || selectedField.type === 'multi_select')) {
                      const choices = selectedField.options?.choices || []
                      return (
                        <Select
                          value={filter.value || ''}
                          onValueChange={(value) => {
                            const updated = [...blockFilters]
                            updated[index] = { ...updated[index], value }
                            onUpdate({ filters: updated })
                          }}
                        >
                          <SelectTrigger className="h-8 flex-1">
                            <SelectValue placeholder="Select value" />
                          </SelectTrigger>
                          <SelectContent>
                            {choices.length > 0 ? (
                              choices.map((choice: string) => (
                                <SelectItem key={choice} value={choice}>
                                  {choice}
                                </SelectItem>
                              ))
                            ) : (
                              <div className="px-2 py-1.5 text-sm text-gray-500">No options available</div>
                            )}
                          </SelectContent>
                        </Select>
                      )
                    }
                    
                    // For date fields, show date input
                    if (selectedField?.type === 'date') {
                      return (
                        <Input
                          type="date"
                          value={filter.value || ''}
                          onChange={(e) => {
                            const updated = [...blockFilters]
                            updated[index] = { ...updated[index], value: e.target.value }
                            onUpdate({ filters: updated })
                          }}
                          className="h-8 flex-1"
                        />
                      )
                    }
                    
                    // For other field types, show regular text input
                    return (
                      <Input
                        value={filter.value || ''}
                        onChange={(e) => {
                          const updated = [...blockFilters]
                          updated[index] = { ...updated[index], value: e.target.value }
                          onUpdate({ filters: updated })
                        }}
                        placeholder="Value"
                        className="h-8 flex-1"
                      />
                    )
                  })()}
                  {(filter.operator === 'is_empty' || filter.operator === 'is_not_empty') && (
                    <div className="h-8 flex-1 flex items-center text-xs text-gray-500 px-2">
                      No value needed
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onUpdate({ filters: blockFilters.filter((_: any, i: number) => i !== index) })
                    }}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
            {blockFilters.length === 0 && (
              <p className="text-xs text-gray-400 italic">No filters configured</p>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Filter records by field values. Supports equals, contains, comparison, and empty checks.
          </p>
        </div>
      )}
    </div>
  )
}
