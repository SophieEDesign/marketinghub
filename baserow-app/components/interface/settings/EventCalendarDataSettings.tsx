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
import type { DataSettingsCtx } from "./blockSettingsRegistry"
import MarketingDataSourceSection from "./shared/MarketingDataSourceSection"
import MarketingFieldMappingSection from "./shared/MarketingFieldMappingSection"
import MarketingFieldSelect from "./shared/MarketingFieldSelect"

export default function EventCalendarDataSettings({
  config,
  tables,
  views,
  fields,
  onUpdate,
  onTableChange,
}: DataSettingsCtx) {
  const tableFields = config.table_id
    ? fields.filter((f) => f.table_id === config.table_id)
    : fields

  const setField = (idKey: keyof BlockConfig, nameKey: keyof BlockConfig) =>
    (fieldId: string | undefined, fieldName: string | undefined) => {
      onUpdate({ [idKey]: fieldId, [nameKey]: fieldName } as Partial<BlockConfig>)
    }

  return (
    <div className="space-y-4">
      <MarketingDataSourceSection
        config={config}
        tables={tables}
        views={views}
        onUpdate={onUpdate}
        onTableChange={onTableChange}
        mockConfigKey="event_calendar_use_mock"
        showView={false}
      />

      {config.table_id ? (
        <MarketingFieldMappingSection>
          <MarketingFieldSelect
            label="Title"
            fieldId={config.event_calendar_title_field_id}
            fieldName={config.event_calendar_title_field}
            fields={tableFields}
            onChange={setField("event_calendar_title_field_id", "event_calendar_title_field")}
          />
          <MarketingFieldSelect
            label="Event type"
            fieldId={config.event_calendar_event_type_field_id}
            fieldName={config.event_calendar_event_type_field}
            fields={tableFields}
            onChange={setField(
              "event_calendar_event_type_field_id",
              "event_calendar_event_type_field"
            )}
          />
          <MarketingFieldSelect
            label="Start date"
            fieldId={config.event_calendar_start_date_field_id}
            fieldName={config.event_calendar_start_date_field}
            fields={tableFields}
            onChange={setField(
              "event_calendar_start_date_field_id",
              "event_calendar_start_date_field"
            )}
            fieldTypes={["date"]}
          />
          <MarketingFieldSelect
            label="End date"
            fieldId={config.event_calendar_end_date_field_id}
            fieldName={config.event_calendar_end_date_field}
            fields={tableFields}
            onChange={setField(
              "event_calendar_end_date_field_id",
              "event_calendar_end_date_field"
            )}
            fieldTypes={["date"]}
          />
          <MarketingFieldSelect
            label="Status"
            fieldId={config.event_calendar_status_field_id}
            fieldName={config.event_calendar_status_field}
            fields={tableFields}
            onChange={setField("event_calendar_status_field_id", "event_calendar_status_field")}
          />
        </MarketingFieldMappingSection>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="ec-max">Max items</Label>
        <Input
          id="ec-max"
          type="number"
          min={0}
          value={config.event_calendar_max_items ?? ""}
          onChange={(e) =>
            onUpdate({
              event_calendar_max_items:
                e.target.value === "" ? undefined : Math.max(0, parseInt(e.target.value, 10) || 0),
            })
          }
        />
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
        <p className="text-xs font-medium text-muted-foreground">Filters & view controls</p>
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
