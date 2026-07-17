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

export default function ThingsToDoDataSettings({
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

  const setField = (idKey: keyof BlockConfig) =>
    (fieldId: string | undefined) => {
      onUpdate({ [idKey]: fieldId } as Partial<BlockConfig>)
    }

  return (
    <div className="space-y-4">
      <MarketingDataSourceSection
        config={config}
        tables={tables}
        views={views}
        onUpdate={onUpdate}
        onTableChange={onTableChange}
        mockConfigKey="things_to_do_use_mock"
        showView={false}
      />

      {config.table_id ? (
        <MarketingFieldMappingSection>
          <MarketingFieldSelect
            label="Title"
            fieldId={config.things_to_do_title_field_id}
            fields={tableFields}
            onChange={setField("things_to_do_title_field_id")}
          />
          <MarketingFieldSelect
            label="Type"
            fieldId={config.things_to_do_type_field_id}
            fields={tableFields}
            onChange={setField("things_to_do_type_field_id")}
          />
          <MarketingFieldSelect
            label="Status"
            fieldId={config.things_to_do_status_field_id}
            fields={tableFields}
            onChange={setField("things_to_do_status_field_id")}
          />
          <MarketingFieldSelect
            label="Priority"
            fieldId={config.things_to_do_priority_field_id}
            fields={tableFields}
            onChange={setField("things_to_do_priority_field_id")}
          />
          <MarketingFieldSelect
            label="Owner"
            fieldId={config.things_to_do_owner_field_id}
            fields={tableFields}
            onChange={setField("things_to_do_owner_field_id")}
          />
          <MarketingFieldSelect
            label="Reviewer"
            fieldId={config.things_to_do_reviewer_field_id}
            fields={tableFields}
            onChange={setField("things_to_do_reviewer_field_id")}
          />
          <MarketingFieldSelect
            label="Due date"
            fieldId={config.things_to_do_due_date_field_id}
            fields={tableFields}
            onChange={setField("things_to_do_due_date_field_id")}
            fieldTypes={["date"]}
          />
          <MarketingFieldSelect
            label="Campaign"
            fieldId={config.things_to_do_campaign_field_id}
            fields={tableFields}
            onChange={setField("things_to_do_campaign_field_id")}
          />
          <MarketingFieldSelect
            label="Theme"
            fieldId={config.things_to_do_theme_field_id}
            fields={tableFields}
            onChange={setField("things_to_do_theme_field_id")}
          />
          <MarketingFieldSelect
            label="Description"
            fieldId={config.things_to_do_description_field_id}
            fields={tableFields}
            onChange={setField("things_to_do_description_field_id")}
          />
          <MarketingFieldSelect
            label="Channels"
            fieldId={config.things_to_do_channels_field_id}
            fields={tableFields}
            onChange={setField("things_to_do_channels_field_id")}
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
        <Label htmlFor="ttd-title">Block title</Label>
        <Input
          id="ttd-title"
          value={config.title || ""}
          onChange={(e) => onUpdate({ title: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ttd-subtitle">Subtitle</Label>
        <Input
          id="ttd-subtitle"
          value={config.things_to_do_subtitle || ""}
          onChange={(e) => onUpdate({ things_to_do_subtitle: e.target.value })}
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
        <Label htmlFor="ttd-max">Max items</Label>
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
        />
      </div>

      <div className="space-y-3 pt-2 border-t">
        {(
          [
            ["things_to_do_show_filters", "Show filters", true],
            ["things_to_do_show_search", "Show search", true],
            ["things_to_do_show_quick_links", "Show quick links", true],
            ["things_to_do_show_stats", "Show stats", true],
            ["things_to_do_enable_detail_panel", "Show detail panel", true],
            ["things_to_do_compact_mode", "Compact mode", false],
          ] as const
        ).map(([key, label, defaultOn]) => (
          <div key={key} className="flex items-center justify-between">
            <Label htmlFor={key}>{label}</Label>
            <Switch
              id={key}
              checked={(config as Record<string, boolean | undefined>)[key] ?? defaultOn}
              onCheckedChange={(v) => onUpdate({ [key]: v } as Partial<BlockConfig>)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
