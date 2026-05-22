"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import type { BlockConfig } from "@/lib/interface/types"

interface KPISummaryDataSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig>) => void
}

export default function KPISummaryDataSettings({
  config,
  onUpdate,
}: KPISummaryDataSettingsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="kpi-summary-title">Block title</Label>
        <Input
          id="kpi-summary-title"
          value={config.title || ""}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Marketing Hub KPIs"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        KPI cards use mock data until connected to Supabase metrics tables.
      </p>
    </div>
  )
}
