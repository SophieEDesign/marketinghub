"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import type { DataSettingsCtx } from "./blockSettingsRegistry"
import TableSelector from "./shared/TableSelector"
import { MEMBERS_WELCOME_DEFAULT_COPY } from "@/lib/marketing/members-welcome"

export default function MembersWelcomeDataSettings({
  config,
  tables,
  onUpdate,
}: DataSettingsCtx) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Member-facing welcome page. Quick links resolve to Event Calendar, Resource Hub, Contacts,
        and Help pages when they exist.
      </p>

      <div className="space-y-2">
        <Label htmlFor="members_welcome_title">Heading</Label>
        <Input
          id="members_welcome_title"
          value={config.title ?? ""}
          placeholder={MEMBERS_WELCOME_DEFAULT_COPY.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="members_welcome_subtitle">Subtitle</Label>
        <Textarea
          id="members_welcome_subtitle"
          rows={2}
          value={config.subtitle ?? ""}
          placeholder={MEMBERS_WELCOME_DEFAULT_COPY.subtitle}
          onChange={(e) => onUpdate({ subtitle: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="members_welcome_body">Body text</Label>
        <Textarea
          id="members_welcome_body"
          rows={3}
          value={config.members_welcome_body ?? ""}
          placeholder={MEMBERS_WELCOME_DEFAULT_COPY.body}
          onChange={(e) => onUpdate({ members_welcome_body: e.target.value })}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="members_welcome_show_quick_actions">Show quick actions</Label>
        <Switch
          id="members_welcome_show_quick_actions"
          checked={config.members_welcome_show_quick_actions !== false}
          onCheckedChange={(checked) =>
            onUpdate({ members_welcome_show_quick_actions: checked })
          }
        />
      </div>

      <details className="rounded-lg border border-border/40">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Data sources</summary>
        <div className="space-y-3 border-t border-border/40 p-3">
          <TableSelector
            label="Events table"
            required={false}
            description="Source for upcoming events snapshot. Falls back to table name discovery when unset."
            value={config.members_welcome_events_table_id || ""}
            tables={tables}
            onChange={(id) =>
              onUpdate({ members_welcome_events_table_id: id || undefined })
            }
          />
          <TableSelector
            label="Resources table"
            required={false}
            description="Source for featured resources snapshot. Falls back to table name discovery when unset."
            value={config.members_welcome_resources_table_id || ""}
            tables={tables}
            onChange={(id) =>
              onUpdate({ members_welcome_resources_table_id: id || undefined })
            }
          />
        </div>
      </details>

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
