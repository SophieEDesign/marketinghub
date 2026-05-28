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

export default function CampaignsOverviewDataSettings({
  config,
  tables,
  views,
  fields,
  onUpdate,
  onTableChange,
}: DataSettingsCtx) {
  const tableFields = config.table_id ? fields.filter((f) => f.table_id === config.table_id) : fields

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
        <MarketingFieldMappingSection>
          <MarketingFieldSelect label="Title" fieldId={config.title_field_id} fieldName={config.title_field} fields={tableFields} onChange={setFieldPair("title_field_id", "title_field")} optional={false} />
          <MarketingFieldSelect label="Type" fieldId={config.type_field_id} fieldName={config.type_field} fields={tableFields} onChange={setFieldPair("type_field_id", "type_field")} />
          <MarketingFieldSelect label="Division" fieldId={config.division_field_id} fieldName={config.division_field} fields={tableFields} onChange={setFieldPair("division_field_id", "division_field")} />
          <MarketingFieldSelect label="Status" fieldId={config.status_field_id} fieldName={config.status_field} fields={tableFields} onChange={setFieldPair("status_field_id", "status_field")} />
          <MarketingFieldSelect label="Priority" fieldId={config.priority_field_id} fieldName={config.priority_field} fields={tableFields} onChange={setFieldPair("priority_field_id", "priority_field")} />
          <MarketingFieldSelect label="Stage" fieldId={config.stage_field_id} fieldName={config.stage_field} fields={tableFields} onChange={setFieldPair("stage_field_id", "stage_field")} />
          <MarketingFieldSelect label="Start date" fieldId={config.start_date_field_id} fieldName={config.start_date_field} fields={tableFields} onChange={setFieldPair("start_date_field_id", "start_date_field")} fieldTypes={["date"]} />
          <MarketingFieldSelect label="End date" fieldId={config.end_date_field_id} fieldName={config.end_date_field} fields={tableFields} onChange={setFieldPair("end_date_field_id", "end_date_field")} fieldTypes={["date"]} />
          <MarketingFieldSelect label="Owner" fieldId={config.owner_field_id} fieldName={config.owner_field} fields={tableFields} onChange={setFieldPair("owner_field_id", "owner_field")} />
          <MarketingFieldSelect label="Progress" fieldId={config.progress_field_id} fieldName={config.progress_field} fields={tableFields} onChange={setFieldPair("progress_field_id", "progress_field")} />
          <MarketingFieldSelect label="Image" fieldId={config.image_field_id} fieldName={config.image_field} fields={tableFields} onChange={setFieldPair("image_field_id", "image_field")} />
          <MarketingFieldSelect label="Linked content" fieldId={config.linked_content_field_id} fieldName={config.linked_content_field} fields={tableFields} onChange={setFieldPair("linked_content_field_id", "linked_content_field")} />
          <MarketingFieldSelect label="Linked tasks" fieldId={config.linked_tasks_field_id} fieldName={config.linked_tasks_field} fields={tableFields} onChange={setFieldPair("linked_tasks_field_id", "linked_tasks_field")} />
          <MarketingFieldSelect label="Linked events" fieldId={config.linked_events_field_id} fieldName={config.linked_events_field} fields={tableFields} onChange={setFieldPair("linked_events_field_id", "linked_events_field")} />
        </MarketingFieldMappingSection>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="campaigns-title">Block title</Label>
        <Input id="campaigns-title" value={config.title || ""} onChange={(e) => onUpdate({ title: e.target.value })} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="campaigns-subtitle">Subtitle</Label>
        <Input id="campaigns-subtitle" value={config.campaigns_subtitle || ""} onChange={(e) => onUpdate({ campaigns_subtitle: e.target.value })} />
      </div>

      <div className="space-y-2">
        <Label>Default view</Label>
        <Select
          value={config.campaigns_default_view || "list"}
          onValueChange={(v) => onUpdate({ campaigns_default_view: v as BlockConfig["campaigns_default_view"] })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
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
          value={config.campaigns_max_items ?? ""}
          onChange={(e) => {
            const val = e.target.value
            onUpdate({ campaigns_max_items: val === "" ? undefined : Math.max(0, parseInt(val, 10) || 0) })
          }}
        />
      </div>

      <div className="space-y-2">
        <Label>Density</Label>
        <Select
          value={config.campaigns_density || "comfortable"}
          onValueChange={(v) => onUpdate({ campaigns_density: v as BlockConfig["campaigns_density"] })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
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
          value={config.click_action || "open_record"}
          onValueChange={(v) => onUpdate({ click_action: v as BlockConfig["click_action"] })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open_record">Open record</SelectItem>
            <SelectItem value="none">Do nothing</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
