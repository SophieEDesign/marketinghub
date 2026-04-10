"use client"

import { useEffect, useState } from "react"
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
import { getTableSections } from "@/lib/core-data/section-settings"
import type { SectionSettings } from "@/lib/core-data/types"

interface FieldSectionDataSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig>) => void
  pageTableId?: string | null
}

/**
 * Data settings for field_section blocks (record layouts): pick a section by name, optional title and defaults.
 */
export default function FieldSectionDataSettings({
  config,
  onUpdate,
  pageTableId = null,
}: FieldSectionDataSettingsProps) {
  const [sections, setSections] = useState<SectionSettings[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!pageTableId) {
      setSections([])
      return
    }
    let cancelled = false
    setLoading(true)
    getTableSections(pageTableId)
      .then((rows) => {
        if (!cancelled) setSections(rows)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [pageTableId])

  const groupName = (config.group_name as string | undefined) ?? ""
  const title = config.title ?? ""
  const collapsed = config.collapsed === true
  const showLabels = config.show_labels !== false

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-gray-900">Section</h3>
        <p className="text-xs text-gray-500">
          Choose which field section this block displays for the current record.
        </p>
      </div>

      {!pageTableId ? (
        <p className="text-xs text-amber-700">
          Page table is not set; section list loads when a base table is available.
        </p>
      ) : loading ? (
        <p className="text-xs text-gray-500">Loading sections…</p>
      ) : sections.length === 0 ? (
        <div className="space-y-2">
          <Label htmlFor="field-section-name">Section name</Label>
          <Input
            id="field-section-name"
            value={groupName}
            placeholder="e.g. General"
            onChange={(e) => onUpdate({ group_name: e.target.value })}
          />
          <p className="text-xs text-gray-500">
            No sections found for this table. Enter the section name (group) used on fields.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Section</Label>
          <Select
            value={groupName || "__none__"}
            onValueChange={(v) => onUpdate({ group_name: v === "__none__" ? "" : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {groupName && !sections.some((s) => s.name === groupName) ? (
                <SelectItem value={groupName}>{groupName}</SelectItem>
              ) : null}
              {sections.map((s) => (
                <SelectItem key={s.id || s.name} value={s.name}>
                  {s.display_name || s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="field-section-title">Block title (optional)</Label>
        <Input
          id="field-section-title"
          value={title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Shown above the section"
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label htmlFor="field-section-collapsed">Start collapsed</Label>
          <p className="text-xs text-gray-500">When opened, readers can still expand the section.</p>
        </div>
        <Switch
          id="field-section-collapsed"
          checked={collapsed}
          onCheckedChange={(checked) => onUpdate({ collapsed: checked })}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label htmlFor="field-section-labels">Show field labels</Label>
        </div>
        <Switch
          id="field-section-labels"
          checked={showLabels}
          onCheckedChange={(checked) => onUpdate({ show_labels: checked })}
        />
      </div>
    </div>
  )
}
