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
import { CONTENT_TIMELINE_THEMES } from "@/lib/marketing/content-timeline"

interface ContentTimelineDataSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig>) => void
}

export default function ContentTimelineDataSettings({
  config,
  onUpdate,
}: ContentTimelineDataSettingsProps) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-800">
          Timeline loads from the Content table (rows with dates). Enable mock in block config only for demos.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ct-title">Block title</Label>
        <Input
          id="ct-title"
          value={config.title || ""}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Content Timeline"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ct-subtitle">Subtitle</Label>
        <Input
          id="ct-subtitle"
          value={config.content_timeline_subtitle || ""}
          onChange={(e) => onUpdate({ content_timeline_subtitle: e.target.value })}
          placeholder="Plan campaigns, posts, pages and marketing activity by theme."
        />
      </div>

      <div className="space-y-2">
        <Label>Default view</Label>
        <Select
          value={config.content_timeline_default_view || "quarter"}
          onValueChange={(v) =>
            onUpdate({
              content_timeline_default_view: v as BlockConfig["content_timeline_default_view"],
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Month</SelectItem>
            <SelectItem value="quarter">Quarter</SelectItem>
            <SelectItem value="year">Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Group by</Label>
        <Select
          value={config.content_timeline_group_by || "theme"}
          onValueChange={(v) =>
            onUpdate({
              content_timeline_group_by: v as BlockConfig["content_timeline_group_by"],
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="theme">Theme</SelectItem>
            <SelectItem value="channel">Channel</SelectItem>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Default theme filter</Label>
        <Select
          value={config.content_timeline_default_theme_filter || "none"}
          onValueChange={(v) =>
            onUpdate({
              content_timeline_default_theme_filter: v === "none" ? undefined : v,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {CONTENT_TIMELINE_THEMES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 pt-2 border-t">
        <div className="flex items-center justify-between">
          <Label htmlFor="ct-show-filters">Show filters</Label>
          <Switch
            id="ct-show-filters"
            checked={config.content_timeline_show_filters !== false}
            onCheckedChange={(v) => onUpdate({ content_timeline_show_filters: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="ct-show-badges">Show status badges</Label>
          <Switch
            id="ct-show-badges"
            checked={config.content_timeline_show_status_badges !== false}
            onCheckedChange={(v) => onUpdate({ content_timeline_show_status_badges: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="ct-show-owners">Show owner initials</Label>
          <Switch
            id="ct-show-owners"
            checked={config.content_timeline_show_owner_initials !== false}
            onCheckedChange={(v) => onUpdate({ content_timeline_show_owner_initials: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="ct-detail-panel">Enable detail panel</Label>
          <Switch
            id="ct-detail-panel"
            checked={config.content_timeline_enable_detail_panel !== false}
            onCheckedChange={(v) => onUpdate({ content_timeline_enable_detail_panel: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="ct-compact-default">Compact mode default</Label>
          <Switch
            id="ct-compact-default"
            checked={config.content_timeline_compact_mode === true}
            onCheckedChange={(v) => onUpdate({ content_timeline_compact_mode: v })}
          />
        </div>
      </div>
    </div>
  )
}
