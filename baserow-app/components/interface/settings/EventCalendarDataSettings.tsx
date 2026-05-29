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
import BlockFilterEditor from "./BlockFilterEditor"
import SortSelector from "./shared/SortSelector"

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
  const blockFilters = Array.isArray(config.filters) ? config.filters : []

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
        showView
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
          <MarketingFieldSelect
            label="Visibility"
            fieldId={config.event_calendar_visibility_field_id}
            fieldName={config.event_calendar_visibility_field}
            fields={tableFields}
            onChange={setField(
              "event_calendar_visibility_field_id",
              "event_calendar_visibility_field"
            )}
          />
          <MarketingFieldSelect
            label="Location"
            fieldId={config.event_calendar_location_field_id}
            fieldName={config.event_calendar_location_field}
            fields={tableFields}
            onChange={setField("event_calendar_location_field_id", "event_calendar_location_field")}
          />
          <MarketingFieldSelect
            label="Country"
            fieldId={config.event_calendar_country_field_id}
            fieldName={config.event_calendar_country_field}
            fields={tableFields}
            onChange={setField("event_calendar_country_field_id", "event_calendar_country_field")}
          />
          <MarketingFieldSelect
            label="Venue"
            fieldId={config.event_calendar_venue_field_id}
            fieldName={config.event_calendar_venue_field}
            fields={tableFields}
            onChange={setField("event_calendar_venue_field_id", "event_calendar_venue_field")}
          />
          <MarketingFieldSelect
            label="Attendees"
            fieldId={config.event_calendar_attending_field_id}
            fieldName={config.event_calendar_attending_field}
            fields={tableFields}
            onChange={setField(
              "event_calendar_attending_field_id",
              "event_calendar_attending_field"
            )}
          />
          <MarketingFieldSelect
            label="Campaign"
            fieldId={config.event_calendar_campaign_field_id}
            fieldName={config.event_calendar_campaign_field}
            fields={tableFields}
            onChange={setField(
              "event_calendar_campaign_field_id",
              "event_calendar_campaign_field"
            )}
          />
          <MarketingFieldSelect
            label="Resources"
            fieldId={config.event_calendar_resources_field_id}
            fieldName={config.event_calendar_resources_field}
            fields={tableFields}
            onChange={setField(
              "event_calendar_resources_field_id",
              "event_calendar_resources_field"
            )}
          />
          <MarketingFieldSelect
            label="Event URL"
            fieldId={config.event_calendar_url_field_id}
            fieldName={config.event_calendar_url_field}
            fields={tableFields}
            onChange={setField("event_calendar_url_field_id", "event_calendar_url_field")}
          />
          <MarketingFieldSelect
            label="Description"
            fieldId={config.event_calendar_description_field_id}
            fieldName={config.event_calendar_description_field}
            fields={tableFields}
            onChange={setField(
              "event_calendar_description_field_id",
              "event_calendar_description_field"
            )}
          />
        </MarketingFieldMappingSection>
      ) : null}

      {config.table_id && tableFields.length > 0 ? (
        <div className="space-y-4 pt-2 border-t border-border/40">
          <SortSelector
            value={Array.isArray(config.sorts) ? config.sorts : undefined}
            onChange={(sorts) => onUpdate({ sorts: sorts as BlockConfig["sorts"] })}
            fields={tableFields}
            allowMultiple
          />
          <BlockFilterEditor
            filters={blockFilters}
            tableFields={tableFields}
            config={config}
            onChange={(filters) => onUpdate({ filters })}
            onConfigUpdate={(updates) => onUpdate(updates)}
          />
        </div>
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

      <div className="space-y-2 pt-2 border-t border-border/40">
        <Label>On event click</Label>
        <Select
          value={config.event_calendar_click_action || "open_detail"}
          onValueChange={(v) =>
            onUpdate({
              event_calendar_click_action: v as BlockConfig["event_calendar_click_action"],
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open_detail">Open detail drawer</SelectItem>
            <SelectItem value="open_record">Open record</SelectItem>
            <SelectItem value="none">None</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Detail mode</Label>
        <Select
          value={
            config.event_calendar_detail_mode === "panel"
              ? "drawer"
              : config.event_calendar_detail_mode || "drawer"
          }
          onValueChange={(v) =>
            onUpdate({
              event_calendar_detail_mode: v as BlockConfig["event_calendar_detail_mode"],
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="drawer">Drawer</SelectItem>
            <SelectItem value="modal">Modal</SelectItem>
            <SelectItem value="inline">Inline (full page)</SelectItem>
            <SelectItem value="record">Record only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 pt-2 border-t border-border/40">
        <p className="text-xs font-medium text-muted-foreground">Display & behaviour</p>
        {(
          [
            ["event_calendar_show_toolbar", "Toolbar (views & date navigation)", true],
            ["event_calendar_show_filters", "Filter row", true],
            ["event_calendar_show_search", "Search", true],
            ["event_calendar_show_stats", "Summary stats", true],
            ["event_calendar_show_legend", "Event type legend", true],
            ["event_calendar_show_actions", "Header actions (add / export)", true],
            ["event_calendar_show_add_button", "Add event button", true],
            ["event_calendar_show_attendance_controls", "Attendance controls", true],
            ["event_calendar_allow_attendance_updates", "Allow attendance updates", true],
            ["event_calendar_allow_calendar_export", "Add to calendar / .ics", true],
            ["event_calendar_allow_member_submissions", "Member event submissions", false],
            ["event_calendar_external_mode", "External / member view (filter visibility)", false],
            ["event_calendar_show_schedule", "Schedule tab", true],
            ["event_calendar_show_resources", "Resources tab", true],
            ["event_calendar_show_notes", "Internal notes tab", true],
          ] as const
        ).map(([key, label]) => (
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
