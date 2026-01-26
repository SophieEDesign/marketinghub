"use client"

import { useMemo } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Grid, Columns, Calendar, Image as ImageIcon, GitBranch } from "lucide-react"
import type { BlockConfig, ViewType } from "@/lib/interface/types"
import type { Table, View, TableField } from "@/types/database"
import type { FieldType } from "@/types/fields"
import BlockFilterEditor from "./BlockFilterEditor"
import { getFieldDisplayName } from "@/lib/fields/display"
import TableSelector from "./shared/TableSelector"
import ViewSelector from "./shared/ViewSelector"
import CardFieldsSelector from "./shared/CardFieldsSelector"
import ModalFieldsSelector from "./shared/ModalFieldsSelector"
import DateFieldSelector from "./shared/DateFieldSelector"
import GroupBySelector from "./shared/GroupBySelector"
import NestedGroupBySelector from "./shared/NestedGroupBySelector"
import type { GroupRule } from "@/lib/grouping/types"
import SortSelector from "./shared/SortSelector"
import FieldPicker from "./shared/FieldPicker"
import ModalLayoutEditor from "./ModalLayoutEditor"
import { useState } from "react"

interface GridDataSettingsProps {
  config: BlockConfig
  tables: Table[]
  views: View[]
  fields: TableField[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
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
]

export default function GridDataSettings({
  config,
  tables,
  views,
  fields,
  onUpdate,
  onTableChange,
}: GridDataSettingsProps) {
  const [modalLayoutEditorOpen, setModalLayoutEditorOpen] = useState(false)

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
          Table, Calendar, Kanban, Timeline, and Gallery views are supported.
        </p>
      </div>

      {/* Fields to Show on Cards/Table - Required */}
      {config.table_id && fields.length > 0 && (
        <CardFieldsSelector
          value={Array.isArray(config.visible_fields) ? config.visible_fields : []}
          onChange={(fieldNames) => onUpdate({ visible_fields: fieldNames })}
          fields={fields}
          required={true}
        />
      )}

      {/* Fields to Show in Modal */}
      {config.table_id && fields.length > 0 && (
        <div className="pt-4 border-t border-gray-200 space-y-4">
          <ModalFieldsSelector
            value={Array.isArray((config as any).modal_fields) ? (config as any).modal_fields : []}
            onChange={(fieldNames) => onUpdate({ modal_fields: fieldNames } as any)}
            fields={fields}
          />
          
          {/* Modal Layout Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label>Modal Layout</Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Customize the layout of fields in the record modal. Drag and resize fields to arrange them.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalLayoutEditorOpen(true)}
              >
                Edit Layout
              </Button>
            </div>
            {config.modal_layout?.blocks && config.modal_layout.blocks.length > 0 && (
              <p className="text-xs text-gray-500">
                Custom layout with {config.modal_layout.blocks.length} field{config.modal_layout.blocks.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Modal Layout Editor Dialog */}
      {config.table_id && (
        <ModalLayoutEditor
          open={modalLayoutEditorOpen}
          onOpenChange={setModalLayoutEditorOpen}
          config={config}
          fields={fields}
          tableId={config.table_id}
          onSave={(modalLayout) => {
            onUpdate({ modal_layout: modalLayout })
          }}
        />
      )}

      {/* Filters (optional) - For Table, Calendar, Kanban, Timeline, and Gallery views */}
      {(currentViewType === 'grid' || currentViewType === 'calendar' || currentViewType === 'kanban' || currentViewType === 'timeline' || currentViewType === 'gallery') && config.table_id && fields.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          <BlockFilterEditor
            filters={config.filters || []}
            tableFields={fields}
            config={config}
            onChange={(filters) => onUpdate({ filters })}
            onConfigUpdate={(updates) => onUpdate(updates)}
          />
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

          {/* Fields Section - Airtable Style */}
          <FieldPicker
            selectedFields={Array.isArray(config.visible_fields) ? config.visible_fields : []}
            onChange={(next) => onUpdate({ visible_fields: next })}
            fields={fields}
            mode="full"
            label="Fields"
            showPasteList={false}
          />
        </>
      )}

      {/* Gallery-Specific Settings - Airtable Style */}
      {currentViewType === 'gallery' && config.table_id && fields.length > 0 && (
        <>
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

          {/* Card Fields (Timeline) */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <Label className="text-sm font-semibold">Card fields</Label>
            <p className="text-xs text-gray-500">
              Timeline cards use the ordered <span className="font-medium">Fields to Show on Cards/Table</span> selection.
              Only the first <span className="font-medium">3</span> non-date fields are shown on each card to keep lanes compact.
            </p>
          </div>

          {/* Fields Section - Airtable Style */}
          <FieldPicker
            selectedFields={Array.isArray(config.visible_fields) ? config.visible_fields : []}
            onChange={(next) => onUpdate({ visible_fields: next })}
            fields={fields}
            mode="full"
            label="Fields"
          />
        </>
      )}
    </div>
  )
}

