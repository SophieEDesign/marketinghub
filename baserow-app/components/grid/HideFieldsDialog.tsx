"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import { FIELD_TYPES } from "@/types/fields"

interface HideFieldsDialogProps {
  isOpen: boolean
  onClose: () => void
  viewId: string
  tableFields: TableField[]
  viewFields: Array<{
    field_name: string
    visible: boolean
    position: number
  }>
  hiddenFields: string[]
  onHiddenFieldsChange?: (fields: string[]) => void
}

export default function HideFieldsDialog({
  isOpen,
  onClose,
  viewId,
  tableFields,
  viewFields,
  hiddenFields,
  onHiddenFieldsChange,
}: HideFieldsDialogProps) {
  const [localHiddenFields, setLocalHiddenFields] = useState<string[]>(hiddenFields)
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<"position" | "name_asc" | "name_desc" | "type_asc">("position")
  const [pasteText, setPasteText] = useState("")
  const [pasteSummary, setPasteSummary] = useState<{ changed: number; missing: number } | null>(null)

  useEffect(() => {
    setLocalHiddenFields(hiddenFields)
  }, [hiddenFields, isOpen])

  const normalizeToken = (value: string) =>
    (value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase()

  const parsePasteList = (value: string) => {
    const raw = (value || "")
      .split(/[\n\r\t,;]+/g)
      .map((s) => s.trim())
      .filter(Boolean)
    const seen = new Set<string>()
    const tokens: string[] = []
    for (const t of raw) {
      const n = normalizeToken(t)
      if (!n || seen.has(n)) continue
      seen.add(n)
      tokens.push(t)
    }
    return tokens
  }

  function toggleField(fieldName: string) {
    if (localHiddenFields.includes(fieldName)) {
      setLocalHiddenFields(localHiddenFields.filter(f => f !== fieldName))
    } else {
      setLocalHiddenFields([...localHiddenFields, fieldName])
    }
  }

  const nonSystemFields = useMemo(() => {
    return tableFields.filter((field) => field.name !== "id")
  }, [tableFields])

  const nonSystemFieldNames = useMemo(() => {
    return new Set(nonSystemFields.map((field) => field.name))
  }, [nonSystemFields])

  const filteredViewFields = useMemo(() => {
    return viewFields.filter((vf) => nonSystemFieldNames.has(vf.field_name))
  }, [viewFields, nonSystemFieldNames])

  const hideAll = () => setLocalHiddenFields(filteredViewFields.map((vf) => vf.field_name))
  const showAll = () => setLocalHiddenFields([])
  const invert = () => {
    const hidden = new Set(localHiddenFields)
    setLocalHiddenFields(
      filteredViewFields.filter((vf) => !hidden.has(vf.field_name)).map((vf) => vf.field_name)
    )
  }

  const displayViewFields = (() => {
    const s = search.trim().toLowerCase()
    const base = s
      ? filteredViewFields.filter((vf) => vf.field_name.toLowerCase().includes(s))
      : filteredViewFields
    if (sort === "position") return base

    const sorted = [...base]
    sorted.sort((a, b) => {
      if (sort === "name_asc") return a.field_name.localeCompare(b.field_name)
      if (sort === "name_desc") return b.field_name.localeCompare(a.field_name)
      if (sort === "type_asc") {
        const at = nonSystemFields.find((f) => f.name === a.field_name)?.type || ""
        const bt = nonSystemFields.find((f) => f.name === b.field_name)?.type || ""
        return at.localeCompare(bt) || a.field_name.localeCompare(b.field_name)
      }
      return 0
    })
    return sorted
  })()

  const applyPaste = (mode: "hide" | "show") => {
    const tokens = parsePasteList(pasteText)
    if (tokens.length === 0) {
      setPasteSummary({ changed: 0, missing: 0 })
      return
    }

    const fieldNameByNorm = new Map<string, string>()
    for (const vf of filteredViewFields) fieldNameByNorm.set(normalizeToken(vf.field_name), vf.field_name)

    const matched: string[] = []
    let missing = 0
    for (const t of tokens) {
      const match = fieldNameByNorm.get(normalizeToken(t))
      if (match) matched.push(match)
      else missing += 1
    }

    const current = new Set(localHiddenFields)
    let changed = 0
    if (mode === "hide") {
      for (const m of matched) {
        if (!current.has(m)) {
          current.add(m)
          changed += 1
        }
      }
    } else {
      for (const m of matched) {
        if (current.has(m)) {
          current.delete(m)
          changed += 1
        }
      }
    }

    setLocalHiddenFields(Array.from(current))
    setPasteSummary({ changed, missing })
  }

  async function handleSave() {
    try {
      // Update view_fields visibility
      const updates = filteredViewFields.map((vf) => ({
        field_name: vf.field_name,
        visible: !localHiddenFields.includes(vf.field_name),
      }))

      await Promise.all(
        updates.map((update) =>
          supabase
            .from("view_fields")
            .update({ visible: update.visible })
            .eq("view_id", viewId)
            .eq("field_name", update.field_name)
        )
      )

      onHiddenFieldsChange?.(localHiddenFields)
      onClose()
    } catch (error) {
      console.error("Error saving hidden fields:", error)
      alert("Failed to save field visibility")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Hide Fields</DialogTitle>
          <DialogDescription>
            Select fields to hide from this view. Hidden fields will not be displayed but data is preserved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-600">Bulk</Label>
            <div className="flex gap-2">
              <button type="button" onClick={hideAll} className="text-xs text-blue-600 hover:text-blue-700 underline">
                Hide All
              </button>
              <span className="text-xs text-gray-300">|</span>
              <button type="button" onClick={showAll} className="text-xs text-blue-600 hover:text-blue-700 underline">
                Show All
              </button>
              <span className="text-xs text-gray-300">|</span>
              <button type="button" onClick={invert} className="text-xs text-blue-600 hover:text-blue-700 underline">
                Invert
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Search</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search fields..."
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Sort</Label>
              <Select value={sort} onValueChange={(v) => setSort(v as any)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="position">Default</SelectItem>
                  <SelectItem value="name_asc">Name (A → Z)</SelectItem>
                  <SelectItem value="name_desc">Name (Z → A)</SelectItem>
                  <SelectItem value="type_asc">Type (A → Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-gray-600">Paste list (field names)</Label>
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"Paste field names (one per line, or comma-separated)"}
              className="text-xs min-h-[70px]"
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPaste("hide")}>
                Hide
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPaste("show")}>
                Show
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs ml-auto"
                onClick={() => {
                  setPasteText("")
                  setPasteSummary(null)
                }}
              >
                Clear
              </Button>
            </div>
            {pasteSummary && (
              <div className="text-xs text-gray-500">
                Changed: {pasteSummary.changed} · Not found: {pasteSummary.missing}
              </div>
            )}
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
          {displayViewFields.map((vf) => {
            const field = tableFields.find((f) => f.name === vf.field_name)
            const isHidden = localHiddenFields.includes(vf.field_name)

            return (
              <div key={vf.field_name} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
                <input
                  type="checkbox"
                  id={`hide-${vf.field_name}`}
                  checked={isHidden}
                  onChange={() => toggleField(vf.field_name)}
                  className="w-4 h-4"
                />
                <Label
                  htmlFor={`hide-${vf.field_name}`}
                  className="flex-1 text-sm font-medium text-gray-700 cursor-pointer"
                >
                  {vf.field_name}
                </Label>
                {field && (
                  <span className="text-xs text-gray-500">
                    {FIELD_TYPES.find(t => t.type === field.type)?.label}
                  </span>
                )}
              </div>
            )
          })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
