"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { DataSettingsCtx } from "./blockSettingsRegistry"

export default function MembersWelcomeDataSettings({
  config,
  onUpdate,
}: DataSettingsCtx) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Member-facing welcome page. Quick links resolve to Event Calendar, Resource Hub, Contacts,
        and Help pages when they exist.
      </p>
      <div className="space-y-2">
        <Label htmlFor="members_welcome_max_events">Max upcoming events</Label>
        <Input
          id="members_welcome_max_events"
          type="number"
          min={1}
          max={10}
          value={config.members_welcome_max_events ?? 5}
          onChange={(e) =>
            onUpdate({ members_welcome_max_events: Number(e.target.value) || 5 })
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="members_welcome_max_resources">Max featured resources</Label>
        <Input
          id="members_welcome_max_resources"
          type="number"
          min={1}
          max={10}
          value={config.members_welcome_max_resources ?? 5}
          onChange={(e) =>
            onUpdate({ members_welcome_max_resources: Number(e.target.value) || 5 })
          }
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="members_welcome_allow_submit">Show Submit Event quick action</Label>
        <Switch
          id="members_welcome_allow_submit"
          checked={config.members_welcome_allow_submit_event !== false}
          onCheckedChange={(checked) =>
            onUpdate({ members_welcome_allow_submit_event: checked })
          }
        />
      </div>
    </div>
  )
}
