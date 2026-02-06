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
import type { BlockConfig } from "@/lib/interface/types"
import type { Table, View, TableField } from "@/types/database"
import { getFieldDisplayName } from "@/lib/fields/display"
import TableSelector from "./shared/TableSelector"
import ViewSelector from "./shared/ViewSelector"
import BlockFilterEditor from "./BlockFilterEditor"
import SortSelector from "./shared/SortSelector"
import NestedGroupBySelector from "./shared/NestedGroupBySelector"
import CardFieldsSelector from "./shared/CardFieldsSelector"
import ModalFieldsSelector from "./shared/ModalFieldsSelector"

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

      {hasTableAndFields && (
        <div className="space-y-2 border-t pt-4">
          <CardFieldsSelector
            value={Array.isArray(config.visible_fields) ? config.visible_fields : []}
            onChange={(fieldNames) => onUpdate({ visible_fields: fieldNames })}
            fields={fields}
            label="Fields to show on canvas"
            description="Choose which fields appear in the record list. Order determines display."
            required={false}
          />
        </div>
      )}

      {hasTableAndFields && (
        <div className="space-y-2 border-t pt-4">
          <ModalFieldsSelector
            value={Array.isArray((config as any).modal_fields) ? (config as any).modal_fields : []}
            onChange={(fieldNames) => onUpdate({ modal_fields: fieldNames } as any)}
            fields={fields}
          />
          <p className="text-xs text-muted-foreground">
            Fields shown in the right panel when a record is selected (full-page mode). Leave empty to show all fields. These fields are editable when the page allows editing.
          </p>
        </div>
      )}

      <div className="space-y-2">
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

      {hasTableAndFields && (
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
        const attachmentFields = fields.filter(f => f.type === 'attachment')
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
                        <SelectItem key={f.id} value={getFieldDisplayName(f)}>
                          {getFieldDisplayName(f)}
                        </SelectItem>
                      ))
                    : allFields.map((f) => (
                        <SelectItem key={f.id} value={getFieldDisplayName(f)}>
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
                      <SelectItem key={f.id} value={getFieldDisplayName(f)}>
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
                  {attachmentFields.map((f) => (
                    <SelectItem key={f.id} value={getFieldDisplayName(f)}>
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
                    <SelectItem key={f.id} value={getFieldDisplayName(f)}>
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
                    <SelectItem key={f.id} value={getFieldDisplayName(f)}>
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
