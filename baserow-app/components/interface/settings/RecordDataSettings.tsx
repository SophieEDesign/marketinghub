"use client"

/**
 * Record Block Data Settings
 * 
 * Block-level settings for "record" blocks (blocks that display a single record).
 * 
 * NOTE: This is for BLOCK settings, not page-level Record View settings.
 * Page-level settings (source table, title field, visible fields, field editability) 
 * are configured in RecordViewPageSettings and apply to the entire Record View page.
 * 
 * Record blocks can:
 * - Display a record from any table (not tied to page's source table)
 * - Show selected fields for that specific block instance
 * - Have block-specific permissions
 * 
 * Record blocks do NOT:
 * - Define the page's source table (that's page-level)
 * - Define the page's title field (that's page-level)
 * - Define the page's visible core fields (that's page-level)
 */

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import { Switch } from "@/components/ui/switch"
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

interface RecordDataSettingsProps {
  config: BlockConfig
  tables: Table[]
  fields: TableField[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
}

export default function RecordDataSettings({
  config,
  tables,
  fields,
  onUpdate,
  onTableChange,
}: RecordDataSettingsProps) {
  const [recordSearch, setRecordSearch] = useState("")
  const [records, setRecords] = useState<Array<{ id: string; display: string }>>([])
  const [loadingRecords, setLoadingRecords] = useState(false)

  useEffect(() => {
    if (config.table_id && recordSearch) {
      searchRecords()
    }
  }, [config.table_id, recordSearch])

  async function searchRecords() {
    if (!config.table_id || !recordSearch) return

    setLoadingRecords(true)
    try {
      const supabase = createClient()
      const { data: table } = await supabase
        .from("tables")
        .select("supabase_table")
        .eq("id", config.table_id)
        .single()

      if (!table?.supabase_table) return

      // Search records - adjust based on your schema
      const { data, error } = await supabase
        .from(table.supabase_table)
        .select("id, data")
        .limit(20)

      if (error) throw error

      const matched = (data || [])
        .filter((row: any) => {
          const searchLower = recordSearch.toLowerCase()
          const dataStr = JSON.stringify(row.data || {}).toLowerCase()
          return dataStr.includes(searchLower)
        })
        .map((row: any) => ({
          id: row.id,
          display: Object.values(row.data || {}).slice(0, 2).join(" - ") || row.id,
        }))

      setRecords(matched)
    } catch (error) {
      console.error("Error searching records:", error)
    } finally {
      setLoadingRecords(false)
    }
  }

  const detailFields = config.detail_fields || []
  const availableFields = fields.filter(
    f => !detailFields.includes(f.name)
  )

  return (
    <div className="space-y-4">
      {/* Table Selection - Block-specific table (can be different from page's source table) */}
      <div className="space-y-2">
        <Label>Source Table *</Label>
        <Select
          value={config.table_id || ""}
          onValueChange={onTableChange}
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
        <p className="text-xs text-gray-500">
          The table containing the record to display in this block. This is independent from the
          page's source table (configured in Page Settings).
        </p>
      </div>

      {/* Record Selection */}
      {config.table_id && (
        <div className="space-y-2">
          <Label>Record</Label>
          <div className="flex gap-2">
            <Input
              value={recordSearch}
              onChange={(e) => setRecordSearch(e.target.value)}
              placeholder="Search records..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  searchRecords()
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={searchRecords}
              disabled={loadingRecords}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {records.length > 0 && (
            <Select
              value={config.record_id || ""}
              onValueChange={(value) => onUpdate({ record_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a record" />
              </SelectTrigger>
              <SelectContent>
                {records.map((record) => (
                  <SelectItem key={record.id} value={record.id}>
                    {record.display}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {config.record_id && (
            <div className="text-xs text-gray-500">
              Selected: {config.record_id}
            </div>
          )}
        </div>
      )}

      {/* Field Visibility - Block-specific field selection (for this block instance) */}
      {config.table_id && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Fields to Display</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  // Select all fields
                  const allFieldNames = fields.map(f => f.name)
                  onUpdate({ detail_fields: allFieldNames })
                }}
                className="text-xs text-blue-600 hover:text-blue-700 underline"
              >
                Select All
              </button>
              <span className="text-xs text-gray-300">|</span>
              <button
                type="button"
                onClick={() => {
                  // Select none
                  onUpdate({ detail_fields: [] })
                }}
                className="text-xs text-blue-600 hover:text-blue-700 underline"
              >
                Select None
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Which fields to display in this record block. This is block-specific and independent
            from the page's visible fields (configured in Page Settings).
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-2">
            {fields.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-2">
                No fields available
              </div>
            ) : (
              fields.map((field) => {
                const isVisible = detailFields.includes(field.name)
                return (
                  <label
                    key={field.id}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onUpdate({
                            detail_fields: [...detailFields, field.name],
                          })
                        } else {
                          onUpdate({
                            detail_fields: detailFields.filter(
                              f => f !== field.name
                            ),
                          })
                        }
                      }}
                      className="cursor-pointer"
                    />
                    <span>{field.name}</span>
                  </label>
                )
              })
            )}
          </div>
          <p className="text-xs text-gray-500">
            {detailFields.length} of {fields.length} fields visible
          </p>
        </div>
      )}

      {/* Block Permissions - Block-level permissions (cannot exceed page-level permissions) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <Label>Block Permissions</Label>
            <p className="text-xs text-gray-500">
              Block-level permissions. Cannot exceed page-level permissions.
            </p>
          </div>
          <Select
            value={config.allow_editing ? "editable" : "view_only"}
            onValueChange={(value) =>
              onUpdate({ allow_editing: value === "editable" })
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="view_only">View-only</SelectItem>
              <SelectItem value="editable">Editable</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-gray-500">
          If the page is view-only, this block will also be view-only regardless of this setting.
        </p>
      </div>
    </div>
  )
}

