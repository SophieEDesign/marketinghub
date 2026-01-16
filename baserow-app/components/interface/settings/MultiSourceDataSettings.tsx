"use client"

import { useEffect, useMemo, useState } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"
import type { BlockConfig } from "@/lib/interface/types"
import type { Table, View, TableField } from "@/types/database"
import { createClient } from "@/lib/supabase/client"

type MultiSource = {
  id: string
  enabled?: boolean
  label?: string
  table_id: string
  view_id?: string
  title_field: string
  start_date_field: string
  end_date_field?: string
  color_field?: string
  type_field?: string
}

interface MultiSourceDataSettingsProps {
  config: BlockConfig
  tables: Table[]
  views: View[]
  fields: TableField[]
  onUpdate: (updates: Partial<BlockConfig>) => void
}

function newSourceId() {
  return `src_${Math.random().toString(36).slice(2, 10)}`
}

export default function MultiSourceDataSettings({
  config,
  tables,
  onUpdate,
}: MultiSourceDataSettingsProps) {
  const sources = useMemo<MultiSource[]>(() => {
    return Array.isArray((config as any).sources) ? ((config as any).sources as MultiSource[]) : []
  }, [config])

  const [sourceFields, setSourceFields] = useState<Record<string, TableField[]>>({})
  const [sourceViews, setSourceViews] = useState<Record<string, View[]>>({})

  useEffect(() => {
    let cancelled = false

    async function loadPerSourceMeta() {
      const supabase = createClient()
      const nextFields: Record<string, TableField[]> = {}
      const nextViews: Record<string, View[]> = {}

      // Serialize requests to avoid connection exhaustion.
      for (const s of sources) {
        if (!s?.table_id) continue
        const { data: fieldsData } = await supabase
          .from("table_fields")
          .select("*")
          .eq("table_id", s.table_id)
          .order("position", { ascending: true })
        nextFields[s.id] = (fieldsData || []) as TableField[]

        const { data: viewsData } = await supabase
          .from("views")
          .select("*")
          .eq("table_id", s.table_id)
        nextViews[s.id] = (viewsData || []) as View[]
      }

      if (!cancelled) {
        setSourceFields(nextFields)
        setSourceViews(nextViews)
      }
    }

    loadPerSourceMeta()
    return () => {
      cancelled = true
    }
  }, [sources])

  const updateSources = (next: MultiSource[]) => {
    onUpdate({ sources: next } as any)
  }

  const addSource = () => {
    updateSources([
      ...sources,
      {
        id: newSourceId(),
        enabled: true,
        label: "",
        table_id: "",
        view_id: undefined,
        title_field: "",
        start_date_field: "",
        end_date_field: undefined,
        color_field: undefined,
        type_field: undefined,
      },
    ])
  }

  const removeSource = (id: string) => {
    updateSources(sources.filter((s) => s.id !== id))
  }

  const updateSource = (id: string, patch: Partial<MultiSource>) => {
    updateSources(
      sources.map((s) => {
        if (s.id !== id) return s
        return { ...s, ...patch }
      })
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-sm font-semibold">Sources</Label>
        <p className="text-xs text-gray-500">
          Add multiple tables and map each one into a shared calendar/timeline model.
        </p>
      </div>

      <div className="space-y-3">
        {sources.map((s, idx) => {
          const fieldsForSource = sourceFields[s.id] || []
          const viewsForSource = sourceViews[s.id] || []

          const dateFields = fieldsForSource.filter((f) => f.type === "date")
          const anyFields = fieldsForSource.filter((f) => f.name !== "id")
          const selectFields = fieldsForSource.filter(
            (f) => f.type === "single_select" || f.type === "multi_select"
          )

          return (
            <div key={s.id} className="rounded-md border border-gray-200 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={s.enabled !== false}
                    onCheckedChange={(checked) => updateSource(s.id, { enabled: Boolean(checked) })}
                    aria-label={`Enable source ${idx + 1}`}
                  />
                  <div className="text-sm font-medium text-gray-900">
                    Source {idx + 1}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSource(s.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-700">Label</Label>
                  <Input
                    value={s.label || ""}
                    onChange={(e) => updateSource(s.id, { label: e.target.value })}
                    placeholder={tables.find((t) => t.id === s.table_id)?.name || "e.g. Content"}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-700">Table *</Label>
                  <Select
                    value={s.table_id || "__none__"}
                    onValueChange={(value) => {
                      const table_id = value === "__none__" ? "" : value
                      // Reset field mappings when table changes (avoid ambiguous state).
                      updateSource(s.id, {
                        table_id,
                        view_id: undefined,
                        title_field: "",
                        start_date_field: "",
                        end_date_field: undefined,
                        color_field: undefined,
                        type_field: undefined,
                      })
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select a table" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select a table…</SelectItem>
                      {tables.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-700">Default view (filters/sorts)</Label>
                  <Select
                    value={s.view_id || "__none__"}
                    onValueChange={(value) =>
                      updateSource(s.id, { view_id: value === "__none__" ? undefined : value })
                    }
                    disabled={!s.table_id}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {viewsForSource.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-700">Title field *</Label>
                  <Select
                    value={s.title_field || "__none__"}
                    onValueChange={(value) => updateSource(s.id, { title_field: value === "__none__" ? "" : value })}
                    disabled={!s.table_id || anyFields.length === 0}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select…</SelectItem>
                      {anyFields.map((f) => (
                        <SelectItem key={f.id} value={f.name}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-700">Start date field *</Label>
                  <Select
                    value={s.start_date_field || "__none__"}
                    onValueChange={(value) =>
                      updateSource(s.id, { start_date_field: value === "__none__" ? "" : value })
                    }
                    disabled={!s.table_id || dateFields.length === 0}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select date field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select…</SelectItem>
                      {dateFields.map((f) => (
                        <SelectItem key={f.id} value={f.name}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-700">End date field (optional)</Label>
                  <Select
                    value={s.end_date_field || "__none__"}
                    onValueChange={(value) =>
                      updateSource(s.id, { end_date_field: value === "__none__" ? undefined : value })
                    }
                    disabled={!s.table_id || dateFields.length === 0}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {dateFields.map((f) => (
                        <SelectItem key={f.id} value={f.name}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-700">Colour rule (optional)</Label>
                  <Select
                    value={s.color_field || "__none__"}
                    onValueChange={(value) =>
                      updateSource(s.id, { color_field: value === "__none__" ? undefined : value })
                    }
                    disabled={!s.table_id || selectFields.length === 0}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {selectFields.map((f) => (
                        <SelectItem key={f.id} value={f.name}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-700">Type/label field (optional)</Label>
                  <Select
                    value={s.type_field || "__none__"}
                    onValueChange={(value) =>
                      updateSource(s.id, { type_field: value === "__none__" ? undefined : value })
                    }
                    disabled={!s.table_id || anyFields.length === 0}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {anyFields.map((f) => (
                        <SelectItem key={f.id} value={f.name}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div />
              </div>
            </div>
          )
        })}

        <Button type="button" variant="outline" onClick={addSource}>
          <Plus className="h-4 w-4 mr-2" />
          Add source
        </Button>
      </div>
    </div>
  )
}

