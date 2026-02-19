"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { X } from "lucide-react"
import type { BlockConfig, BlockFilter } from "@/lib/interface/types"
import type { Table, View, ViewFilter, ViewSort, ViewField } from "@/types/database"
import type { TableField } from "@/types/fields"
import { getFieldDisplayName } from "@/lib/fields/display"
import TableSelector from "./shared/TableSelector"
import ViewSelector from "./shared/ViewSelector"
import BlockFilterEditor from "./BlockFilterEditor"
import SortSelector from "./shared/SortSelector"
import NestedGroupBySelector from "./shared/NestedGroupBySelector"
import ModalFieldsSelector from "./shared/ModalFieldsSelector"
import PermissionsSettings from "./PermissionsSettings"
import { useViewMeta } from "@/hooks/useViewMeta"

interface RecordContextDataSettingsProps {
  config: BlockConfig
  tables: Table[]
  views: View[]
  fields: TableField[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
}

type DisplayMode = "list" | "grid" | "compact"

export default function RecordContextDataSettings({
  config,
  tables,
  views,
  fields,
  onUpdate,
  onTableChange,
}: RecordContextDataSettingsProps) {
  const [selectedTableId, setSelectedTableId] = useState<string>(config.table_id || "")

  useEffect(() => {
    setSelectedTableId(config.table_id || "")
  }, [config.table_id])

  const displayMode = (config.displayMode ?? (config as any).display_mode ?? "list") as DisplayMode

  const handleTableChange = async (tableId: string) => {
    setSelectedTableId(tableId)
    await onTableChange(tableId)
    onUpdate({ table_id: tableId })
  }

  const hasTableAndFields = config.table_id && fields.length > 0
  const isListMode = displayMode === "list"
  const { metadata: viewMetaData } = useViewMeta(config.view_id, config.table_id)

  const handleCopySettingsFromView = () => {
    if (!viewMetaData) return
    const filters: BlockFilter[] = (viewMetaData.filters || []).map((f: ViewFilter) => ({
      field: f.field_name,
      operator: (f.operator || "equal") as BlockFilter["operator"],
      value: f.value,
    }))
    const sorts = (viewMetaData.sorts || []).map((s: ViewSort) => ({
      field: s.field_name,
      direction: (s.direction || "asc") as "asc" | "desc",
    }))
    const visibleFields = (viewMetaData.fields || [])
      .filter((f: ViewField) => f.visible !== false)
      .sort((a: ViewField, b: ViewField) => (a.position ?? 0) - (b.position ?? 0))
      .map((f: ViewField) => f.field_name)
    onUpdate({
      filters,
      sorts: sorts as any,
      visible_fields: visibleFields.length > 0 ? visibleFields : undefined,
      filter_mode: filters.length > 0 ? "specific" : (config as any).filter_mode,
    } as any)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Table</Label>
        <TableSelector
          tables={tables}
          value={selectedTableId}
          onChange={(tableId) => {
            void handleTableChange(tableId)
          }}
          label="Table"
        />
      </div>

      {config.table_id && (
        <ViewSelector
          value={config.view_id}
          onChange={(viewId) => onUpdate({ view_id: viewId })}
          views={views}
          tableId={config.table_id}
        />
      )}

      {/* Records: filter mode + Copy from view (Airtable-style) */}
      {hasTableAndFields && (
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-900">Records</h3>
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
                <SelectItem value="specific">Specific records</SelectItem>
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
          {config.view_id && (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopySettingsFromView}
                disabled={!viewMetaData}
              >
                {viewMetaData ? "Copy settings from a view" : "Loading view…"}
              </Button>
              <p className="text-xs text-gray-500">
                Copy this view&apos;s filters, sort, and visible fields into the block.
              </p>
            </div>
          )}
        </div>
      )}

      {hasTableAndFields && (
        <div className="space-y-2 border-t pt-4">
          <ModalFieldsSelector
            value={(() => {
              // Single source of truth: field_layout > modal_fields (right panel) > visible_fields (record list)
              const fl = (config as any).field_layout
              if (Array.isArray(fl) && fl.length > 0) {
                return fl
                  .filter((i: any) => i.visible_in_canvas !== false && i.visible_in_card !== false)
                  .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
                  .map((i: any) => i.field_name)
              }
              const mf = Array.isArray((config as any).modal_fields) ? (config as any).modal_fields : []
              const vf = Array.isArray(config.visible_fields) ? config.visible_fields : []
              return mf.length > 0 ? mf : vf
            })()}
            onChange={(fieldNames) => {
              const fl = (config as any).field_layout
              const allFieldNames = fields.map((f) => f.name)
              const visibleSet = new Set(fieldNames)
              const hidden = allFieldNames.filter((n) => n !== "id" && !visibleSet.has(n))
              const buildFieldLayout = () => {
                const items: Array<{ field_id: string; field_name: string; order: number; visible_in_modal?: boolean; visible_in_card?: boolean; visible_in_canvas?: boolean; editable: boolean }> = []
                let order = 0
                fieldNames.forEach((name) => {
                  const f = fields.find((x) => x.name === name || x.id === name)
                  if (f) {
                    items.push({
                      field_id: f.id,
                      field_name: f.name,
                      order: order++,
                      visible_in_modal: true,
                      visible_in_card: true,
                      visible_in_canvas: true,
                      editable: true,
                    })
                  }
                })
                hidden.forEach((name) => {
                  const f = fields.find((x) => x.name === name)
                  if (f) {
                    items.push({
                      field_id: f.id,
                      field_name: f.name,
                      order: order++,
                      visible_in_modal: false,
                      visible_in_card: false,
                      visible_in_canvas: false,
                      editable: false,
                    })
                  }
                })
                return items
              }
              onUpdate({
                visible_fields: fieldNames,
                modal_fields: fieldNames,
                field_layout: buildFieldLayout(),
              } as any)
            }}
            fields={fields}
            label="Fields to show"
            description="Visible and hidden fields for both the record list (left) and record detail panel (right). Same as Airtable: one list controls both. Leave empty to show all fields."
          />
        </div>
      )}

      {hasTableAndFields && (
        <div className="space-y-2 border-t pt-4">
          <Label>Display mode</Label>
          <Select
            value={displayMode}
            onValueChange={(value: DisplayMode) =>
              onUpdate({ displayMode: value, display_mode: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="List" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="list">List</SelectItem>
              <SelectItem value="grid">Grid</SelectItem>
              <SelectItem value="compact">Compact</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {(config as any).filter_mode === "specific" && hasTableAndFields && (
        <div className="space-y-2 border-t pt-4">
          <Label>Filters</Label>
          <BlockFilterEditor
            filters={config.filters || []}
            tableFields={fields}
            config={config}
            onChange={(filters) => onUpdate({ filters })}
            onConfigUpdate={(updates) => onUpdate(updates)}
          />
        </div>
      )}

      {hasTableAndFields && (
        <div className="space-y-2 border-t pt-4">
          <SortSelector
            value={Array.isArray(config.sorts) ? config.sorts : undefined}
            onChange={(sorts) => onUpdate({ sorts: sorts as any })}
            fields={fields}
            allowMultiple={false}
            label="Sort"
          />
        </div>
      )}

      {isListMode && hasTableAndFields && (() => {
        const titleField = config.list_title_field || (config as any).title_field || ""
        const subtitleFields = config.list_subtitle_fields || []
        const imageField = config.list_image_field || (config as any).image_field || ""
        const pillFields = config.list_pill_fields || []
        const metaFields = config.list_meta_fields || []
        const textFields = fields.filter(f => f.type === 'text' || f.type === 'long_text')
        const allFields = fields
        const selectFields = fields.filter(f => f.type === 'single_select' || f.type === 'multi_select')
        const imageFields = fields.filter(f => f.type === 'attachment' || f.type === 'url')
        const dateFields = fields.filter(f => f.type === 'date')
        const numberFields = fields.filter(f => f.type === 'number' || f.type === 'percent' || f.type === 'currency')

        const getAvailableSubtitleFields = () => allFields.filter(f => f.name !== titleField)
        const getAvailablePillFields = () => selectFields.filter(f => !pillFields.includes(f.name))
        const getAvailableMetaFields = () => [...dateFields, ...numberFields].filter(f => !metaFields.includes(f.name))

        return (
          <div className="space-y-4 border-t pt-4">
            <Label className="text-sm font-semibold">Card / list fields</Label>

            <div className="space-y-2">
              <Label>Title field <span className="text-red-500">*</span></Label>
              <Select
                value={titleField || "__none__"}
                onValueChange={(v) =>
                  onUpdate({
                    list_title_field: v === "__none__" ? undefined : (v as any),
                    title_field: v === "__none__" ? undefined : (v as any),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select title field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {textFields.length
                    ? textFields.map((f) => (
                        <SelectItem key={f.id} value={f.name}>
                          {getFieldDisplayName(f)}
                        </SelectItem>
                      ))
                    : allFields.map((f) => (
                        <SelectItem key={f.id} value={f.name}>
                          {getFieldDisplayName(f)}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Subtitle fields (optional, up to 3)</Label>
              {subtitleFields.map((fieldName, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={fieldName || "__none__"}
                    onValueChange={(newName) => {
                      const updated = [...subtitleFields]
                      updated[index] = newName === "__none__" ? "" : newName
                      onUpdate({ list_subtitle_fields: updated.filter(Boolean) })
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {getAvailableSubtitleFields().map((f) => (
                        <SelectItem key={f.id} value={f.name}>
                          {getFieldDisplayName(f)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onUpdate({
                        list_subtitle_fields: subtitleFields.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {subtitleFields.length < 3 && (
                <Select
                  value=""
                  onValueChange={(fieldName) => {
                    if (fieldName && !subtitleFields.includes(fieldName)) {
                      onUpdate({ list_subtitle_fields: [...subtitleFields, fieldName] })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Add subtitle field" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableSubtitleFields().map((f) => (
                      <SelectItem key={f.id} value={f.name}>
                        {getFieldDisplayName(f)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Image field (optional)</Label>
              <Select
                value={imageField || "__none__"}
                onValueChange={(v) =>
                  onUpdate({
                    list_image_field: v === "__none__" ? undefined : (v as any),
                    image_field: v === "__none__" ? undefined : (v as any),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select image field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {imageFields.map((f) => (
                    <SelectItem key={f.id} value={f.name}>
                      {getFieldDisplayName(f)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Pill fields (optional)</Label>
              {pillFields.map((fieldName, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={fieldName || "__none__"}
                    onValueChange={(newName) => {
                      const updated = [...pillFields]
                      updated[index] = newName === "__none__" ? "" : newName
                      onUpdate({ list_pill_fields: updated.filter(Boolean) })
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {selectFields.map((f) => (
                        <SelectItem key={f.id} value={f.name}>
                          {getFieldDisplayName(f)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onUpdate({
                        list_pill_fields: pillFields.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Select
                value=""
                onValueChange={(fieldName) => {
                  if (fieldName && !pillFields.includes(fieldName)) {
                    onUpdate({ list_pill_fields: [...pillFields, fieldName].filter(Boolean) })
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Add pill field" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailablePillFields().map((f) => (
                    <SelectItem key={f.id} value={f.name}>
                      {getFieldDisplayName(f)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Meta fields (optional)</Label>
              {metaFields.map((fieldName, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={fieldName || "__none__"}
                    onValueChange={(newName) => {
                      const updated = [...metaFields]
                      updated[index] = newName === "__none__" ? "" : newName
                      onUpdate({ list_meta_fields: updated.filter(Boolean) })
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {[...dateFields, ...numberFields].map((f) => (
                        <SelectItem key={f.id} value={f.name}>
                          {getFieldDisplayName(f)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onUpdate({
                        list_meta_fields: metaFields.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Select
                value=""
                onValueChange={(fieldName) => {
                  if (fieldName && !metaFields.includes(fieldName)) {
                    onUpdate({ list_meta_fields: [...metaFields, fieldName].filter(Boolean) })
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Add meta field" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableMetaFields().map((f) => (
                    <SelectItem key={f.id} value={f.name}>
                      {getFieldDisplayName(f)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </div>
        )
      })()}

      {isListMode && hasTableAndFields && (
        <div className="space-y-2 border-t pt-4">
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
            description="Add up to 2 grouping levels to group records into nested collapsible sections."
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
                Whether grouped sections start expanded or collapsed when the list loads.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Permissions (Airtable-style: Allow users to create new records, etc.) */}
      {hasTableAndFields && (
        <div className="space-y-4 border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-900">Permissions</h3>
          <PermissionsSettings config={config} onUpdate={onUpdate} />
        </div>
      )}

      <div className="space-y-3 border-t pt-4">
        <Label className="text-sm font-medium">Top bar</Label>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="record-context-show-search" className="flex-1 text-sm font-normal">
            Show search
          </Label>
          <Switch
            id="record-context-show-search"
            checked={config.show_search !== false}
            onCheckedChange={(checked) => onUpdate({ show_search: checked })}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="record-context-show-add-record" className="flex-1 text-sm font-normal">
            Show add new
          </Label>
          <Switch
            id="record-context-show-add-record"
            checked={(config as any).show_add_record === true}
            onCheckedChange={(checked) => onUpdate({ show_add_record: checked } as any)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Search and add-new appear at the top of the record list when enabled.
        </p>
      </div>

    </div>
  )
}
