"use client"

import { useState, useEffect, useCallback } from "react"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { ExternalLink } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getFieldDisplayName } from "@/lib/fields/display"
import type { TableField } from "@/types/fields"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"
import { cn } from "@/lib/utils"

interface FieldBlockSettingsProps {
  fieldId: string
  tableId: string
  tableName?: string | null
  fieldLayout: FieldLayoutItem[]
  onLayoutSave: ((layout: FieldLayoutItem[]) => void) | ((layout: FieldLayoutItem[]) => Promise<void>) | null
  fields: TableField[]
  onEditField?: () => void
  onFieldChange?: (fieldId: string) => void
}

export default function FieldBlockSettings({
  fieldId,
  tableId,
  tableName,
  fieldLayout,
  onLayoutSave,
  fields,
  onEditField,
  onFieldChange,
}: FieldBlockSettingsProps) {
  const { setFieldLayout: setLiveLayout } = useRecordPanel()
  const [tableDisplayName, setTableDisplayName] = useState<string>("Record")

  const field = fields.find((f) => f.id === fieldId)
  const layoutItem = fieldLayout.find(
    (i) => i.field_id === fieldId || i.field_name === field?.name
  )
  const isEditable = layoutItem?.editable !== false

  useEffect(() => {
    if (tableName) {
      setTableDisplayName(tableName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    } else if (tableId) {
      fetch(`/api/tables/${tableId}`)
        .then((r) => r.json())
        .then((data) => {
          const name = data?.table?.name
          if (name) setTableDisplayName(name)
        })
        .catch(() => {})
    }
  }, [tableId, tableName])

  const handleFieldChange = useCallback(
    (newFieldId: string) => {
      const newField = fields.find((f) => f.id === newFieldId)
      if (!newField || !layoutItem || !onLayoutSave) return

      const updated = fieldLayout.map((item) =>
        item.field_id === fieldId || item.field_name === field?.name
          ? {
              ...item,
              field_id: newField.id,
              field_name: newField.name,
            }
          : item
      )
      setLiveLayout(updated)
      onLayoutSave(updated)
      onFieldChange?.(newField.id)
    },
    [fieldId, field?.name, fieldLayout, fields, layoutItem, onLayoutSave, setLiveLayout, onFieldChange]
  )

  const handleEditableChange = useCallback(
    (editable: boolean) => {
      if (!layoutItem || !onLayoutSave) return

      const updated = fieldLayout.map((item) =>
        item.field_id === fieldId || item.field_name === field?.name
          ? { ...item, editable }
          : item
      )
      setLiveLayout(updated)
      onLayoutSave(updated)
    },
    [fieldId, field?.name, fieldLayout, layoutItem, onLayoutSave, setLiveLayout]
  )

  if (!field) {
    return (
      <div className="p-4 text-sm text-gray-500">Field not found</div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="data" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start rounded-none border-b border-gray-200 bg-transparent h-auto p-0 mx-4 mt-0">
          <TabsTrigger
            value="data"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:shadow-none"
          >
            Data
          </TabsTrigger>
          <TabsTrigger
            value="appearance"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:shadow-none"
          >
            Appearance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="data" className="flex-1 overflow-y-auto p-4 space-y-6 mt-0">
          {/* Source */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Source</Label>
            <div className="space-y-2">
              <div className="flex h-10 w-full items-center rounded-md border border-input bg-gray-50 px-3 py-2 text-sm">
                {tableDisplayName}
              </div>
              <Select
                value={fieldId}
                onValueChange={handleFieldChange}
                disabled={!onLayoutSave}
              >
                <SelectTrigger className="bg-gray-50">
                  <SelectValue>{getFieldDisplayName(field)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {fields.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {getFieldDisplayName(f)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {onEditField && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onEditField}
                  className="w-full justify-start gap-2"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Edit field
                </Button>
              )}
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Permissions</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleEditableChange(false)}
                disabled={!onLayoutSave}
                className={cn(
                  "flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-colors",
                  !isEditable
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                )}
              >
                View-only
              </button>
              <button
                type="button"
                onClick={() => handleEditableChange(true)}
                disabled={!onLayoutSave}
                className={cn(
                  "flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-colors",
                  isEditable
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                )}
              >
                Editable
              </button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="appearance" className="flex-1 overflow-y-auto p-4 mt-0">
          <p className="text-sm text-gray-500">Appearance options for this field block.</p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
