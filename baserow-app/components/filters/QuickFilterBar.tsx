"use client"

/**
 * QuickFilterBar (Airtable-style)
 *
 * Session-only, lightweight filter pills that sit inline at the top of a view.
 * These are intentionally simple (implicit AND, no groups).
 *
 * Builder-owned defaults remain separate and are never mutated.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { Plus, RotateCcw, X } from "lucide-react"
import type { TableField } from "@/types/fields"
import type { FilterConfig } from "@/lib/interface/filters"
import { serializeFiltersForComparison } from "@/lib/interface/filters"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type QuickableFieldType = "single_select" | "multi_select"

type QuickFilterOperator = "equal" | "not_equal"

type QuickFilterItem = {
  field: string
  operator: QuickFilterOperator
  value?: string
}

function getQuickableFields(tableFields: TableField[]): TableField[] {
  return (tableFields || []).filter(
    (f) => f && (f.type === "single_select" || f.type === "multi_select")
  )
}

function getChoiceOptions(field: TableField): Array<{ value: string; label: string }> {
  const choices = (field.options as any)?.choices ?? (field as any)?.options ?? []
  if (!Array.isArray(choices)) return []
  return choices
    .map((c: any) => {
      if (typeof c === "string") return { value: c, label: c }
      if (c && typeof c === "object") {
        const v = String(c.value ?? c.label ?? "")
        const l = String(c.label ?? c.value ?? v)
        return v ? { value: v, label: l } : null
      }
      return null
    })
    .filter(Boolean) as Array<{ value: string; label: string }>
}

function operatorLabel(fieldType: QuickableFieldType, op: QuickFilterOperator): string {
  if (fieldType === "multi_select") {
    return op === "equal" ? "includes" : "does not include"
  }
  return op === "equal" ? "is" : "is not"
}

function isQuickOperator(op: any): op is QuickFilterOperator {
  return op === "equal" || op === "not_equal"
}

function deriveBaselineQuickFilters(
  viewDefaultFilters: FilterConfig[],
  quickableFields: TableField[]
): QuickFilterItem[] {
  const quickFieldSet = new Set(quickableFields.map((f) => f.name))
  const byField = new Map<string, QuickFilterItem>()

  for (const f of viewDefaultFilters || []) {
    if (!f || typeof f.field !== "string") continue
    if (!quickFieldSet.has(f.field)) continue
    if (!isQuickOperator(f.operator)) continue
    if (byField.has(f.field)) continue
    byField.set(f.field, {
      field: f.field,
      operator: f.operator,
      value: typeof f.value === "string" ? f.value : f.value != null ? String(f.value) : undefined,
    })
  }

  return Array.from(byField.values())
}

function toFilterConfigs(items: QuickFilterItem[]): FilterConfig[] {
  return items
    .filter((i) => i.field && i.operator)
    .filter((i) => i.value !== undefined && i.value !== null && String(i.value).trim() !== "")
    .map((i) => ({
      field: i.field,
      operator: i.operator,
      value: i.value,
    }))
}

export interface QuickFilterBarProps {
  /** Used for session-only persistence. If omitted, quick filters will be per-render only. */
  storageKey?: string
  tableFields: TableField[]
  /** Builder-owned filters (already normalized to FilterConfig) */
  viewDefaultFilters: FilterConfig[]
  /** Emit active user quick filters (as FilterConfig[]) */
  onChange: (userQuickFilters: FilterConfig[]) => void
}

export default function QuickFilterBar({
  storageKey,
  tableFields,
  viewDefaultFilters,
  onChange,
}: QuickFilterBarProps) {
  const quickableFields = useMemo(() => getQuickableFields(tableFields), [tableFields])

  const baseline = useMemo(() => {
    return deriveBaselineQuickFilters(viewDefaultFilters, quickableFields)
  }, [viewDefaultFilters, quickableFields])

  const baselineKey = useMemo(() => {
    return serializeFiltersForComparison(toFilterConfigs(baseline))
  }, [baseline])

  const [items, setItems] = useState<QuickFilterItem[]>(baseline)
  const hasInitializedRef = useRef(false)

  // Initialize / re-sync when defaults change.
  useEffect(() => {
    // First render: attempt to load session state if it matches the current baselineKey.
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      if (storageKey && typeof window !== "undefined") {
        try {
          const raw = window.sessionStorage.getItem(storageKey)
          if (raw) {
            const parsed = JSON.parse(raw) as { baselineKey?: string; items?: QuickFilterItem[] }
            if (parsed?.baselineKey === baselineKey && Array.isArray(parsed.items)) {
              setItems(parsed.items)
              return
            }
          }
        } catch {
          // ignore invalid session payloads
        }
      }
      setItems(baseline)
      return
    }

    // Defaults changed mid-session (e.g. builder updated the view): reset to new baseline.
    setItems(baseline)
  }, [baselineKey, baseline, storageKey])

  // Persist + emit active filters.
  useEffect(() => {
    const active = toFilterConfigs(items)
    onChange(active)

    if (storageKey && typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify({ baselineKey, items }))
      } catch {
        // ignore quota / private-mode errors
      }
    }
  }, [items, onChange, storageKey, baselineKey])

  const currentKey = useMemo(() => serializeFiltersForComparison(toFilterConfigs(items)), [items])
  const isModified = currentKey !== baselineKey

  const fieldsByName = useMemo(() => {
    const m = new Map<string, TableField>()
    for (const f of quickableFields) {
      m.set(f.name, f)
    }
    return m
  }, [quickableFields])

  const baselineByField = useMemo(() => {
    const m = new Map<string, QuickFilterItem>()
    for (const b of baseline) m.set(b.field, b)
    return m
  }, [baseline])

  const addableFields = useMemo(() => {
    const active = new Set(items.map((i) => i.field))
    return quickableFields.filter((f) => !active.has(f.name))
  }, [items, quickableFields])

  const resetAll = () => setItems(baseline)

  const clearOne = (fieldName: string) => {
    const baselineItem = baselineByField.get(fieldName)
    if (baselineItem) {
      // "Clear" = revert to defaults for baseline fields.
      setItems((prev) => prev.map((i) => (i.field === fieldName ? baselineItem : i)))
      return
    }
    // For user-added filters, remove entirely.
    setItems((prev) => prev.filter((i) => i.field !== fieldName))
  }

  const updateOne = (fieldName: string, updates: Partial<QuickFilterItem>) => {
    setItems((prev) =>
      prev.map((i) => (i.field === fieldName ? { ...i, ...updates } : i))
    )
  }

  if (quickableFields.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2 flex-wrap py-2">
      {items.map((item) => {
        const field = fieldsByName.get(item.field)
        if (!field) return null
        const choices = getChoiceOptions(field)
        const type = field.type as QuickableFieldType
        const valueLabel =
          item.value && choices.length > 0
            ? choices.find((c) => c.value === item.value)?.label || item.value
            : item.value || "Any"

        return (
          <Popover key={item.field}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                aria-label={`Filter by ${field.name}`}
              >
                <span className="font-medium">{field.name}</span>
                <span className="text-gray-500">
                  {operatorLabel(type, item.operator)}{" "}
                  <span className="text-gray-700">{valueLabel}</span>
                </span>
                <span
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    clearOne(item.field)
                  }}
                  className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-gray-100"
                  title="Clear"
                  role="button"
                >
                  <X className="h-3 w-3 text-gray-400" />
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-3">
              <div className="space-y-3">
                <div className="text-xs font-medium text-gray-700">{field.name}</div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="text-[11px] text-gray-500">Condition</div>
                    <Select
                      value={item.operator}
                      onValueChange={(v) => {
                        if (isQuickOperator(v)) updateOne(item.field, { operator: v })
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equal">{operatorLabel(type, "equal")}</SelectItem>
                        <SelectItem value="not_equal">{operatorLabel(type, "not_equal")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] text-gray-500">Value</div>
                    <Select
                      value={item.value ?? "__any__"}
                      onValueChange={(v) => {
                        if (v === "__any__") {
                          clearOne(item.field)
                          return
                        }
                        updateOne(item.field, { value: v })
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any__">Any</SelectItem>
                        {choices.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-gray-600"
                    onClick={() => clearOne(item.field)}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )
      })}

      {/* Add filter */}
      {addableFields.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-dashed bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
              aria-label="Add filter"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2">
            <div className="text-xs font-medium text-gray-700 px-2 py-1">
              Add filter
            </div>
            <div className="max-h-56 overflow-auto">
              {addableFields.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-50"
                  onClick={() => {
                    setItems((prev) => [
                      ...prev,
                      { field: f.name, operator: "equal", value: undefined },
                    ])
                  }}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Modified indicator + reset */}
      {isModified && (
        <div className="flex items-center gap-2 ml-2">
          <Badge variant="secondary" className="text-xs">
            Filters modified
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-gray-600"
            onClick={resetAll}
            title="Reset to default view"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset to default view
          </Button>
        </div>
      )}
    </div>
  )
}

