"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

export default function CampaignsOverviewDataSettings({
  config,
  tables,
  views,
  fields,
  onUpdate,
  onTableChange,
}: DataSettingsCtx) {
  const tableFields = config.table_id ? fields.filter((f) => f.table_id === config.table_id) : fields
  const blockFilters = Array.isArray(config.filters) ? config.filters : []

  const setFieldPair =
    (idKey: keyof BlockConfig, nameKey: keyof BlockConfig) =>
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
        mockConfigKey="campaigns_use_mock"
        showView
        tableLabel="Campaigns table"
      />

      {config.table_id ? (
        <>
          <MarketingFieldMappingSection>
            <MarketingFieldSelect
              label="Title"
              fieldId={config.campaigns_title_field_id}
              fieldName={config.campaigns_title_field}
              fields={tableFields}
              onChange={setFieldPair("campaigns_title_field_id", "campaigns_title_field")}
              optional={false}
            />
            <MarketingFieldSelect
              label="Type"
              fieldId={config.campaigns_type_field_id}
              fieldName={config.campaigns_type_field}
              fields={tableFields}
              onChange={setFieldPair("campaigns_type_field_id", "campaigns_type_field")}
            />
            <MarketingFieldSelect
              label="Division"
              fieldId={config.campaigns_division_field_id}
              fieldName={config.campaigns_division_field}
              fields={tableFields}
              onChange={setFieldPair("campaigns_division_field_id", "campaigns_division_field")}
            />
            <MarketingFieldSelect
              label="Status"
              fieldId={config.campaigns_status_field_id}
              fieldName={config.campaigns_status_field}
              fields={tableFields}
              onChange={setFieldPair("campaigns_status_field_id", "campaigns_status_field")}
            />
            <MarketingFieldSelect
              label="Priority"
              fieldId={config.campaigns_priority_field_id}
              fieldName={config.campaigns_priority_field}
              fields={tableFields}
              onChange={setFieldPair("campaigns_priority_field_id", "campaigns_priority_field")}
            />
            <MarketingFieldSelect
              label="Stage"
              fieldId={config.campaigns_stage_field_id}
              fieldName={config.campaigns_stage_field}
              fields={tableFields}
              onChange={setFieldPair("campaigns_stage_field_id", "campaigns_stage_field")}
            />
            <MarketingFieldSelect
              label="Start date"
              fieldId={config.campaigns_start_date_field_id}
              fieldName={config.campaigns_start_date_field}
              fields={tableFields}
              onChange={setFieldPair("campaigns_start_date_field_id", "campaigns_start_date_field")}
              fieldTypes={["date"]}
            />
            <MarketingFieldSelect
              label="End date"
              fieldId={config.campaigns_end_date_field_id}
              fieldName={config.campaigns_end_date_field}
              fields={tableFields}
              onChange={setFieldPair("campaigns_end_date_field_id", "campaigns_end_date_field")}
              fieldTypes={["date"]}
            />
            <MarketingFieldSelect
              label="Owner"
              fieldId={config.campaigns_owner_field_id}
              fieldName={config.campaigns_owner_field}
              fields={tableFields}
              onChange={setFieldPair("campaigns_owner_field_id", "campaigns_owner_field")}
            />
            <MarketingFieldSelect
              label="Progress"
              fieldId={config.campaigns_progress_field_id}
              fieldName={config.campaigns_progress_field}
              fields={tableFields}
              onChange={setFieldPair("campaigns_progress_field_id", "campaigns_progress_field")}
            />
            <MarketingFieldSelect
              label="Image"
              fieldId={config.campaigns_image_field_id}
              fieldName={config.campaigns_image_field}
              fields={tableFields}
              onChange={setFieldPair("campaigns_image_field_id", "campaigns_image_field")}
            />
            <MarketingFieldSelect
              label="Linked content"
              fieldId={config.campaigns_linked_content_field_id}
              fieldName={config.campaigns_linked_content_field}
              fields={tableFields}
              onChange={setFieldPair(
                "campaigns_linked_content_field_id",
                "campaigns_linked_content_field"
              )}
            />
            <MarketingFieldSelect
              label="Linked tasks"
              fieldId={config.campaigns_linked_tasks_field_id}
              fieldName={config.campaigns_linked_tasks_field}
              fields={tableFields}
              onChange={setFieldPair("campaigns_linked_tasks_field_id", "campaigns_linked_tasks_field")}
            />
            <MarketingFieldSelect
              label="Linked events"
              fieldId={config.campaigns_linked_events_field_id}
              fieldName={config.campaigns_linked_events_field}
              fields={tableFields}
              onChange={setFieldPair(
                "campaigns_linked_events_field_id",
                "campaigns_linked_events_field"
              )}
            />
          </MarketingFieldMappingSection>

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
        </>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="campaigns-title">Block title</Label>
        <Input
          id="campaigns-title"
          value={config.title || ""}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Campaigns"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="campaigns-subtitle">Subtitle</Label>
        <Input
          id="campaigns-subtitle"
          value={config.subtitle || config.campaigns_subtitle || ""}
          onChange={(e) =>
            onUpdate({
              subtitle: e.target.value,
              campaigns_subtitle: undefined,
            })
          }
          placeholder="Plan, manage and track all marketing campaigns."
        />
      </div>

      <div className="space-y-2">
        <Label>Default view</Label>
        <Select
          value={config.campaigns_default_view || "list"}
          onValueChange={(v) =>
            onUpdate({ campaigns_default_view: v as BlockConfig["campaigns_default_view"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="list">List</SelectItem>
            <SelectItem value="kanban">Kanban (coming soon)</SelectItem>
            <SelectItem value="calendar">Calendar (coming soon)</SelectItem>
            <SelectItem value="timeline">Timeline (coming soon)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="campaigns-max-items">Max items</Label>
        <Input
          id="campaigns-max-items"
          type="number"
          min={0}
          value={config.campaigns_max_items ?? config.record_limit ?? ""}
          onChange={(e) => {
            const val = e.target.value
            onUpdate({
              campaigns_max_items:
                val === "" ? undefined : Math.max(0, parseInt(val, 10) || 0),
              record_limit: undefined,
            })
          }}
        />
      </div>

      <div className="space-y-2">
        <Label>Density</Label>
        <Select
          value={config.campaigns_density || "comfortable"}
          onValueChange={(v) => onUpdate({ campaigns_density: v as BlockConfig["campaigns_density"] })}
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

      <div className="space-y-3 border-t pt-2">
        {(
          [
            ["campaigns_show_search", "Show search", true],
            ["campaigns_show_filters", "Show filters", true],
            ["campaigns_show_kpis", "Show KPI cards", true],
            ["campaigns_show_progress", "Show progress", true],
            ["campaigns_show_thumbnails", "Show thumbnails", true],
          ] as const
        ).map(([key, label, defaultOn]) => (
          <div key={key} className="flex items-center justify-between">
            <Label htmlFor={key}>{label}</Label>
            <Switch
              id={key}
              checked={(config as Record<string, boolean | undefined>)[key] ?? defaultOn}
              onCheckedChange={(checked) => onUpdate({ [key]: checked } as Partial<BlockConfig>)}
            />
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t pt-2">
        <Label>Row click action</Label>
        <Select
          value={config.campaigns_click_action || "open_record"}
          onValueChange={(v) =>
            onUpdate({ campaigns_click_action: v as BlockConfig["campaigns_click_action"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open_record">Open record</SelectItem>
            <SelectItem value="none">Do nothing</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
