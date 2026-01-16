"use client"

/**
 * Field Picker Modal Component
 * 
 * Three-column layout for selecting which fields appear in the Record View:
 * - Left: Field selector with toggles (Connected to: Record list)
 * - Center: Record list preview
 * - Right: Record detail preview showing selected fields
 * 
 * Used in:
 * - Page creation wizard (for record_view pages)
 * - Page Settings (RecordViewPageSettings)
 */

import { useState, useEffect, useMemo, useCallback } from "react"
import { X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search } from "lucide-react"
import { getFieldIcon } from "@/lib/icons"
import { createClient } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import { getFieldDisplayName } from "@/lib/fields/display"
import { cn } from "@/lib/utils"

interface FieldPickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tableId: string | null
  selectedFields: string[] // Field names
  onFieldsChange: (fieldNames: string[]) => void
}

export default function FieldPickerModal({
  open,
  onOpenChange,
  tableId,
  selectedFields,
  onFieldsChange,
}: FieldPickerModalProps) {
  const [fields, setFields] = useState<TableField[]>([])
  const [tableName, setTableName] = useState<string>("")
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null)
  const [fieldSearch, setFieldSearch] = useState("")
  const [fieldSort, setFieldSort] = useState<"position" | "name_asc" | "name_desc" | "type_asc">(
    "position"
  )
  const [localSelectedFields, setLocalSelectedFields] = useState<string[]>(selectedFields)
  const [pasteText, setPasteText] = useState("")
  const [pasteSummary, setPasteSummary] = useState<{ added: number; missing: number } | null>(null)

  // Load fields and table name
  useEffect(() => {
    if (open && tableId) {
      loadFields()
      loadTableName()
      loadRecords()
    } else if (!open) {
      // Reset local state when modal closes
      setLocalSelectedFields(selectedFields)
      setFieldSearch("")
      setSelectedRecord(null)
      setPasteText("")
      setPasteSummary(null)
    }
  }, [open, tableId, selectedFields])

  async function loadFields() {
    if (!tableId) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", tableId)
        .order("position", { ascending: true })

      if (error) throw error
      setFields((data || []) as TableField[])
    } catch (error) {
      console.error("Error loading fields:", error)
    } finally {
      setLoading(false)
    }
  }

  async function loadTableName() {
    if (!tableId) return

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("tables")
        .select("name, supabase_table")
        .eq("id", tableId)
        .single()

      if (error) throw error
      if (data) {
        setTableName(data.name || "")
      }
    } catch (error) {
      console.error("Error loading table name:", error)
    }
  }

  async function loadRecords() {
    if (!tableId) return

    try {
      const supabase = createClient()
      const { data: table } = await supabase
        .from("tables")
        .select("supabase_table")
        .eq("id", tableId)
        .single()

      if (!table?.supabase_table) return

      const { data, error } = await supabase
        .from(table.supabase_table)
        .select("*")
        .limit(10)
        .order("created_at", { ascending: false })

      if (error) throw error
      setRecords(data || [])
      if (data && data.length > 0) {
        setSelectedRecord(data[0])
      }
    } catch (error) {
      console.error("Error loading records:", error)
    }
  }

  const normalizeToken = useCallback((value: string) => {
    return (value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase()
  }, [])

  const parsePasteList = useCallback((value: string) => {
    // Supports newline / comma / tab / semicolon separated lists (Airtable-style paste)
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
  }, [normalizeToken])

  // Filter + sort fields for list
  const filteredFields = useMemo(() => {
    const searchLower = fieldSearch.trim().toLowerCase()

    const base = searchLower
      ? fields.filter((f) => f.name.toLowerCase().includes(searchLower))
      : fields

    const sorted = [...base]
    sorted.sort((a, b) => {
      if (fieldSort === "position") {
        // keep DB position order (already ordered), but preserve stable behavior if we filtered
        return (a.position ?? 0) - (b.position ?? 0)
      }
      if (fieldSort === "name_asc") return a.name.localeCompare(b.name)
      if (fieldSort === "name_desc") return b.name.localeCompare(a.name)
      if (fieldSort === "type_asc") return (a.type || "").localeCompare(b.type || "") || a.name.localeCompare(b.name)
      return 0
    })
    return sorted
  }, [fields, fieldSearch, fieldSort])

  const handleFieldToggle = (fieldName: string, checked: boolean) => {
    if (checked) {
      setLocalSelectedFields([...localSelectedFields, fieldName])
    } else {
      setLocalSelectedFields(localSelectedFields.filter((f) => f !== fieldName))
    }
  }

  const handleSelectAll = () => {
    setLocalSelectedFields(fields.map((f) => f.name))
  }

  const handleSelectNone = () => {
    setLocalSelectedFields([])
  }

  const handleInvertSelection = () => {
    const selected = new Set(localSelectedFields)
    setLocalSelectedFields(fields.filter((f) => !selected.has(f.name)).map((f) => f.name))
  }

  const applyPaste = (mode: "add" | "replace") => {
    const tokens = parsePasteList(pasteText)
    if (tokens.length === 0) {
      setPasteSummary({ added: 0, missing: 0 })
      return
    }

    const fieldNameByNorm = new Map<string, string>()
    for (const f of fields) {
      fieldNameByNorm.set(normalizeToken(f.name), f.name)
    }

    const matched: string[] = []
    let missing = 0
    for (const t of tokens) {
      const match = fieldNameByNorm.get(normalizeToken(t))
      if (match) matched.push(match)
      else missing += 1
    }

    const next =
      mode === "replace"
        ? Array.from(new Set(matched))
        : Array.from(new Set([...localSelectedFields, ...matched]))

    const addedCount =
      mode === "replace"
        ? next.length
        : next.filter((n) => !localSelectedFields.includes(n)).length

    setLocalSelectedFields(next)
    setPasteSummary({ added: addedCount, missing })
  }

  const handleSave = () => {
    // Call onFieldsChange first to update parent state (which changes step to 'name')
    onFieldsChange(localSelectedFields)
    // Close the modal - the functional setState in parent will prevent revert if step already changed
    onOpenChange(false)
  }


  // Get visible fields for preview (in order they appear in fields array)
  const visibleFieldsForPreview = useMemo(() => {
    return fields.filter((f) => localSelectedFields.includes(f.name))
  }, [fields, localSelectedFields])

  // Get preview fields for record list (first 3 visible fields)
  const previewFields = useMemo(() => {
    return localSelectedFields.slice(0, 3)
  }, [localSelectedFields])

  if (!tableId) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1400px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Pick elements</DialogTitle>
          <DialogDescription>
            Display elements and fields on the interface that respond to your selected record. You can always add or remove these later.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex gap-4 overflow-hidden mt-4">
          {/* Left: Field Selector */}
          <div className="w-80 border-r flex flex-col overflow-hidden">
            <div className="p-4 border-b">
              <Label className="text-sm font-medium">Connected to: Record list</Label>
              <div className="mt-2 relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                  placeholder="Search fields..."
                  className="pl-8 h-8 text-sm"
                />
              </div>

              <div className="mt-2">
                <Label className="text-xs text-gray-600">Sort</Label>
                <Select value={fieldSort} onValueChange={(v) => setFieldSort(v as any)}>
                  <SelectTrigger className="h-8 text-sm mt-1">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="position">Default (table order)</SelectItem>
                    <SelectItem value="name_asc">Name (A → Z)</SelectItem>
                    <SelectItem value="name_desc">Name (Z → A)</SelectItem>
                    <SelectItem value="type_asc">Type (A → Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  Select All
                </button>
                <span className="text-xs text-gray-300">|</span>
                <button
                  type="button"
                  onClick={handleSelectNone}
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  Select None
                </button>
                <span className="text-xs text-gray-300">|</span>
                <button
                  type="button"
                  onClick={handleInvertSelection}
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  Invert
                </button>
              </div>

              <div className="mt-3 space-y-2">
                <Label className="text-xs text-gray-600">Paste list (field names)</Label>
                <Textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"Paste field names (one per line, or comma-separated)"}
                  className="text-xs min-h-[70px]"
                />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPaste("add")}>
                    Add
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPaste("replace")}>
                    Replace
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
                    Added: {pasteSummary.added} · Not found: {pasteSummary.missing}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading ? (
                <div className="text-sm text-gray-500 text-center py-8">Loading fields...</div>
              ) : filteredFields.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-8">No fields found</div>
              ) : (
                filteredFields.map((field) => {
                  const isSelected = localSelectedFields.includes(field.name)
                  const FieldIcon = getFieldIcon(field.type)

                  return (
                    <label
                      key={field.id}
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <Switch
                        checked={isSelected}
                        onCheckedChange={(checked) => handleFieldToggle(field.name, checked)}
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex-shrink-0">{FieldIcon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {getFieldDisplayName(field)}
                          </div>
                          <div className="text-xs text-gray-500">{field.type}</div>
                        </div>
                      </div>
                    </label>
                  )
                })
              )}
            </div>
          </div>

          {/* Center: Record List Preview */}
          <div className="w-80 border-r flex flex-col overflow-hidden bg-gray-50">
            <div className="p-4 border-b bg-white">
              <Label className="text-sm font-medium">{tableName || "Record list"}</Label>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-2">
                {records.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-8">No records</div>
                ) : (
                  records.map((record) => {
                    const isSelected = selectedRecord?.id === record.id
                    return (
                      <div
                        key={record.id}
                        onClick={() => setSelectedRecord(record)}
                        className={cn(
                          "p-3 rounded border cursor-pointer transition-colors",
                          isSelected
                            ? "bg-blue-50 border-blue-200"
                            : "bg-white border-gray-200 hover:border-gray-300"
                        )}
                      >
                        {previewFields.length > 0 ? (
                          <div className="space-y-1">
                            {previewFields.map((fieldName, idx) => {
                              const value = record[fieldName]
                              return (
                                <div
                                  key={fieldName}
                                  className={cn(
                                    "text-sm truncate",
                                    idx === 0 ? "font-medium text-gray-900" : "text-gray-600"
                                  )}
                                >
                                  {value !== null && value !== undefined
                                    ? String(value).substring(0, 40)
                                    : "—"}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="text-sm font-medium text-gray-900">
                            {"Record"}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right: Record Detail Preview */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white border-l">
            <div className="p-4 border-b">
              <Label className="text-sm font-medium">Record details</Label>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {!selectedRecord ? (
                <div className="text-sm text-gray-500 text-center py-8">
                  Select a record from the list to preview
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Record Title */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {previewFields.length > 0 && selectedRecord[previewFields[0]]
                        ? String(selectedRecord[previewFields[0]]).substring(0, 50)
                        : "Untitled"}
                    </h3>
                  </div>

                  {/* Selected Fields List */}
                  {visibleFieldsForPreview.length === 0 ? (
                    <div className="text-sm text-gray-500 text-center py-8">
                      No fields selected. Select fields in the left panel to see them here.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {visibleFieldsForPreview.map((field) => {
                        const value = selectedRecord[field.name]
                        return (
                          <div key={field.id}>
                            <Label className="text-xs font-medium text-gray-500 uppercase">
                              {getFieldDisplayName(field)}
                            </Label>
                            <div className="mt-1 text-sm text-gray-900">
                              {value !== null && value !== undefined ? (
                                field.type === "single_select" && typeof value === "string" ? (
                                  <Badge variant="outline" className="text-xs">
                                    {value}
                                  </Badge>
                                ) : (
                                  String(value)
                                )
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t mt-4">
          <div className="text-sm text-gray-500">
            {localSelectedFields.length} of {fields.length} fields selected
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
