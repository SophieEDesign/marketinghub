"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BlockConfig } from "@/lib/interface/types"
import type { Table, TableField } from "@/types/database"
import { createClient } from "@/lib/supabase/client"

interface FieldDataSettingsProps {
  config: BlockConfig
  tables: Table[]
  fields: TableField[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange?: (tableId: string) => void
  pageTableId?: string | null // Table ID from the page (for record_view pages)
}

export default function FieldDataSettings({
  config,
  tables,
  fields,
  onUpdate,
  onTableChange,
  pageTableId = null,
}: FieldDataSettingsProps) {
  const [availableFields, setAvailableFields] = useState<TableField[]>([])
  const tableId = config.table_id || pageTableId

  // Load fields when table changes
  useEffect(() => {
    if (tableId) {
      loadFields(tableId)
    } else {
      setAvailableFields([])
    }
  }, [tableId])

  async function loadFields(tableId: string) {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", tableId)
        .order("order_index", { ascending: true })

      if (!error && data) {
        setAvailableFields(data as TableField[])
      }
    } catch (error) {
      console.error("Error loading fields:", error)
      setAvailableFields([])
    }
  }

  const handleTableChange = (newTableId: string) => {
    onUpdate({ table_id: newTableId, field_id: undefined }) // Clear field_id when table changes
    onTableChange?.(newTableId)
  }

  const handleFieldChange = (fieldId: string) => {
    onUpdate({ field_id: fieldId })
  }

  return (
    <div className="space-y-4">
      {/* Table Selection */}
      <div className="space-y-2">
        <Label>Table *</Label>
        <Select
          value={tableId || ""}
          onValueChange={handleTableChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a table" />
          </SelectTrigger>
          <SelectContent>
            {tables.map((table) => (
              <SelectItem key={table.id} value={table.id}>
                {table.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {pageTableId && !config.table_id && (
          <p className="text-xs text-gray-500">
            Using table from page settings
          </p>
        )}
      </div>

      {/* Field Selection */}
      {tableId && (
        <div className="space-y-2">
          <Label>Field *</Label>
          <Select
            value={config.field_id || ""}
            onValueChange={handleFieldChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a field" />
            </SelectTrigger>
            <SelectContent>
              {availableFields.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-gray-500">Loading fields...</div>
              ) : (
                availableFields.map((field) => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.name} ({field.type})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {availableFields.length === 0 && tableId && (
            <p className="text-xs text-gray-500">
              No fields found in this table
            </p>
          )}
        </div>
      )}

      {!tableId && (
        <p className="text-sm text-gray-500">
          Select a table to choose a field
        </p>
      )}
    </div>
  )
}
