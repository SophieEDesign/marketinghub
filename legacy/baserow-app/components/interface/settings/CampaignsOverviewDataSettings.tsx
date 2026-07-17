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
import {
  DEFAULT_CAMPAIGNS_KPI_STATUS_BUCKETS,
  formatCampaignsKpiStatuses,
} from "@/lib/marketing/campaigns-overview-kpi"
import { choiceLabelsFromField } from "@/lib/marketing/field-utils"
import type { FieldOptions } from "@/types/fields"

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

  const statusField = tableFields.find(
    (f) => f.id === config.campaigns_status_field_id || f.name === config.campaigns_status_field
  )
  const statusChoices = statusField
    ? choiceLabelsFromField({
        name: statusField.name,
        type: statusField.type,
        options: statusField.options as FieldOptions | undefined,
      })
    : []

  const parseStatusInput = (raw: string): string[] | undefined => {
    const parsed = raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
    return parsed.length ? parsed : undefined
  }

  return (
    <div className="space-y-4">
      <MarketingDataSourceSection
        config={config}
        tables={tables}
        views={views}
        onUpdate={onUpdate}
        onTableChange={onTableChange}
        mockConfigKey="campaigns_overview_use_mock"
        legacyMockKey="campaigns_use_mock"
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

          <div className="space-y-3 border-t border-border/40 pt-4">
            <div>
              <p className="text-sm font-medium">KPI mapping</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Status KPIs use your mapped Status field. Content items and open tasks sum the
                mapped linked fields above. Enter comma-separated status labels to match your
                table choices.
              </p>
              {statusChoices.length > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Status choices in table: {statusChoices.join(", ")}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaigns-kpi-active-label">Active KPI label</Label>
              <Input
                id="campaigns-kpi-active-label"
                value={config.campaigns_kpi_active_label || ""}
                onChange={(e) =>
                  onUpdate({
                    campaigns_kpi_active_label: e.target.value.trim() || undefined,
                  })
                }
                placeholder="Active campaigns"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaigns-kpi-active-statuses">Active status values</Label>
              <Input
                id="campaigns-kpi-active-statuses"
                value={formatCampaignsKpiStatuses(
                  config.campaigns_kpi_active_statuses,
                  DEFAULT_CAMPAIGNS_KPI_STATUS_BUCKETS.active
                )}
                onChange={(e) =>
                  onUpdate({ campaigns_kpi_active_statuses: parseStatusInput(e.target.value) })
                }
                placeholder="active, live, in progress"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaigns-kpi-planned-label">Planned KPI label</Label>
              <Input
                id="campaigns-kpi-planned-label"
                value={config.campaigns_kpi_planned_label || ""}
                onChange={(e) =>
                  onUpdate({
                    campaigns_kpi_planned_label: e.target.value.trim() || undefined,
                  })
                }
                placeholder="Planned campaigns"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaigns-kpi-planned-statuses">Planned status values</Label>
              <Input
                id="campaigns-kpi-planned-statuses"
                value={formatCampaignsKpiStatuses(
                  config.campaigns_kpi_planned_statuses,
                  DEFAULT_CAMPAIGNS_KPI_STATUS_BUCKETS.planned
                )}
                onChange={(e) =>
                  onUpdate({ campaigns_kpi_planned_statuses: parseStatusInput(e.target.value) })
                }
                placeholder="planning, planned, draft"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaigns-kpi-completed-label">Completed KPI label</Label>
              <Input
                id="campaigns-kpi-completed-label"
                value={config.campaigns_kpi_completed_label || ""}
                onChange={(e) =>
                  onUpdate({
                    campaigns_kpi_completed_label: e.target.value.trim() || undefined,
                  })
                }
                placeholder="Completed campaigns"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaigns-kpi-completed-statuses">Completed status values</Label>
              <Input
                id="campaigns-kpi-completed-statuses"
                value={formatCampaignsKpiStatuses(
                  config.campaigns_kpi_completed_statuses,
                  DEFAULT_CAMPAIGNS_KPI_STATUS_BUCKETS.completed
                )}
                onChange={(e) =>
                  onUpdate({
                    campaigns_kpi_completed_statuses: parseStatusInput(e.target.value),
                  })
                }
                placeholder="completed, complete, done"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaigns-kpi-content-label">Content items KPI label</Label>
              <Input
                id="campaigns-kpi-content-label"
                value={config.campaigns_kpi_content_label || ""}
                onChange={(e) =>
                  onUpdate({
                    campaigns_kpi_content_label: e.target.value.trim() || undefined,
                  })
                }
                placeholder="Content items"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaigns-kpi-tasks-label">Open tasks KPI label</Label>
              <Input
                id="campaigns-kpi-tasks-label"
                value={config.campaigns_kpi_tasks_label || ""}
                onChange={(e) =>
                  onUpdate({
                    campaigns_kpi_tasks_label: e.target.value.trim() || undefined,
                  })
                }
                placeholder="Open tasks"
              />
            </div>
          </div>
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
            <SelectItem value="kanban">Kanban</SelectItem>
            <SelectItem value="calendar">Calendar</SelectItem>
            <SelectItem value="timeline">Timeline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Group by</Label>
        <Select
          value={config.campaigns_group_by || "none"}
          onValueChange={(v) =>
            onUpdate({ campaigns_group_by: v as BlockConfig["campaigns_group_by"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="stage">Stage</SelectItem>
            <SelectItem value="type">Type</SelectItem>
            <SelectItem value="division">Division</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
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
