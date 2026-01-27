"use client"

import { Label } from "@/components/ui/label"
import type { BlockConfig } from "@/lib/interface/types"
import type { Table, TableField } from "@/types/database"
import TableSelector from "./shared/TableSelector"
import GroupBySelector from "./shared/GroupBySelector"
import BlockFilterEditor from "./BlockFilterEditor"
import SortSelector from "./shared/SortSelector"

interface HorizontalGroupedDataSettingsProps {
  config: BlockConfig
  tables: Table[]
  fields: TableField[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
}

export default function HorizontalGroupedDataSettings({
  config,
  tables,
  fields,
  onUpdate,
  onTableChange,
}: HorizontalGroupedDataSettingsProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Table *</Label>
        <TableSelector
          value={config.table_id || ""}
          onChange={onTableChange}
          tables={tables}
          placeholder="Select a table"
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
              sorts={config.sorts || []}
              fields={fields}
              onChange={(sorts) => onUpdate({ sorts })}
            />
          </div>
        </>
      )}
    </div>
  )
}
