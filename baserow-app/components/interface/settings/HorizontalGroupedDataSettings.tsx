"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Edit2, Check, X } from "lucide-react"
import type { BlockConfig, BlockSort } from "@/lib/interface/types"
import type { Table, TableField } from "@/types/database"
import TableSelector from "./shared/TableSelector"
import NestedGroupBySelector from "./shared/NestedGroupBySelector"
import BlockFilterEditor from "./BlockFilterEditor"
import SortSelector from "./shared/SortSelector"
import RecordViewFieldSettings from "./RecordViewFieldSettings"

interface HorizontalGroupedDataSettingsProps {
  config: BlockConfig
  tables: Table[]
  fields: TableField[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
  onEditCanvas?: () => void // Callback to enter canvas edit mode
  isEditingCanvas?: boolean // Whether canvas is currently being edited
  onExitBlockCanvas?: () => void // Callback to exit canvas edit mode
}

interface FieldConfig {
  field: string
  editable: boolean
  order?: number
}

export default function HorizontalGroupedDataSettings({
  config,
  tables,
  fields,
  onUpdate,
  onTableChange,
  onEditCanvas,
  isEditingCanvas = false,
  onExitBlockCanvas,
}: HorizontalGroupedDataSettingsProps) {
  const [recordFields, setRecordFields] = useState<FieldConfig[]>(
    (config.record_fields as FieldConfig[]) || []
  )

  useEffect(() => {
    setRecordFields((config.record_fields as FieldConfig[]) || [])
  }, [config.record_fields])

  const handleRecordFieldsChange = (newFields: FieldConfig[]) => {
    setRecordFields(newFields)
    onUpdate({ record_fields: newFields })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Table *</Label>
        <TableSelector
          value={config.table_id || ""}
          onChange={onTableChange}
          tables={tables}
        />
      </div>

      {config.table_id && fields.length > 0 && (
        <>
          <div className="space-y-2">
            <NestedGroupBySelector
              value={config.group_by_field}
              groupByRules={(config as any).group_by_rules}
              onChange={(value) => {
                onUpdate({
                  group_by_field: value,
                  group_by: value,
                  // Clear group_by_rules if using legacy single field
                  ...(value ? {} : { group_by_rules: null }),
                } as any)
              }}
              onRulesChange={(rules) => {
                onUpdate({
                  group_by_rules: rules,
                  // For backward compatibility, also set group_by_field to first rule's field
                  group_by_field: rules && rules.length > 0 && rules[0].type === 'field' ? rules[0].field : null,
                  group_by: rules && rules.length > 0 && rules[0].type === 'field' ? rules[0].field : null,
                } as any)
              }}
              fields={fields}
              filterGroupableFields={true}
              label="Group by *"
              description="Add up to 2 grouping levels to group records into nested sections. Each group appears as a separate tab."
            />
          </div>

          {/* Group Load Behavior */}
          {((config as any).group_by_field || (config as any).group_by) && (config as any).group_by !== "__none__" && (
            <div className="space-y-2">
              <Label>Groups on load</Label>
              <Select
                value={
                  ((config as any)?.horizontal_groups_default_collapsed ?? true)
                    ? "closed"
                    : "open"
                }
                onValueChange={(value) => {
                  const closed = value === "closed"
                  onUpdate({
                    horizontal_groups_default_collapsed: closed,
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
                Control whether grouped sections start expanded or collapsed when the view loads.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Record Fields</Label>
              {onEditCanvas && (
                <Button
                  variant={isEditingCanvas ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    if (isEditingCanvas && onExitBlockCanvas) {
                      // If already editing, exit and save
                      onExitBlockCanvas()
                    } else if (onEditCanvas) {
                      // Enter edit mode
                      onEditCanvas()
                    }
                  }}
                  className="h-7"
                >
                  {isEditingCanvas ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Done Editing
                    </>
                  ) : (
                    <>
                      <Edit2 className="h-3 w-3 mr-1" />
                      Edit Canvas
                    </>
                  )}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Configure which fields appear in each record&apos;s canvas. Click &quot;Edit Canvas&quot; to drag and rearrange fields.
            </p>
            <RecordViewFieldSettings
              tableId={config.table_id}
              fields={recordFields}
              allFields={fields}
              onChange={handleRecordFieldsChange}
            />
          </div>

          <div className="space-y-2">
            <Label>Filters</Label>
            <BlockFilterEditor
              filters={config.filters || []}
              tableFields={fields}
              onChange={(filters) => onUpdate({ filters })}
              config={config}
              onConfigUpdate={onUpdate}
            />
          </div>

          <div className="space-y-2">
            <SortSelector
              value={config.sorts || []}
              fields={fields}
              onChange={(sorts) => onUpdate({ sorts: sorts as BlockSort[] })}
            />
          </div>
        </>
      )}
    </div>
  )
}
