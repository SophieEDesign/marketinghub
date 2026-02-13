"use client"

/**
 * Dev-only right-side drawer for editing table field schema.
 * Opens when uiMode === 'fieldSchemaEdit'.
 * Edits table schema globally via PATCH /api/tables/[tableId]/fields.
 */
import { useState, useEffect, useCallback } from "react"
import { useUIState } from "@/contexts/UIStateContext"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { Trash2, Plus } from "lucide-react"
import type { TableField, FieldType } from "@/types/fields"

const SELECT_TYPES: FieldType[] = ["single_select", "multi_select"]

interface FieldSchemaDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tableId: string
  field: TableField | null
  allFields?: TableField[]
  onFieldUpdated?: () => void
}

export default function FieldSchemaDrawer({
  open,
  onOpenChange,
  tableId,
  field,
  allFields = [],
  onFieldUpdated,
}: FieldSchemaDrawerProps) {
  const { uiMode, setUIMode } = useUIState()
  const { toast } = useToast()
  const [label, setLabel] = useState("")
  const [required, setRequired] = useState(false)
  const [defaultValue, setDefaultValue] = useState("")
  const [options, setOptions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [selectedField, setSelectedField] = useState<TableField | null>(field)

  const editingField = selectedField || field
  const isSelectType = editingField && SELECT_TYPES.includes(editingField.type)
  const displayOptions = editingField?.options?.choices ?? editingField?.options?.selectOptions?.map((o) => o.label) ?? []

  useEffect(() => {
    setSelectedField(field)
  }, [field?.id])

  useEffect(() => {
    if (editingField) {
      setLabel(editingField.label ?? editingField.name ?? "")
      setRequired(editingField.required ?? false)
      setDefaultValue(String(editingField.default_value ?? ""))
      setOptions(Array.isArray(displayOptions) ? [...displayOptions] : [])
    }
  }, [editingField?.id, editingField?.label, editingField?.name, editingField?.required, editingField?.default_value, displayOptions])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      onOpenChange(next)
      if (!next) {
        setUIMode("view")
      }
    },
    [onOpenChange, setUIMode]
  )

  useEffect(() => {
    if (open) {
      setUIMode("fieldSchemaEdit")
    }
  }, [open, setUIMode])

  const handleSave = async () => {
    if (!editingField || !tableId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/tables/${tableId}/fields`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldId: editingField.id,
          label: label.trim() || undefined,
          required,
          default_value: defaultValue.trim() || undefined,
          options: isSelectType ? { choices: options.filter(Boolean) } : undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to save")
      }
      toast({ title: "Field updated" })
      onFieldUpdated?.()
    } catch (e: any) {
      toast({ title: "Failed to update field", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editingField || !tableId) return
    if (!confirm(`Delete field "${editingField.label || editingField.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/tables/${tableId}/fields`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldId: editingField.id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to delete")
      }
      toast({ title: "Field deleted" })
      onFieldUpdated?.()
      handleOpenChange(false)
    } catch (e: any) {
      toast({ title: "Failed to delete field", description: e.message, variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const addOption = () => setOptions((prev) => [...prev, ""])
  const updateOption = (i: number, v: string) =>
    setOptions((prev) => {
      const next = [...prev]
      next[i] = v
      return next
    })
  const removeOption = (i: number) =>
    setOptions((prev) => prev.filter((_, idx) => idx !== i))

  const showDrawer = open

  return (
    <Sheet open={showDrawer} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Field Schema</SheetTitle>
        </SheetHeader>
        {!editingField && (
          <div className="mt-6">
            <Label>Select a field to edit</Label>
            {allFields.length === 0 ? (
              <p className="text-sm text-gray-500 mt-2">No fields available. Open a record first.</p>
            ) : (
            <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
              {allFields.filter((f) => !f.options?.system).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm"
                  onClick={() => setSelectedField(f)}
                >
                  {f.label || f.name} ({f.type})
                </button>
              ))}
            </div>
            )}
          </div>
        )}
        {editingField && (
          <div className="mt-6 space-y-6">
            <div>
              <Label>Field name (label)</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Field name"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-500">Type: {editingField.type}</Label>
              <p className="text-xs text-gray-400 mt-0.5">Changing type is not supported in this drawer.</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={required} onCheckedChange={setRequired} />
              <Label>Required</Label>
            </div>
            <div>
              <Label>Default value</Label>
              <Input
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                placeholder="Optional"
                className="mt-1"
              />
            </div>
            {isSelectType && (
              <div>
                <Label>Options</Label>
                <div className="mt-2 space-y-2">
                  {(options.length ? options : [""]).map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={opt}
                        onChange={(e) => updateOption(i, e.target.value)}
                        placeholder={`Option ${i + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOption(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addOption}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add option
                  </Button>
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete field"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
