"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { X } from "lucide-react"
import type { TableField } from "@/types/fields"
import { CellFactory } from "@/components/grid/CellFactory"

interface RowDetailViewProps {
  tableId: string
  rowId: string
  fieldIds: string[]
  onClose?: () => void
}

export default function RowDetailView({
  tableId,
  rowId,
  fieldIds,
  onClose,
}: RowDetailViewProps) {
  const [supabaseTableName, setSupabaseTableName] = useState<string | null>(null)
  const [rowData, setRowData] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<TableField[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!tableId || !rowId) return
      setLoading(true)
      setError(null)
      try {
        // Resolve actual supabase table name
        const tableRes = await supabase
          .from("tables")
          .select("supabase_table")
          .eq("id", tableId)
          .maybeSingle()

        const tableName = tableRes.data?.supabase_table || null
        if (cancelled) return
        setSupabaseTableName(tableName)
        if (!tableName) {
          setRowData(null)
          setError("Table not configured")
          return
        }

        const fieldsRes = await supabase
          .from("table_fields")
          .select("*")
          .eq("table_id", tableId)
          .order("position")
        if (!cancelled) setFields((fieldsRes.data as TableField[]) || [])

        const rowRes = await supabase
          .from(tableName)
          .select("*")
          .eq("id", rowId)
          .maybeSingle()
        if (cancelled) return
        setRowData((rowRes.data as any) ?? null)
        if (!rowRes.data) {
          setError("Record not found")
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load record")
          setRowData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [rowId, tableId])

  const isVirtualField = useCallback((field?: TableField | null) => {
    return field?.type === "formula" || field?.type === "lookup"
  }, [])

  const handleCellSave = useCallback(async (fieldName: string, value: any) => {
    if (!supabaseTableName) return
    if (!rowId) return
    const { error } = await supabase
      .from(supabaseTableName)
      .update({ [fieldName]: value })
      .eq("id", rowId)
    if (error) throw error
    setRowData((prev) => ({ ...(prev || {}), [fieldName]: value }))
  }, [rowId, supabaseTableName])

  const fieldDefs = useMemo(() => {
    return (Array.isArray(fieldIds) ? fieldIds : []).map((fid) => {
      const f = fields.find((x) => x.id === fid || x.name === fid) || null
      return { fid, field: f, name: f?.name || String(fid) }
    })
  }, [fieldIds, fields])

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">Loading…</div>
  }

  if (error) {
    return <div className="p-4 text-sm text-gray-500">{error}</div>
  }

  const content = (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Row Details</CardTitle>
          <div className="flex gap-2">
            {onClose && (
              <button type="button" onClick={onClose} className="p-2 rounded hover:bg-gray-100" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {fieldDefs.map(({ fid, field, name }) => {
            const value = field && rowData ? (rowData as any)[field.name] : null
            return (
              <div key={String(fid)} className="space-y-2">
                <label className="text-sm font-medium">{name}</label>
                {field ? (
                  <div className="min-h-[36px]" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                    <CellFactory
                      field={field}
                      value={value}
                      rowId={String(rowId)}
                      tableName={supabaseTableName || ""}
                      editable={!field.options?.read_only && !isVirtualField(field) && !!supabaseTableName}
                      wrapText={true}
                      rowHeight={40}
                      onSave={(v) => handleCellSave(field.name, v)}
                    />
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 italic">—</div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )

  if (onClose) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Row Details</DialogTitle>
            <DialogDescription>
              View and edit the details of this record.
            </DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  return content
}
