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

interface EventCalendarDataSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig>) => void
}

export default function EventCalendarDataSettings({
  config,
  onUpdate,
}: EventCalendarDataSettingsProps) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-muted/30 border border-border/40 rounded-md">
        <p className="text-sm text-muted-foreground">
          Events are loaded from the Content table where Content Type is Event.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ec-title">Block title</Label>
        <Input
          id="ec-title"
          value={config.title || ""}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Event Calendar"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ec-subtitle">Subtitle</Label>
        <Input
          id="ec-subtitle"
          value={config.event_calendar_subtitle || ""}
          onChange={(e) => onUpdate({ event_calendar_subtitle: e.target.value })}
          placeholder="Plan, manage and track marketing events…"
        />
      </div>

      <div className="space-y-2">
        <Label>Default view</Label>
        <Select
          value={config.event_calendar_default_view || "month"}
          onValueChange={(v) =>
            onUpdate({
              event_calendar_default_view: v as BlockConfig["event_calendar_default_view"],
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Month</SelectItem>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="list">List</SelectItem>
            <SelectItem value="timeline">Timeline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Density</Label>
        <Select
          value={config.event_calendar_density || "comfortable"}
          onValueChange={(v) =>
            onUpdate({
              event_calendar_density: v as BlockConfig["event_calendar_density"],
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="comfortable">Comfortable</SelectItem>
            <SelectItem value="compact">Compact</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 pt-2 border-t border-border/40">
        <p className="text-xs font-medium text-muted-foreground">Display</p>
        {(
          [
            ["event_calendar_show_toolbar", "Toolbar (views & date navigation)", true],
            ["event_calendar_show_filters", "Filter row", true],
            ["event_calendar_show_search", "Search", true],
            ["event_calendar_show_metrics", "Summary metrics", true],
            ["event_calendar_show_legend", "Event type legend", true],
            ["event_calendar_show_add_button", "Add event button", true],
            ["event_calendar_show_attendance_controls", "Attendance controls", true],
            ["event_calendar_show_schedule", "Schedule tab", true],
            ["event_calendar_show_resources", "Resources tab", true],
            ["event_calendar_show_notes", "Notes tab", true],
          ] as const
        ).map(([key, label, defaultOn]) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <Label htmlFor={key} className="text-sm font-normal">
              {label}
            </Label>
            <Switch
              id={key}
              checked={(config as Record<string, boolean | undefined>)[key] !== false}
              onCheckedChange={(v) => onUpdate({ [key]: v } as Partial<BlockConfig>)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
