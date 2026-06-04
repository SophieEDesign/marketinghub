"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PageConfig } from "@/lib/interface/page-config"
import type { TableField } from "@/types/database"
import { getFieldDisplayName } from "@/lib/fields/display"
import FilterBuilder from "@/components/filters/FilterBuilder"
import { filterConfigsToFilterTree } from "@/lib/filters/converters"
import type { FilterTree } from "@/lib/filters/canonical-model"
import NestedGroupBySelector from "./shared/NestedGroupBySelector"
import type { GroupRule } from "@/lib/grouping/types"
import FieldPicker from "./shared/FieldPicker"
import {
  detectMissingLeftPanelFields,
  patchLeftPanelConfig,
} from "@/lib/interface/record-view-left-panel-config"

interface RecordViewLeftPanelSettingsProps {
  config: PageConfig
  fields: TableField[]
  selectedTableId: string
  onUpdate: (updates: Partial<PageConfig>) => Promise<void>
}

function SettingsSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="space-y-3 border rounded-lg p-4 bg-card">
      <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wide">{title}</h4>
      {children}
    </div>
  )
}

export default function RecordViewLeftPanelSettings({
  config,
  fields,
  selectedTableId,
  onUpdate,
}: RecordViewLeftPanelSettingsProps) {
  const leftPanel = config.left_panel || {}

  const updateLeftPanel = async (patch: Record<string, unknown>) => {
    await onUpdate({
      left_panel: patchLeftPanelConfig(config, patch),
    })
  }

  const missingFields = useMemo(
    () => detectMissingLeftPanelFields(config, fields as TableField[]),
    [config, fields]
  )

  const initialFilterTree: FilterTree = leftPanel.filter_tree
    ? leftPanel.filter_tree
    : leftPanel.filter_by && leftPanel.filter_by.length > 0
      ? filterConfigsToFilterTree(leftPanel.filter_by, "AND")
      : null

  const [filterTree, setFilterTree] = useState<FilterTree>(initialFilterTree)
  const [sortField, setSortField] = useState(leftPanel.sort_by?.[0]?.field || leftPanel.list_sort_field || "")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    leftPanel.sort_by?.[0]?.direction || leftPanel.list_sort_direction || "asc"
  )
  const [groupBy, setGroupBy] = useState(leftPanel.group_by || leftPanel.list_group_by_field || "")
  const [groupByRules, setGroupByRules] = useState<GroupRule[] | undefined>(
    leftPanel.group_by_rules
  )

  useEffect(() => {
    const lp = config.left_panel || {}
    setFilterTree(
      lp.filter_tree
        ? lp.filter_tree
        : lp.filter_by && lp.filter_by.length > 0
          ? filterConfigsToFilterTree(lp.filter_by, "AND")
          : null
    )
    setSortField(lp.sort_by?.[0]?.field || lp.list_sort_field || "")
    setSortDirection(lp.sort_by?.[0]?.direction || lp.list_sort_direction || "asc")
    setGroupBy(lp.group_by || lp.list_group_by_field || "")
    setGroupByRules(lp.group_by_rules)
  }, [config.left_panel])

  const setFieldWithId = async (
    nameKey: string,
    idKey: string,
    legacyNameKey: string | undefined,
    fieldName: string
  ) => {
    const field = fields.find((f) => f.name === fieldName)
    const patch: Record<string, unknown> = {
      [nameKey]: fieldName === "__none__" ? undefined : fieldName,
      [idKey]: fieldName === "__none__" ? undefined : field?.id,
    }
    if (legacyNameKey) {
      patch[legacyNameKey] = patch[nameKey]
    }
    await updateLeftPanel(patch)
  }

  const badgeFields =
    (leftPanel.list_badge_fields as string[] | undefined) ||
    leftPanel.pill_fields ||
    []
  const searchFields =
    (leftPanel.list_search_fields as string[] | undefined) ||
    leftPanel.search_fields ||
    []
  const metadataFields = (leftPanel.list_metadata_fields as string[] | undefined) || []

  if (!selectedTableId) {
    return (
      <p className="text-sm text-gray-500">Select a source table on the Data tab first.</p>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Left panel</h3>
        <p className="text-xs text-gray-500 mt-1">
          Configure the record list: search, cards, grouping, sorting, and filters.
        </p>
      </div>

      {missingFields.length > 0 && (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          role="status"
        >
          <p className="font-medium">Some left panel fields no longer exist</p>
          <ul className="text-xs mt-1 list-disc pl-4 space-y-0.5">
            {missingFields.map((m) => (
              <li key={`${m.key}-${m.label}`}>{m.label}</li>
            ))}
          </ul>
          <p className="text-xs mt-2 text-amber-800">
            The page still works. Update or clear the missing fields below.
          </p>
        </div>
      )}

      <SettingsSection title="Search">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-normal">Show search</Label>
          <Switch
            checked={leftPanel.list_show_search !== false && leftPanel.show_search !== false}
            onCheckedChange={(checked) =>
              updateLeftPanel({ list_show_search: checked, show_search: checked })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Search placeholder</Label>
          <Input
            value={
              (leftPanel.list_search_placeholder as string) || leftPanel.search_placeholder || ""
            }
            onChange={(e) =>
              updateLeftPanel({
                list_search_placeholder: e.target.value || undefined,
                search_placeholder: e.target.value || undefined,
              })
            }
            placeholder="Search records..."
          />
        </div>
        <FieldPicker
          mode="checkbox"
          label="Search fields (optional)"
          description="Leave empty to search all visible text fields."
          fields={fields}
          selectedFields={searchFields}
          maxFields={8}
          onChange={(names) =>
            updateLeftPanel({
              list_search_fields: names,
              search_fields: names,
            })
          }
        />
      </SettingsSection>

      <SettingsSection title="Add button">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-normal">Show add record button</Label>
          <Switch
            checked={
              leftPanel.list_show_add_button !== false &&
              leftPanel.show_add_button !== false &&
              leftPanel.user_actions?.add_records !== false
            }
            onCheckedChange={(checked) =>
              updateLeftPanel({
                list_show_add_button: checked,
                show_add_button: checked,
                user_actions: { ...leftPanel.user_actions, add_records: checked },
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Button label</Label>
          <Input
            value={(leftPanel.list_add_button_label as string) || leftPanel.add_button_label || ""}
            onChange={(e) =>
              updateLeftPanel({
                list_add_button_label: e.target.value || undefined,
                add_button_label: e.target.value || undefined,
              })
            }
            placeholder="Add record"
          />
        </div>
        <p className="text-xs text-gray-500">
          Who can create records is set on the Permissions tab.
        </p>
      </SettingsSection>

      <SettingsSection title="Record item display">
        <div className="space-y-2">
          <Label>Title field</Label>
          <Select
            value={
              (leftPanel.list_title_field as string) ||
              leftPanel.title_field ||
              config.title_field ||
              "__none__"
            }
            onValueChange={(v) =>
              setFieldWithId("list_title_field", "list_title_field_id", "title_field", v)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select field" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {fields.map((f) => (
                <SelectItem key={f.id} value={f.name}>
                  {getFieldDisplayName(f)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Subtitle field</Label>
          <Select
            value={(leftPanel.list_subtitle_field as string) || leftPanel.field_1 || "__none__"}
            onValueChange={(v) =>
              setFieldWithId("list_subtitle_field", "list_subtitle_field_id", "field_1", v)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {fields.map((f) => (
                <SelectItem key={f.id} value={f.name}>
                  {getFieldDisplayName(f)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Secondary subtitle</Label>
          <Select
            value={
              (leftPanel.list_secondary_subtitle_field as string) || leftPanel.field_2 || "__none__"
            }
            onValueChange={(v) =>
              setFieldWithId(
                "list_secondary_subtitle_field",
                "list_secondary_subtitle_field_id",
                "field_2",
                v
              )
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {fields.map((f) => (
                <SelectItem key={f.id} value={f.name}>
                  {getFieldDisplayName(f)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Image / avatar field</Label>
          <Select
            value={(leftPanel.list_image_field as string) || leftPanel.image_field || "__none__"}
            onValueChange={(v) =>
              setFieldWithId("list_image_field", "list_image_field_id", "image_field", v)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {fields
                .filter((f) => f.type === "attachment" || f.type === "url")
                .map((f) => (
                  <SelectItem key={f.id} value={f.name}>
                    {getFieldDisplayName(f)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <FieldPicker
          mode="checkbox"
          label="Badge fields"
          description="Up to 3 select fields shown as pills on each list item."
          fields={fields.filter(
            (f) => f.type === "single_select" || f.type === "multi_select"
          )}
          selectedFields={badgeFields}
          maxFields={3}
          onChange={(names) =>
            updateLeftPanel({
              list_badge_fields: names,
              pill_fields: names,
            })
          }
        />
        <FieldPicker
          mode="checkbox"
          label="Metadata fields"
          description="Extra lines on list items (best in Detailed density)."
          fields={fields}
          selectedFields={metadataFields}
          maxFields={4}
          onChange={(names) => updateLeftPanel({ list_metadata_fields: names })}
        />
        <div className="space-y-2">
          <Label>Color accent field</Label>
          <Select
            value={leftPanel.color_field || "__none__"}
            onValueChange={(v) =>
              updateLeftPanel({ color_field: v === "__none__" ? undefined : v })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {fields
                .filter((f) => f.type === "single_select" || f.type === "multi_select")
                .map((f) => (
                  <SelectItem key={f.id} value={f.name}>
                    {getFieldDisplayName(f)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </SettingsSection>

      <SettingsSection title="Visual style">
        <div className="space-y-2">
          <Label>Density</Label>
          <Select
            value={leftPanel.list_density || leftPanel.density || "comfortable"}
            onValueChange={(v: "compact" | "comfortable" | "detailed") =>
              updateLeftPanel({ list_density: v, density: v })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="compact">Compact</SelectItem>
              <SelectItem value="comfortable">Comfortable</SelectItem>
              <SelectItem value="detailed">Detailed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm font-normal">Show badges</Label>
          <Switch
            checked={leftPanel.list_show_badges !== false && leftPanel.show_badges !== false}
            onCheckedChange={(checked) =>
              updateLeftPanel({ list_show_badges: checked, show_badges: checked })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm font-normal">Show metadata lines</Label>
          <Switch
            checked={leftPanel.list_show_metadata !== false && leftPanel.show_metadata !== false}
            onCheckedChange={(checked) =>
              updateLeftPanel({ list_show_metadata: checked, show_metadata: checked })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm font-normal">Show avatar / image</Label>
          <Switch
            checked={leftPanel.list_show_avatar !== false && leftPanel.show_avatar !== false}
            onCheckedChange={(checked) =>
              updateLeftPanel({ list_show_avatar: checked, show_avatar: checked })
            }
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Grouping">
        <NestedGroupBySelector
          value={groupBy || undefined}
          groupByRules={groupByRules}
          onChange={(value) => {
            const fieldName = value === "__none__" || !value ? "" : value
            setGroupBy(fieldName)
            updateLeftPanel({
              group_by: fieldName || undefined,
              list_group_by_field: fieldName || undefined,
              ...(fieldName ? {} : { group_by_rules: undefined }),
            })
          }}
          onRulesChange={(rules) => {
            const normalized = rules ?? undefined
            setGroupByRules(normalized)
            updateLeftPanel({
              group_by_rules: normalized,
              group_by:
                normalized && normalized.length > 0 && normalized[0].type === "field"
                  ? normalized[0].field
                  : undefined,
            })
          }}
          fields={fields}
          filterGroupableFields
          description="Group records in the left list. Leave empty for a flat list."
        />
        <div className="flex items-center justify-between">
          <Label className="text-sm font-normal">Show group counts</Label>
          <Switch
            checked={
              leftPanel.list_show_group_counts !== false && leftPanel.show_group_counts !== false
            }
            onCheckedChange={(checked) =>
              updateLeftPanel({ list_show_group_counts: checked, show_group_counts: checked })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm font-normal">Groups collapsed by default</Label>
          <Switch
            checked={
              leftPanel.list_groups_default_collapsed === true ||
              leftPanel.groups_default_collapsed === true
            }
            onCheckedChange={(checked) =>
              updateLeftPanel({
                list_groups_default_collapsed: checked,
                groups_default_collapsed: checked,
              })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm font-normal">Hide empty groups</Label>
          <Switch
            checked={
              leftPanel.list_hide_empty_groups === true || leftPanel.hide_empty_groups === true
            }
            onCheckedChange={(checked) =>
              updateLeftPanel({ list_hide_empty_groups: checked, hide_empty_groups: checked })
            }
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Sorting">
        <div className="flex gap-2">
          <Select
            value={sortField || "__none__"}
            onValueChange={(v) => {
              const name = v === "__none__" ? "" : v
              const field = fields.find((f) => f.name === name)
              setSortField(name)
              const sortBy = name ? [{ field: name, direction: sortDirection }] : []
              updateLeftPanel({
                sort_by: sortBy,
                list_sort_field: name || undefined,
                list_sort_field_id: field?.id,
              })
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sort field" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {fields.map((f) => (
                <SelectItem key={f.id} value={f.name}>
                  {getFieldDisplayName(f)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {sortField && (
            <Select
              value={sortDirection}
              onValueChange={(v: "asc" | "desc") => {
                setSortDirection(v)
                updateLeftPanel({
                  sort_by: [{ field: sortField, direction: v }],
                  list_sort_direction: v,
                })
              }}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">A → Z</SelectItem>
                <SelectItem value="desc">Z → A</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="Filters">
        {fields.length > 0 ? (
          <FilterBuilder
            filterTree={filterTree}
            tableFields={fields}
            onChange={(tree) => {
              setFilterTree(tree)
              const flat: Array<{ field: string; operator: string; value: unknown }> = []
              function extract(treeNode: FilterTree) {
                if (!treeNode) return
                if ("field_id" in treeNode) {
                  flat.push({
                    field: treeNode.field_id,
                    operator: treeNode.operator,
                    value: treeNode.value ?? null,
                  })
                } else if ("operator" in treeNode && "children" in treeNode) {
                  treeNode.children.forEach(extract)
                }
              }
              extract(tree)
              updateLeftPanel({
                filter_tree: tree,
                filter_by: tree ? flat : [],
              })
            }}
          />
        ) : (
          <p className="text-xs text-gray-500">Loading fields…</p>
        )}
        <p className="text-xs text-gray-500">
          Filters apply only to this page&apos;s left record list.
        </p>
      </SettingsSection>

      <SettingsSection title="Empty states">
        <div className="space-y-2">
          <Label>Empty list title</Label>
          <Input
            value={(leftPanel.list_empty_title as string) || leftPanel.empty_title || ""}
            onChange={(e) =>
              updateLeftPanel({
                list_empty_title: e.target.value || undefined,
                empty_title: e.target.value || undefined,
              })
            }
            placeholder="No records found"
          />
        </div>
        <div className="space-y-2">
          <Label>Empty list description</Label>
          <Input
            value={
              (leftPanel.list_empty_description as string) || leftPanel.empty_description || ""
            }
            onChange={(e) =>
              updateLeftPanel({
                list_empty_description: e.target.value || undefined,
                empty_description: e.target.value || undefined,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>No search results title</Label>
          <Input
            value={
              (leftPanel.list_no_results_title as string) ||
              leftPanel.empty_search_message ||
              ""
            }
            onChange={(e) =>
              updateLeftPanel({
                list_no_results_title: e.target.value || undefined,
                empty_search_message: e.target.value || undefined,
              })
            }
            placeholder="No records match your search"
          />
        </div>
        <div className="space-y-2">
          <Label>No search results description</Label>
          <Input
            value={(leftPanel.list_no_results_description as string) || ""}
            onChange={(e) =>
              updateLeftPanel({ list_no_results_description: e.target.value || undefined })
            }
          />
        </div>
      </SettingsSection>
    </div>
  )
}
