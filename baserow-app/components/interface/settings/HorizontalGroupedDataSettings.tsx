"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import type { BlockConfig, BlockSort } from "@/lib/interface/types"
import type { Table, TableField } from "@/types/database"
import TableSelector from "./shared/TableSelector"
import GroupBySelector from "./shared/GroupBySelector"
import BlockFilterEditor from "./BlockFilterEditor"
import SortSelector from "./shared/SortSelector"
import RecordViewFieldSettings from "./RecordViewFieldSettings"

interface HorizontalGroupedDataSettingsProps {
  config: BlockConfig
  tables: Table[]
  fields: TableField[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
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
            <GroupBySelector
              value={config.group_by_field}
              onChange={(fieldName) => onUpdate({ group_by_field: fieldName })}
              fields={fields}
              label="Group by *"
              description="Select a field to group records by (title or select field recommended)"
              placeholder="Select a grouping field"
            />
          </div>

          <div className="space-y-2">
            <Label>Record Fields</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Configure which fields appear in each record&apos;s canvas. You can drag and rearrange fields in edit mode.
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
