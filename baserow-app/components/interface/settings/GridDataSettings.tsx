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
import { Grid, Columns, Calendar, Image as ImageIcon, GitBranch, List, X, LayoutGrid } from "lucide-react"
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
          Table, Calendar, Kanban, Timeline, Gallery, and List views are supported.
        </p>
      </div>

      {/* Fields to Show on Cards/Table - Required */}
      {config.table_id && fields.length > 0 && (() => {
        // Read from field_layout if available, otherwise use old format
        const fieldLayout = (config as any).field_layout || []
        const cardFields = fieldLayout.length > 0
          ? fieldLayout.filter((item: any) => item.visible_in_card !== false).map((item: any) => item.field_name)
          : (Array.isArray(config.visible_fields) ? config.visible_fields : [])
        
        return (
          <CardFieldsSelector
            value={cardFields}
            onChange={async (fieldNames) => {
              // Update field_layout if it exists, otherwise update old format
              if (fieldLayout.length > 0) {
                const updatedLayout = fieldLayout.map((item: any) => ({
                  ...item,
                  visible_in_card: fieldNames.includes(item.field_name),
                }))
                // Add any new fields
                fieldNames.forEach((fieldName: string) => {
                  if (!updatedLayout.some((item: any) => item.field_name === fieldName)) {
                    const field = fields.find(f => f.name === fieldName)
                    if (field) {
                      updatedLayout.push({
                        field_id: field.id,
                        field_name: field.name,
                        order: updatedLayout.length,
                        visible_in_card: true,
                        visible_in_modal: true,
                        visible_in_canvas: true,
                        editable: true,
                        group_name: field.group_name,
                      })
                    }
                  }
                })
                await onUpdate({ field_layout: updatedLayout, visible_fields: fieldNames } as any)
              } else {
                await onUpdate({ visible_fields: fieldNames })
              }
            }}
            fields={fields}
            required={true}
          />
        )
      })()}

      {/* Fields to Show in Modal */}
      {config.table_id && fields.length > 0 && (() => {
        // Read from field_layout if available, otherwise use old format
        const fieldLayout = (config as any).field_layout || []
        const modalFields = fieldLayout.length > 0
          ? fieldLayout.filter((item: any) => item.visible_in_modal !== false).map((item: any) => item.field_name)
          : (Array.isArray((config as any).modal_fields) ? (config as any).modal_fields : [])
        
        return (
          <div className="pt-4 border-t border-gray-200 space-y-4">
            <ModalFieldsSelector
              value={modalFields}
              onChange={async (fieldNames) => {
                // Update field_layout if it exists, otherwise update old format
                if (fieldLayout.length > 0) {
                  const updatedLayout = fieldLayout.map((item: any) => ({
                    ...item,
                    visible_in_modal: fieldNames.includes(item.field_name),
                  }))
                  // Add any new fields
                  fieldNames.forEach((fieldName: string) => {
                    if (!updatedLayout.some((item: any) => item.field_name === fieldName)) {
                      const field = fields.find(f => f.name === fieldName)
                      if (field) {
                        updatedLayout.push({
                          field_id: field.id,
                          field_name: field.name,
                          order: updatedLayout.length,
                          visible_in_card: true,
                          visible_in_modal: true,
                          visible_in_canvas: true,
                          editable: true,
                          group_name: field.group_name,
                        })
                      }
                    }
                  })
                  await onUpdate({ field_layout: updatedLayout, modal_fields: fieldNames } as any)
                } else {
                  await onUpdate({ modal_fields: fieldNames } as any)
                }
              }}
              fields={fields}
            />
          
          {/* Modal Layout - edited in-context from the record modal */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Modal Layout</Label>
              {onOpenRecordForLayoutEdit && config.table_id && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (config.table_id) {
                      await onOpenRecordForLayoutEdit(config.table_id)
                    }
                  }}
                  className="gap-1.5"
                >
                  <LayoutGrid className="h-4 w-4" />
                  Edit modal layout
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {onOpenRecordForLayoutEdit
                ? "Click &quot;Edit modal layout&quot; to open a record and customize the layout. Drag and drop fields to reorder them."
                : "Open a record to edit the modal layout. In the record modal, use &quot;Edit layout&quot; to reorder and add or remove fields. Changes save when you click Done."}
            </p>
            {config.modal_layout?.blocks && config.modal_layout.blocks.length > 0 && (
              <p className="text-xs text-gray-500">
                Custom layout with {config.modal_layout.blocks.length} field{config.modal_layout.blocks.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Filters (optional) - For Table, Calendar, Kanban, Timeline, Gallery, and List views */}
      {(currentViewType === 'grid' || currentViewType === 'calendar' || currentViewType === 'kanban' || currentViewType === 'timeline' || currentViewType === 'gallery' || currentViewType === 'list') && config.table_id && fields.length > 0 && (
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

          {/* Card fields explanation - uses Fields to Show on Cards/Table above */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <Label className="text-sm font-semibold">Card fields</Label>
            <p className="text-xs text-gray-500">
              Timeline cards use the ordered <span className="font-medium">Fields to Show on Cards/Table</span> selection above.
              Only the first <span className="font-medium">3</span> non-date fields are shown on each card to keep lanes compact.
            </p>
          </div>
        </>
      )}

      {/* List-Specific Settings - Airtable Style */}
      {currentViewType === 'list' && config.table_id && fields.length > 0 && (
        <>
          {/* Options Section - Airtable Style */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <Label className="text-sm font-semibold">Options</Label>
            
            {/* List-specific field configuration */}
            {(() => {
              // List-specific field configuration
              const titleField = config.list_title_field || config.title_field || ""
              const subtitleFields = config.list_subtitle_fields || []
              const imageField = config.list_image_field || config.image_field || ""
              const pillFields = config.list_pill_fields || []
              const metaFields = config.list_meta_fields || []
              const choiceGroupsDefaultCollapsed =
                (config as any)?.list_groups_default_collapsed ??
                (config as any)?.list_choice_groups_default_collapsed ??
                true

              // Get available fields for selection
              const textFields = fields.filter(f => f.type === 'text' || f.type === 'long_text')
              const allFields = fields
              const selectFields = fields.filter(f => f.type === 'single_select' || f.type === 'multi_select')
              const attachmentFields = fields.filter(f => f.type === 'attachment')
              const dateFields = fields.filter(f => f.type === 'date')
              const numberFields = fields.filter(f => f.type === 'number' || f.type === 'percent' || f.type === 'currency')

              const handleTitleFieldChange = (fieldName: string) => {
                const value = fieldName === "__none__" ? null : fieldName
                onUpdate({
                  list_title_field: value as any,
                  title_field: value as any, // Backward compatibility
                })
              }

              const handleSubtitleFieldAdd = (fieldName: string) => {
                if (fieldName && !subtitleFields.includes(fieldName) && subtitleFields.length < 3) {
                  onUpdate({
                    list_subtitle_fields: [...subtitleFields, fieldName],
                  })
                }
              }

              const handleSubtitleFieldRemove = (index: number) => {
                onUpdate({
                  list_subtitle_fields: subtitleFields.filter((_, i) => i !== index),
                })
              }

              const handleImageFieldChange = (fieldName: string) => {
                const value = fieldName === "__none__" ? null : fieldName
                onUpdate({
                  list_image_field: value as any,
                  image_field: value as any, // Backward compatibility
                })
              }

              const handlePillFieldAdd = (fieldName: string) => {
                if (fieldName && !pillFields.includes(fieldName)) {
                  onUpdate({
                    list_pill_fields: [...pillFields, fieldName].filter(Boolean),
                  })
                }
              }

              const handlePillFieldRemove = (index: number) => {
                onUpdate({
                  list_pill_fields: pillFields.filter((_, i) => i !== index),
                })
              }

              const handleMetaFieldAdd = (fieldName: string) => {
                if (fieldName && !metaFields.includes(fieldName)) {
                  onUpdate({
                    list_meta_fields: [...metaFields, fieldName].filter(Boolean),
                  })
                }
              }

              const handleMetaFieldRemove = (index: number) => {
                onUpdate({
                  list_meta_fields: metaFields.filter((_, i) => i !== index),
                })
              }

              const getAvailableSubtitleFields = () => {
                return allFields.filter(f => f.name !== titleField)
              }

              const getAvailablePillFields = () => {
                return selectFields.filter(f => !pillFields.includes(f.name))
              }

              const getAvailableMetaFields = () => {
                return [...dateFields, ...numberFields].filter(f => !metaFields.includes(f.name))
              }

              return (
                <>
                  {/* Title Field (Required) */}
                  <div className="space-y-2">
                    <Label>
                      Title Field <span className="text-red-500">*</span>
                    </Label>
                    <Select value={titleField || "__none__"} onValueChange={handleTitleFieldChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select title field" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {textFields.map((field) => (
                          <SelectItem key={field.id} value={getFieldDisplayName(field)}>
                            {getFieldDisplayName(field)}
                          </SelectItem>
                        ))}
                        {/* Fallback: show all fields if no text fields */}
                        {textFields.length === 0 && allFields.map((field) => (
                          <SelectItem key={field.id} value={getFieldDisplayName(field)}>
                            {getFieldDisplayName(field)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      The primary field displayed as the list item title
                    </p>
                  </div>

                  {/* Subtitle Fields (Optional, up to 3) */}
                  <div className="space-y-2">
                    <Label>Subtitle Fields (Optional, up to 3)</Label>
                    {subtitleFields.map((fieldName, index) => {
                      return (
                        <div key={index} className="flex items-center gap-2">
                          <Select
                            value={fieldName || "__none__"}
                            onValueChange={(newFieldName) => {
                              const updated = [...subtitleFields]
                              updated[index] = newFieldName === "__none__" ? "" : newFieldName
                              onUpdate({ list_subtitle_fields: updated.filter(Boolean) })
                            }}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">None</SelectItem>
                              {getAvailableSubtitleFields().map((f) => (
                                <SelectItem key={f.id} value={getFieldDisplayName(f)}>
                                  {getFieldDisplayName(f)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSubtitleFieldRemove(index)}
                            className="flex-shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}
                    {subtitleFields.length < 3 && (
                      <Select
                        value=""
                        onValueChange={handleSubtitleFieldAdd}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Add subtitle field" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableSubtitleFields().map((field) => (
                            <SelectItem key={field.id} value={getFieldDisplayName(field)}>
                              {getFieldDisplayName(field)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <p className="text-xs text-gray-500">
                      Additional fields displayed below the title (1-3 fields)
                    </p>
                  </div>

                  {/* Image Field (Optional) */}
                  <div className="space-y-2">
                    <Label>Image Field (Optional)</Label>
                    <Select value={imageField || "__none__"} onValueChange={handleImageFieldChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select image field" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {attachmentFields.map((field) => (
                          <SelectItem key={field.id} value={getFieldDisplayName(field)}>
                            {getFieldDisplayName(field)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Field containing images/attachments to display as thumbnails
                    </p>
                  </div>

                  {/* Pill Fields (Optional) */}
                  <div className="space-y-2">
                    <Label>Pill Fields (Optional)</Label>
                    {pillFields.map((fieldName, index) => {
                      return (
                        <div key={index} className="flex items-center gap-2">
                          <Select
                            value={fieldName || "__none__"}
                            onValueChange={(newFieldName) => {
                              const updated = [...pillFields]
                              updated[index] = newFieldName === "__none__" ? "" : newFieldName
                              onUpdate({ list_pill_fields: updated.filter(Boolean) })
                            }}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">None</SelectItem>
                              {selectFields.map((f) => (
                                <SelectItem key={f.id} value={getFieldDisplayName(f)}>
                                  {getFieldDisplayName(f)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePillFieldRemove(index)}
                            className="flex-shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}
                    <Select
                      value=""
                      onValueChange={handlePillFieldAdd}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Add pill field" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailablePillFields().map((field) => (
                          <SelectItem key={field.id} value={getFieldDisplayName(field)}>
                            {getFieldDisplayName(field)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Select/multi-select fields displayed as colored pills
                    </p>
                  </div>

                  {/* Meta Fields (Optional) */}
                  <div className="space-y-2">
                    <Label>Meta Fields (Optional)</Label>
                    {metaFields.map((fieldName, index) => {
                      return (
                        <div key={index} className="flex items-center gap-2">
                          <Select
                            value={fieldName || "__none__"}
                            onValueChange={(newFieldName) => {
                              const updated = [...metaFields]
                              updated[index] = newFieldName === "__none__" ? "" : newFieldName
                              onUpdate({ list_meta_fields: updated.filter(Boolean) })
                            }}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">None</SelectItem>
                              {[...dateFields, ...numberFields].map((f) => (
                                <SelectItem key={f.id} value={getFieldDisplayName(f)}>
                                  {getFieldDisplayName(f)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMetaFieldRemove(index)}
                            className="flex-shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}
                    <Select
                      value=""
                      onValueChange={handleMetaFieldAdd}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Add meta field" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableMetaFields().map((field) => (
                          <SelectItem key={field.id} value={getFieldDisplayName(field)}>
                            {getFieldDisplayName(field)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Date or number fields displayed as metadata
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
                </>
              )
            })()}
          </div>

          {/* Grouping (Optional) - List */}
          {config.table_id && fields.length > 0 && (
            <>
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
              
              {/* Group Load Behavior */}
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
            </>
          )}

          {/* Visible fields: use "Fields to Show on Cards/Table" at top of panel */}
        </>
      )}
    </div>
  )
}

