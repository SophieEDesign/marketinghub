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
import { CONTENT_TIMELINE_THEMES } from "@/lib/marketing/content-timeline"
import MarketingDataSourceSection from "./shared/MarketingDataSourceSection"
import MarketingFieldMappingSection from "./shared/MarketingFieldMappingSection"
import MarketingFieldSelect from "./shared/MarketingFieldSelect"
import BlockFilterEditor from "./BlockFilterEditor"
import SortSelector from "./shared/SortSelector"

export default function ContentTimelineDataSettings({
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
      onUpdate({
        [idKey]: fieldId,
        [nameKey]: fieldName,
      } as Partial<BlockConfig>)
    }

  return (
    <div className="space-y-4">
      <MarketingDataSourceSection
        config={config}
        tables={tables}
        views={views}
        onUpdate={onUpdate}
        onTableChange={onTableChange}
        mockConfigKey="content_timeline_use_mock"
        showView={false}
      />

      {config.table_id ? (
        <MarketingFieldMappingSection>
          <MarketingFieldSelect
            label="Title"
            fieldId={config.content_timeline_title_field_id}
            fieldName={config.content_timeline_title_field}
            fields={tableFields}
            onChange={setField("content_timeline_title_field_id", "content_timeline_title_field")}
          />
          <MarketingFieldSelect
            label="Theme"
            fieldId={config.content_timeline_theme_field_id}
            fieldName={config.content_timeline_theme_field}
            fields={tableFields}
            onChange={setField("content_timeline_theme_field_id", "content_timeline_theme_field")}
          />
          <MarketingFieldSelect
            label="Campaign"
            fieldId={config.content_timeline_campaign_field_id}
            fieldName={config.content_timeline_campaign_field}
            fields={tableFields}
            onChange={setField("content_timeline_campaign_field_id", "content_timeline_campaign_field")}
          />
          <MarketingFieldSelect
            label="Content type"
            fieldId={config.content_timeline_type_field_id}
            fieldName={config.content_timeline_type_field}
            fields={tableFields}
            onChange={setField("content_timeline_type_field_id", "content_timeline_type_field")}
          />
          <MarketingFieldSelect
            label="Channel"
            fieldId={config.content_timeline_channel_field_id}
            fieldName={config.content_timeline_channel_field}
            fields={tableFields}
            onChange={setField("content_timeline_channel_field_id", "content_timeline_channel_field")}
          />
          <MarketingFieldSelect
            label="Status"
            fieldId={config.content_timeline_status_field_id}
            fieldName={config.content_timeline_status_field}
            fields={tableFields}
            onChange={setField("content_timeline_status_field_id", "content_timeline_status_field")}
          />
          <MarketingFieldSelect
            label="Owner"
            fieldId={config.content_timeline_owner_field_id}
            fieldName={config.content_timeline_owner_field}
            fields={tableFields}
            onChange={setField("content_timeline_owner_field_id", "content_timeline_owner_field")}
          />
          <MarketingFieldSelect
            label="Start date"
            fieldId={config.content_timeline_start_date_field_id}
            fieldName={config.content_timeline_start_date_field}
            fields={tableFields}
            onChange={setField(
              "content_timeline_start_date_field_id",
              "content_timeline_start_date_field"
            )}
            fieldTypes={["date"]}
          />
          <MarketingFieldSelect
            label="End / due date"
            fieldId={config.content_timeline_end_date_field_id}
            fieldName={config.content_timeline_end_date_field}
            fields={tableFields}
            onChange={setField(
              "content_timeline_end_date_field_id",
              "content_timeline_end_date_field"
            )}
            fieldTypes={["date"]}
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

      <div className="space-y-2 pt-2 border-t">
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
            <SelectItem value="campaign">Campaign</SelectItem>
            <SelectItem value="channel">Channel</SelectItem>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ct-max">Max items</Label>
        <Input
          id="ct-max"
          type="number"
          min={0}
          value={config.content_timeline_max_items ?? ""}
          onChange={(e) =>
            onUpdate({
              content_timeline_max_items:
                e.target.value === "" ? undefined : Math.max(0, parseInt(e.target.value, 10) || 0),
            })
          }
        />
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
        <p className="text-xs font-medium text-muted-foreground">Display</p>
        {!config.table_id ? (
          <div className="flex items-center justify-between">
            <Label htmlFor="content_timeline_include_social_posts">
              Include Social Posts table
            </Label>
            <Switch
              id="content_timeline_include_social_posts"
              checked={config.content_timeline_include_social_posts !== false}
              onCheckedChange={(v) =>
                onUpdate({ content_timeline_include_social_posts: v })
              }
            />
          </div>
        ) : null}
        {(
          [
            ["content_timeline_show_filters", "Show filters", true],
            ["content_timeline_show_search", "Show search", true],
            ["content_timeline_show_status_badges", "Show status badges", true],
            ["content_timeline_show_owner_initials", "Show owner initials", true],
            ["content_timeline_enable_detail_panel", "Enable detail panel", true],
            ["content_timeline_compact_mode", "Compact mode default", false],
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
