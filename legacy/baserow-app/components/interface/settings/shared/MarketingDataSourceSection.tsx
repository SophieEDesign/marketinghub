"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { BlockConfig } from "@/lib/interface/types"
import type { Table, View } from "@/types/database"
import TableSelector from "./TableSelector"
import ViewSelector from "./ViewSelector"

interface MarketingDataSourceSectionProps {
  config: BlockConfig
  tables: Table[]
  views: View[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
  mockConfigKey: keyof BlockConfig
  legacyMockKey?: keyof BlockConfig
  showView?: boolean
  tableLabel?: string
}

export default function MarketingDataSourceSection({
  config,
  tables,
  views,
  onUpdate,
  onTableChange,
  mockConfigKey,
  legacyMockKey,
  showView = true,
  tableLabel = "Source table",
}: MarketingDataSourceSectionProps) {
  const mockOn =
    config[mockConfigKey] === true ||
    (legacyMockKey ? config[legacyMockKey] === true : false)

  return (
    <div className="space-y-4">
      <div className="p-3 bg-muted/30 border border-border/40 rounded-md">
        <p className="text-sm text-muted-foreground">
          Choose a source table to load live data. If none is selected, the block discovers tables
          by name (e.g. Content, Campaigns). Demo mode shows labelled sample data only.
        </p>
      </div>

      <TableSelector
        value={config.table_id || ""}
        onChange={async (tableId) => {
          await onTableChange(tableId)
          onUpdate({
            table_id: tableId || undefined,
            view_id: undefined,
          })
        }}
        tables={tables}
        required={false}
        label={tableLabel}
      />

      {showView && config.table_id ? (
        <ViewSelector
          value={config.view_id}
          onChange={(viewId) => onUpdate({ view_id: viewId })}
          views={views}
          tableId={config.table_id}
        />
      ) : null}

      <div className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
        <div className="space-y-0.5 pr-3">
          <Label htmlFor="mh-use-mock">Use demo data</Label>
          <p className="text-xs text-muted-foreground">
            Show sample data with a demo banner instead of live rows.
          </p>
        </div>
        <Switch
          id="mh-use-mock"
          checked={mockOn}
          onCheckedChange={(v) => {
            const updates: Partial<BlockConfig> = {
              [mockConfigKey]: v ? true : undefined,
            }
            if (legacyMockKey) {
              updates[legacyMockKey] = v ? true : undefined
            }
            onUpdate(updates)
          }}
        />
      </div>
    </div>
  )
}
