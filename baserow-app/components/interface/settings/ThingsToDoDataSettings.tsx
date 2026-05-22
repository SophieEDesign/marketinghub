"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BlockConfig } from "@/lib/interface/types"

interface ThingsToDoDataSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig>) => void
}

export default function ThingsToDoDataSettings({
  config,
  onUpdate,
}: ThingsToDoDataSettingsProps) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-800">
          Work queue loads actionable rows from the Content table (tasks, reviews, due dates). Falls back to samples if loading fails.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ttd-title">Block title</Label>
        <Input
          id="ttd-title"
          value={config.title || ""}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Things To Do"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ttd-subtitle">Subtitle</Label>
        <Input
          id="ttd-subtitle"
          value={config.things_to_do_subtitle || ""}
          onChange={(e) => onUpdate({ things_to_do_subtitle: e.target.value })}
          placeholder="Tasks, reviews, approvals and actions in one place."
        />
      </div>

      <div className="space-y-2">
        <Label>Default view</Label>
        <Select
          value={config.things_to_do_default_view || "list"}
          onValueChange={(v) =>
            onUpdate({
              things_to_do_default_view: v as BlockConfig["things_to_do_default_view"],
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="list">List</SelectItem>
            <SelectItem value="board">Board</SelectItem>
            <SelectItem value="by-priority">By priority</SelectItem>
            <SelectItem value="by-campaign">By campaign</SelectItem>
            <SelectItem value="calendar">Calendar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Default grouping</Label>
        <Select
          value={config.things_to_do_default_grouping || "due-date"}
          onValueChange={(v) =>
            onUpdate({
              things_to_do_default_grouping: v as BlockConfig["things_to_do_default_grouping"],
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="due-date">Due date</SelectItem>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="campaign">Campaign</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Date range</Label>
        <Select
          value={config.things_to_do_date_range || "next_30_days"}
          onValueChange={(v) =>
            onUpdate({
              things_to_do_date_range: v as BlockConfig["things_to_do_date_range"],
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="this_week">This week</SelectItem>
            <SelectItem value="next_30_days">Next 30 days</SelectItem>
            <SelectItem value="this_quarter">This quarter</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ttd-max">Max items (optional)</Label>
        <Input
          id="ttd-max"
          type="number"
          min={0}
          value={config.things_to_do_max_items ?? ""}
          onChange={(e) => {
            const v = e.target.value
            onUpdate({
              things_to_do_max_items: v === "" ? undefined : Math.max(0, parseInt(v, 10) || 0),
            })
          }}
          placeholder="No limit"
        />
      </div>

      <div className="space-y-3 pt-2 border-t">
        <div className="flex items-center justify-between">
          <Label htmlFor="ttd-show-filters">Show filters</Label>
          <Switch
            id="ttd-show-filters"
            checked={config.things_to_do_show_filters !== false}
            onCheckedChange={(v) => onUpdate({ things_to_do_show_filters: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="ttd-quick-links">Show quick links</Label>
          <Switch
            id="ttd-quick-links"
            checked={config.things_to_do_show_quick_links !== false}
            onCheckedChange={(v) => onUpdate({ things_to_do_show_quick_links: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="ttd-show-stats">Show stats</Label>
          <Switch
            id="ttd-show-stats"
            checked={config.things_to_do_show_stats !== false}
            onCheckedChange={(v) => onUpdate({ things_to_do_show_stats: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="ttd-detail-panel">Show detail panel</Label>
          <Switch
            id="ttd-detail-panel"
            checked={config.things_to_do_enable_detail_panel !== false}
            onCheckedChange={(v) => onUpdate({ things_to_do_enable_detail_panel: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="ttd-compact">Compact mode</Label>
          <Switch
            id="ttd-compact"
            checked={config.things_to_do_compact_mode === true}
            onCheckedChange={(v) => onUpdate({ things_to_do_compact_mode: v })}
          />
        </div>
      </div>
    </div>
  )
}
