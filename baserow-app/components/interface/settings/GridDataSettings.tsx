"use client"

import { useMemo } from "react"
import { useViewMeta } from "@/hooks/useViewMeta"
import type { ViewFilter, ViewSort, ViewField } from "@/types/database"
import type { BlockFilter } from "@/lib/interface/types"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Grid, Columns, Calendar, Image as ImageIcon, GitBranch, List, X, LayoutGrid } from "lucide-react"
import type { BlockConfig, ViewType } from "@/lib/interface/types"
import type { Table, View, TableField } from "@/types/database"
import type { FieldType } from "@/types/fields"
import BlockFilterEditor from "./BlockFilterEditor"
import PermissionsSettings from "./PermissionsSettings"
import { getFieldDisplayName } from "@/lib/fields/display"
import TableSelector from "./shared/TableSelector"
import ViewSelector from "./shared/ViewSelector"
import CardFieldsSelector from "./shared/CardFieldsSelector"
import DateFieldSelector from "./shared/DateFieldSelector"
import GroupBySelector from "./shared/GroupBySelector"
import NestedGroupBySelector from "./shared/NestedGroupBySelector"
import type { GroupRule } from "@/lib/grouping/types"
import SortSelector from "./shared/SortSelector"
import { Switch } from "@/components/ui/switch"

interface GridDataSettingsProps {
  config: BlockConfig
  tables: Table[]
  views: View[]
  fields: TableField[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
  /** Callback to open a record modal in edit mode for layout editing. Returns recordId or null. */
  onOpenRecordForLayoutEdit?: (tableId: string) => Promise<string | null>
}

interface ViewTypeOption {
  type: ViewType
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  requiredFields: FieldType[] // Field types required for this view
}

// Show Table, Calendar, Kanban, and Timeline view types
const VIEW_TYPE_OPTIONS: ViewTypeOption[] = [
  {
    type: 'grid',
    label: 'Table',
    icon: Grid,
    description: 'Spreadsheet-style table view',
    requiredFields: [],
  },
  {
    type: 'calendar',
    label: 'Calendar',
    icon: Calendar,
    description: 'Month/week calendar view',
    requiredFields: ['date'] as FieldType[],
  },
  {
    type: 'kanban',
    label: 'Kanban',
    icon: Columns,
    description: 'Board view with columns',
    requiredFields: [],
  },
  {
    type: 'timeline',
    label: 'Timeline',
    icon: GitBranch,
    description: 'Chronological timeline view',
    requiredFields: ['date'] as FieldType[],
  },
  {
    type: 'gallery',
    label: 'Gallery',
    icon: ImageIcon,
    description: 'Card-based visual layout',
    requiredFields: ['attachment', 'url'] as FieldType[],
  },
  {
    type: 'list',
    label: 'List',
    icon: List,
    description: 'Record-centric, vertically stacked view',
    requiredFields: [],
  },
]

export default function GridDataSettings({
  config,
  tables,
  views,
  fields,
  onUpdate,
  onTableChange,
  onOpenRecordForLayoutEdit,
}: GridDataSettingsProps) {
  // Removed SQL view loading - users select tables, not SQL views
  // SQL views are internal and must never be selected by users

  // Determine compatible view types based on available fields
  const getCompatibleViewTypes = (): ViewType[] => {
    const fieldTypes = new Set<FieldType>(fields.map(f => f.type as FieldType))
    
    return VIEW_TYPE_OPTIONS.filter(option => {
      if (option.requiredFields.length === 0) return true
      return option.requiredFields.some(type => fieldTypes.has(type as FieldType))
    }).map(option => option.type)
  }

  const compatibleTypes = getCompatibleViewTypes()
  const currentViewType: ViewType = config?.view_type || 'grid'

  const { metadata: viewMeta } = useViewMeta(config.view_id, config.table_id)

  const handleCopySettingsFromView = () => {
    if (!viewMeta) return
    const filters: BlockFilter[] = (viewMeta.filters || []).map((f: ViewFilter) => ({
      field: f.field_name,
      operator: (f.operator || 'equal') as BlockFilter['operator'],
      value: f.value,
    }))
    const sorts = (viewMeta.sorts || []).map((s: ViewSort) => ({
      field: s.field_name,
      direction: (s.direction || 'asc') as 'asc' | 'desc',
    }))
    const visibleFields = (viewMeta.fields || [])
      .filter((f: ViewField) => f.visible !== false)
      .sort((a: ViewField, b: ViewField) => (a.position ?? 0) - (b.position ?? 0))
      .map((f: ViewField) => f.field_name)
    onUpdate({
      filters,
      sorts,
      visible_fields: visibleFields.length > 0 ? visibleFields : undefined,
      filter_mode: filters.length > 0 ? 'specific' : (config as any).filter_mode,
    } as any)
  }

  const getDefaultGalleryImageFieldName = (): string | null => {
    // Prefer attachment fields, then URL fields.
    const attachment = fields.find((f) => f.type === 'attachment')
    if (attachment?.name) return attachment.name
    const url = fields.find((f) => f.type === 'url')
    if (url?.name) return url.name
    return null
  }

  const handleSelectViewType = (nextType: ViewType) => {
    if (!compatibleTypes.includes(nextType)) return

    const updates: Partial<BlockConfig> = { view_type: nextType }

    // Gallery needs an image field to look correct.
    // Auto-pick a sensible default when switching to gallery if not already set.
    if (nextType === 'gallery') {
      const currentAppearance = (config.appearance || {}) as any
      if (!currentAppearance.image_field) {
        const defaultImageField = getDefaultGalleryImageFieldName()
        if (defaultImageField) {
          updates.appearance = {
            ...currentAppearance,
            image_field: defaultImageField,
          }
        }
      }
    }

    onUpdate(updates)
  }


  return (
    <div className="space-y-4">
      {/* Table Selection */}
      <TableSelector
        value={config.table_id || ""}
        onChange={onTableChange}
        tables={tables}
        required={true}
        description="Table blocks require a table connection. Select a table to configure visible fields."
      />

      {/* View Selection (optional) */}
      {config.table_id && (
        <ViewSelector
          value={config.view_id}
          onChange={(viewId) => onUpdate({ view_id: viewId })}
          views={views}
          tableId={config.table_id}
        />
      )}

      {/* B. Permissions (Airtable parity: view/edit, add/delete inline, open record, modal layout) */}
      <div className="space-y-4 border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold text-gray-900">Permissions</h3>
        <PermissionsSettings config={config} onUpdate={onUpdate} />
        {/* Per-block modal layout: edit in record modal */}
        {config.table_id && (
          <div className="space-y-2 border-t border-gray-200 pt-4">
            <Label>Modal layout</Label>
            <div className="text-xs text-gray-500 p-3 bg-gray-50 rounded-md border border-gray-200">
              <p className="font-medium mb-1">Edit layout in the record modal</p>
              <p>
                With the page in edit mode, open a record to customize the layout. Use &quot;Add column&quot; to create a multi-column grid, drag fields between columns to arrange them, and drag the resize handles between columns to adjust widths. Changes save when you click Done.
              </p>
            </div>
            {((config as any).field_layout && (config as any).field_layout.length > 0) ||
            (config.modal_layout?.blocks && config.modal_layout.blocks.length > 0) ? (
              <p className="text-xs text-gray-500">Custom layout configured</p>
            ) : null}
          </div>
        )}
      </div>

      {/* View Type Selection - Card Style */}
      <div className="space-y-2">
        <Label>View Type *</Label>
        <div className="grid grid-cols-2 gap-2">
          {VIEW_TYPE_OPTIONS.map((option) => {
            const Icon = option.icon
            const isCompatible = compatibleTypes.includes(option.type)
            const isSelected = currentViewType === option.type

            return (
              <button
                key={option.type}
                type="button"
                onClick={() => handleSelectViewType(option.type)}
                disabled={!isCompatible}
                className={`
                  p-3 border rounded-lg text-left transition-all
                  ${isSelected 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                  }
                  ${!isCompatible 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'cursor-pointer hover:bg-gray-50'
                  }
                `}
              >
                <div className="flex items-start gap-2">
                  <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{option.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {option.description}
                    </div>
                    {!isCompatible && (
                      <div className="text-xs text-amber-600 mt-1">
                        {option.type === 'gallery'
                          ? 'Requires an attachment or URL field'
                          : 'Requires date fields'}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-gray-500">
          Table, Calendar, Kanban, Timeline, Gallery, and List views are supported.
        </p>
      </div>

      {/* F. Fields - single source of truth (list rows, grid columns, gallery cards, calendar previews). Kanban has its own selector below. */}
      {config.table_id && fields.length > 0 && (() => {
        const fieldLayout = (config as any).field_layout || []
        const visibleFields =
          fieldLayout.length > 0
            ? fieldLayout
                .filter((item: any) => item.visible_in_card !== false)
                .map((item: any) => item.field_name)
            : Array.isArray(config.visible_fields)
              ? config.visible_fields
              : []
        return (
          <div className="border-t border-gray-200 pt-4">
            <CardFieldsSelector
              value={visibleFields}
              onChange={(fieldNames) => {
                if (fieldLayout.length > 0) {
                  const layoutByField = new Map((fieldLayout as any[]).map((item: any) => [item.field_name, item]))
                  const updatedLayout = fieldNames.map((fieldName: string, i: number) => {
                    const existing = layoutByField.get(fieldName)
                    const field = fields.find((f) => f.name === fieldName)
                    if (existing) {
                      return { ...existing, order: i, visible_in_card: true, visible_in_modal: true }
                    }
                    if (field) {
                      return {
                        field_id: field.id,
                        field_name: field.name,
                        order: i,
                        visible_in_card: true,
                        visible_in_modal: true,
                        visible_in_canvas: true,
                        editable: true,
                        group_name: field.group_name,
                      }
                    }
                    return null
                  }).filter(Boolean) as any[]
                  onUpdate({ field_layout: updatedLayout, visible_fields: fieldNames } as any)
                } else {
                  onUpdate({ visible_fields: fieldNames })
                }
              }}
              fields={fields}
              label="Fields"
              description={
                currentViewType === 'timeline'
                  ? "Fields for record modal and side panel. Timeline cards use Title and Tag fields in the Timeline card section below."
                  : currentViewType === 'kanban'
                    ? "Visible fields in order. Single source of truth for list rows, grid columns, gallery cards, and calendar previews. Kanban uses the separate 'Fields on Kanban cards' below. If none selected, the title field is used."
                    : "Visible fields in order. Single source of truth for list rows, grid columns, gallery cards, and calendar previews. If none selected, the title field is used."
              }
              required={false}
            />
          </div>
        )
      })()}

      {/* F1b. Fields on Kanban cards - Kanban-only, overrides main Fields when set */}
      {config.table_id && fields.length > 0 && currentViewType === 'kanban' && (() => {
        const kanbanFields = Array.isArray((config as any).kanban_card_fields)
          ? (config as any).kanban_card_fields
          : []
        const fieldLayout = (config as any).field_layout || []
        const defaultFields =
          fieldLayout.length > 0
            ? fieldLayout.filter((item: any) => item.visible_in_card !== false).map((item: any) => item.field_name)
            : Array.isArray(config.visible_fields)
              ? config.visible_fields
              : []
        const displayValue = kanbanFields.length > 0 ? kanbanFields : defaultFields
        return (
          <div className="border-t border-gray-200 pt-4">
            <CardFieldsSelector
              value={displayValue}
              onChange={(fieldNames) => {
                onUpdate({ kanban_card_fields: fieldNames.length > 0 ? fieldNames : undefined } as any)
              }}
              fields={fields}
              label="Fields on Kanban cards"
              description="Fields to show on Kanban cards. When empty, uses the visible fields above. Configure different fields here for a Kanban-specific layout."
              required={false}
            />
          </div>
        )
      })()}

      {/* C. Filter - All records / Viewer's records / Specific (conditions) / Copy from view */}
      {(currentViewType === 'grid' || currentViewType === 'calendar' || currentViewType === 'kanban' || currentViewType === 'timeline' || currentViewType === 'gallery' || currentViewType === 'list') && config.table_id && fields.length > 0 && (
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-900">Filter</h3>
          <div className="space-y-2">
            <Label>Records to show</Label>
            <Select
              value={(config as any).filter_mode || "all"}
              onValueChange={(value) => onUpdate({ filter_mode: value } as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All records</SelectItem>
                <SelectItem value="viewer">Viewer&apos;s records only</SelectItem>
                <SelectItem value="specific">Specific records (conditions)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              {(config as any).filter_mode === "viewer" &&
                "Only records associated with the current user (e.g. created by, assigned to)."}
              {(config as any).filter_mode === "specific" &&
                "Define conditions below. Only matching records are shown."}
              {((config as any).filter_mode || "all") === "all" && "Show all records from the table."}
            </p>
          </div>
          {(config as any).filter_mode === "specific" && (
            <BlockFilterEditor
              filters={config.filters || []}
              tableFields={fields}
              config={config}
              onChange={(filters) => onUpdate({ filters })}
              onConfigUpdate={(updates) => onUpdate(updates)}
            />
          )}
          {config.view_id && (
            <div className="space-y-2">
              <Label>Copy settings from view</Label>
              <p className="text-xs text-gray-500">
                Copy this view&apos;s filters, sort, and visible fields into the block. Block can override them locally after.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopySettingsFromView}
                disabled={!viewMeta}
              >
                {viewMeta ? "Copy from selected view" : "Loading view…"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Sorts (optional) - For Grid view only (Gallery, Calendar, Timeline, Kanban have their own in Options sections) */}
      {currentViewType === 'grid' && config.table_id && fields.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          <SortSelector
            value={Array.isArray(config.sorts) ? config.sorts : undefined}
            onChange={(sorts) => onUpdate({ sorts: sorts as any })}
            fields={fields}
            allowMultiple={false}
          />
        </div>
      )}

      {/* Grouping (Optional) - Table + Gallery */}
      {(currentViewType === 'grid' || currentViewType === 'gallery') && config.table_id && fields.length > 0 && (
        <>
          <NestedGroupBySelector
            value={(config as any).group_by_field || (config as any).group_by}
            groupByRules={(config as any).group_by_rules}
            onChange={(value) => {
              onUpdate({
                group_by_field: value,
                group_by: value,
                // Clear group_by_rules if using legacy single field
                ...(value ? {} : { group_by_rules: null }),
              } as any)
            }}
            onRulesChange={(rules) => {
              onUpdate({
                group_by_rules: rules,
                // For backward compatibility, also set group_by_field to first rule's field
                group_by_field: rules && rules.length > 0 && rules[0].type === 'field' ? rules[0].field : null,
                group_by: rules && rules.length > 0 && rules[0].type === 'field' ? rules[0].field : null,
              } as any)
            }}
            fields={fields}
            filterGroupableFields={true}
            description={
              currentViewType === 'gallery'
                ? "Add up to 2 grouping levels to group cards into nested collapsible sections (like Airtable)."
                : "Add up to 2 grouping levels to group rows into nested collapsible sections (like Airtable)."
            }
          />
          
          {/* Group Load Behavior */}
          {((config as any).group_by_field || (config as any).group_by) && (config as any).group_by !== "__none__" && (
            <div className="space-y-2">
              <Label>Groups on load</Label>
              <Select
                value={
                  ((config as any)?.grid_groups_default_collapsed ??
                    (config as any)?.gallery_groups_default_collapsed ??
                    true)
                    ? "closed"
                    : "open"
                }
                onValueChange={(value) => {
                  const closed = value === "closed"
                  onUpdate({
                    grid_groups_default_collapsed: closed,
                    gallery_groups_default_collapsed: closed,
                  } as any)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="closed">Closed (collapsed)</SelectItem>
                  <SelectItem value="open">Open (expanded)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Control whether grouped sections start expanded or collapsed when the view loads.
              </p>
            </div>
          )}
        </>
      )}

      {/* Calendar-Specific Settings - Airtable Style */}
      {currentViewType === 'calendar' && config.table_id && fields.length > 0 && (
        <>
          {/* Options Section - Airtable Style */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <Label className="text-sm font-semibold">Options</Label>
            
            {/* Date Settings */}
            <DateFieldSelector
              startDateField={
                config.start_date_field ||
                config.calendar_date_field ||
                config.from_date_field
              }
              endDateField={config.end_date_field || config.to_date_field}
              onStartDateChange={(value) =>
                onUpdate({
                  start_date_field: value,
                  from_date_field: value,
                  calendar_date_field: value,
                })
              }
              onEndDateChange={(value) =>
                onUpdate({
                  end_date_field: value,
                  to_date_field: value,
                })
              }
              fields={fields}
            />

            {/* Default Date Range Preset */}
            <div className="space-y-2">
              <Label className="text-sm">Default Date Range</Label>
              <Select
                value={config.default_date_range_preset || 'thisWeek'}
                onValueChange={(value) =>
                  onUpdate({ default_date_range_preset: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select default date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="thisWeek">This Week</SelectItem>
                  <SelectItem value="thisMonth">This Month</SelectItem>
                  <SelectItem value="nextWeek">Next Week</SelectItem>
                  <SelectItem value="nextMonth">Next Month</SelectItem>
                  <SelectItem value="none">No Default (Custom)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                The calendar will automatically show this date range when first loaded. Default: This Week
              </p>
            </div>

            {/* Sort */}
            <SortSelector
              value={Array.isArray(config.sorts) ? config.sorts : undefined}
              onChange={(sorts) => onUpdate({ sorts: sorts as any })}
              fields={fields}
              allowMultiple={false}
              label="Sort"
            />
          </div>

          {/* Card/visible fields: use "Fields to Show on Cards/Table" at top of panel */}
        </>
      )}

      {/* Gallery-Specific Settings - Airtable Style */}
      {currentViewType === 'gallery' && config.table_id && fields.length > 0 && (
        <>
          {/* Card fields explanation */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <Label className="text-sm font-semibold">Card fields</Label>
            <p className="text-xs text-gray-500">
              Gallery cards use the ordered <span className="font-medium">Fields to Show on Cards/Table</span> above: the first field is the card title, the next 3 fields appear below the cover image. Set the cover image in <span className="font-medium">Appearance</span>.
            </p>
          </div>

          {/* Options Section - Airtable Style */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <Label className="text-sm font-semibold">Options</Label>
            
            {/* Sort */}
            <SortSelector
              value={Array.isArray(config.sorts) ? config.sorts : undefined}
              onChange={(sorts) => onUpdate({ sorts: sorts as any })}
              fields={fields}
              allowMultiple={false}
              label="Sort"
            />
          </div>
        </>
      )}

      {/* Kanban-Specific Settings - Airtable Style */}
      {currentViewType === 'kanban' && config.table_id && fields.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-gray-200">
          <Label className="text-sm font-semibold">Options</Label>
          
          {/* Grouping Field Settings */}
          <GroupBySelector
            value={config.group_by_field || config.group_by || config.kanban_group_field}
            onChange={(value) =>
              onUpdate({
                group_by_field: value,
                group_by: value,
                kanban_group_field: value,
              })
            }
            fields={fields}
            filterGroupableFields={false}
            label="Group by *"
            description="Select a single-select or multi-select field to group cards into columns."
            placeholder="Select a select field"
          />
          {fields.filter((f) => f.type === "single_select" || f.type === "multi_select").length ===
            0 && (
            <p className="text-xs text-amber-600 mt-1">
              No select fields found. Please add a single-select or multi-select field to the
              table.
            </p>
          )}

          {/* Sort */}
          <SortSelector
            value={Array.isArray(config.sorts) ? config.sorts : undefined}
            onChange={(sorts) => onUpdate({ sorts: sorts as any })}
            fields={fields}
            allowMultiple={false}
            label="Sort"
          />
        </div>
      )}

      {/* Timeline-Specific Settings - Airtable Style */}
      {currentViewType === 'timeline' && config.table_id && fields.length > 0 && (
        <>
          {/* Options Section - Airtable Style */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <Label className="text-sm font-semibold">Options</Label>
            
            {/* Date Settings */}
            <DateFieldSelector
              startDateField={
                config.start_date_field ||
                config.date_from ||
                config.from_date_field ||
                config.timeline_date_field
              }
              endDateField={config.end_date_field || config.date_to || config.to_date_field}
              onStartDateChange={(value) =>
                onUpdate({
                  start_date_field: value,
                  date_from: value,
                  from_date_field: value,
                  timeline_date_field: value,
                })
              }
              onEndDateChange={(value) =>
                onUpdate({
                  end_date_field: value,
                  date_to: value,
                  to_date_field: value,
                })
              }
              fields={fields}
            />

            {/* Group by Select Field */}
            <GroupBySelector
              value={config.timeline_group_by || config.group_by_field || config.group_by}
              onChange={(value) =>
                onUpdate({
                  timeline_group_by: value,
                  group_by_field: value,
                  group_by: value,
                })
              }
              fields={fields}
              filterGroupableFields={false}
              label="Group by (Optional)"
              description="Group timeline events by a field value. Each group appears as a separate lane."
            />

            {/* Sort */}
            <SortSelector
              value={Array.isArray(config.sorts) ? config.sorts : undefined}
              onChange={(sorts) => onUpdate({ sorts: sorts as any })}
              fields={fields}
              allowMultiple={false}
              label="Sort"
            />
          </div>

          {/* Compact card configuration: Title, Tag, Compact mode */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <Label className="text-sm font-semibold">Timeline card</Label>
            <p className="text-xs text-gray-500">
              Cards show title, optional tag, and colour. Set colour in <span className="font-medium">Appearance</span> tab.
            </p>

            <div className="space-y-2">
              <Label>Title field</Label>
              <Select
                value={
                  config.timeline_title_field ||
                  config.card_title_field ||
                  (() => {
                    const primary = fields.find(f =>
                      (f.type === 'text' || f.type === 'long_text') &&
                      (f.name.toLowerCase() === 'name' || f.name.toLowerCase() === 'title')
                    )
                    return primary?.name || (fields.find(f => f.type === 'text' || f.type === 'long_text')?.name) || "__first__"
                  })()
                }
                onValueChange={(value) =>
                  onUpdate({
                    timeline_title_field: value === "__first__" ? undefined : (value as any),
                    card_title_field: value === "__first__" ? undefined : (value as any),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select title field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__first__">First text field</SelectItem>
                  {fields
                    .filter((f) => f.name !== "id" && f.type !== "date")
                    .map((field) => (
                      <SelectItem key={field.id} value={field.name}>
                        {getFieldDisplayName(field)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tag field (optional)</Label>
              <Select
                value={config.timeline_tag_field || config.timeline_field_1 || config.card_field_1 || "__none__"}
                onValueChange={(value) =>
                  onUpdate({
                    timeline_tag_field: value === "__none__" ? undefined : (value as any),
                    timeline_field_1: value === "__none__" ? undefined : (value as any),
                    card_field_1: value === "__none__" ? undefined : (value as any),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {fields
                    .filter((f) =>
                      f.name !== "id" &&
                      (f.type === "single_select" || f.type === "multi_select" || f.type === "link_to_table")
                    )
                    .map((field) => (
                      <SelectItem key={field.id} value={field.name}>
                        {getFieldDisplayName(field)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Max 1 pill per card. Select, multi-select, or linked fields only.</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Compact mode</Label>
                <p className="text-xs text-gray-500">28px cards when ON, 40px when OFF</p>
              </div>
              <Switch
                checked={config.timeline_compact_mode ?? false}
                onCheckedChange={(c) => onUpdate({ timeline_compact_mode: c } as any)}
              />
            </div>
          </div>
        </>
      )}

      {/* List-Specific Settings - Options: title override, sort, grouping */}
      {currentViewType === 'list' && config.table_id && fields.length > 0 && (
        <>
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <Label className="text-sm font-semibold">Options</Label>
            {/* Title field override: which field is the list row title (default: first in Fields list) */}
            <div className="space-y-2">
              <Label>Title field (override)</Label>
              <Select
                value={
                  config.list_title_field ||
                  config.title_field ||
                  (Array.isArray(config.visible_fields) && config.visible_fields[0]) ||
                  "__first__"
                }
                onValueChange={(value) =>
                  onUpdate({
                    list_title_field: value === "__first__" ? undefined : (value as any),
                    title_field: value === "__first__" ? undefined : (value as any),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="First field in list" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__first__">First field in Fields list</SelectItem>
                  {fields.filter((f) => f.name !== "id").map((field) => (
                    <SelectItem key={field.id} value={field.name}>
                      {getFieldDisplayName(field)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Which field is the list row title. Default: first field in the Fields list above.
              </p>
            </div>
            <SortSelector
              value={Array.isArray(config.sorts) ? config.sorts : undefined}
              onChange={(sorts) => onUpdate({ sorts: sorts as any })}
              fields={fields}
              allowMultiple={false}
              label="Sort"
            />
          </div>
          {/* Grouping (Optional) - List */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <NestedGroupBySelector
              value={(config as any).group_by_field || (config as any).group_by}
              groupByRules={(config as any).group_by_rules}
              onChange={(value) => {
                onUpdate({
                  group_by_field: value,
                  group_by: value,
                  ...(value ? {} : { group_by_rules: null }),
                } as any)
              }}
              onRulesChange={(rules) => {
                onUpdate({
                  group_by_rules: rules,
                  group_by_field: rules && rules.length > 0 && rules[0].type === 'field' ? rules[0].field : null,
                  group_by: rules && rules.length > 0 && rules[0].type === 'field' ? rules[0].field : null,
                } as any)
              }}
              fields={fields}
              filterGroupableFields={true}
              description="Add up to 2 grouping levels to group records into nested collapsible sections (like Airtable)."
            />
            {((config as any).group_by_field || (config as any).group_by) && (config as any).group_by !== "__none__" && (
              <div className="space-y-2">
                <Label>Groups on load</Label>
                <Select
                  value={
                    ((config as any)?.list_groups_default_collapsed ??
                      (config as any)?.list_choice_groups_default_collapsed ??
                      true)
                      ? "closed"
                      : "open"
                  }
                  onValueChange={(value) => {
                    const closed = value === "closed"
                    onUpdate({
                      list_groups_default_collapsed: closed,
                      list_choice_groups_default_collapsed: closed,
                    } as any)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="closed">Closed (collapsed)</SelectItem>
                    <SelectItem value="open">Open (expanded)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Control whether grouped sections start expanded or collapsed when the list loads.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

