"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { TableRow } from "@/types/database"
import type { TableField } from "@/types/fields"
import { Card, CardContent } from "@/components/ui/card"
import { filterRowsBySearch } from "@/lib/search/filterRows"
import { applyFiltersToQuery, type FilterConfig } from "@/lib/interface/filters"
import { resolveChoiceColor, normalizeHexColor } from "@/lib/field-colors"

interface GalleryViewProps {
  tableId: string
  viewId?: string
  fieldIds: string[]
  searchQuery?: string
  tableFields?: any[]
  filters?: FilterConfig[]
  onRecordClick?: (recordId: string) => void
  // Visual card fields
  colorField?: string
  imageField?: string
  fitImageSize?: boolean
  // Block config (optional, for future card settings)
  blockConfig?: Record<string, any>
}

export default function GalleryView({
  tableId,
  viewId,
  fieldIds,
  searchQuery = "",
  tableFields = [],
  filters = [],
  onRecordClick,
  colorField,
  imageField,
  fitImageSize = false,
  blockConfig = {},
}: GalleryViewProps) {
  const [rows, setRows] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [supabaseTableName, setSupabaseTableName] = useState<string | null>(null)

  // Resolve supabase table name
  useEffect(() => {
    async function loadTableInfo() {
      if (!tableId) {
        setSupabaseTableName(null)
        return
      }
      try {
        const supabase = createClient()
        const sanitizedTableId = tableId.split(":")[0]
        const { data, error } = await supabase
          .from("tables")
          .select("supabase_table")
          .eq("id", sanitizedTableId)
          .single()
        if (error || !data?.supabase_table) {
          setSupabaseTableName(null)
          return
        }
        setSupabaseTableName(data.supabase_table)
      } catch (e) {
        console.error("GalleryView: error loading table info", e)
        setSupabaseTableName(null)
      }
    }

    loadTableInfo()
  }, [tableId])

  // Load rows
  useEffect(() => {
    async function loadRows() {
      if (!supabaseTableName) {
        setRows([])
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const supabase = createClient()

        let query = supabase.from(supabaseTableName).select("*")

        // Apply unified filters (supports date_range etc.)
        const normalizedFields = (Array.isArray(tableFields) ? tableFields : []).map((f: any) => ({
          name: f.name || f.field_name || f.id || f.field_id,
          id: f.id || f.field_id,
          type: f.type || f.field_type,
          options: f.options || f.field_options,
        }))
        query = applyFiltersToQuery(query, filters, normalizedFields)

        // Default ordering
        query = query.order("created_at", { ascending: false })

        const { data, error } = await query
        if (error) {
          console.error("GalleryView: error loading rows", error)
          setRows([])
          return
        }

        const sanitizedTableId = tableId.split(":")[0]
        const tableRows: TableRow[] = (data || []).map((row: any) => ({
          id: row.id,
          table_id: sanitizedTableId,
          data: row,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }))
        setRows(tableRows)
      } catch (e) {
        console.error("GalleryView: exception loading rows", e)
        setRows([])
      } finally {
        setLoading(false)
      }
    }

    loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseTableName, tableId, JSON.stringify(filters)])

  const safeFieldIds = useMemo(() => (Array.isArray(fieldIds) ? fieldIds : []), [fieldIds])

  // Pick a title field for cards (simple heuristic, configurable later)
  const titleField = useMemo(() => {
    const configured =
      (blockConfig as any)?.gallery_title_field ||
      (blockConfig as any)?.card_title_field ||
      (blockConfig as any)?.title_field
    if (typeof configured === "string" && configured.trim() !== "") return configured
    return safeFieldIds[0] || "id"
  }, [blockConfig, safeFieldIds])

  const secondaryFields = useMemo(() => {
    const exclude = new Set<string>([titleField])
    if (typeof imageField === "string" && imageField) exclude.add(imageField)
    if (typeof colorField === "string" && colorField) exclude.add(colorField)
    return safeFieldIds.filter((f) => !exclude.has(f)).slice(0, 3)
  }, [safeFieldIds, titleField, imageField, colorField])

  const getCardColor = useCallback(
    (row: TableRow): string | null => {
      if (!colorField) return null

      const colorFieldObj = (Array.isArray(tableFields) ? tableFields : []).find(
        (f: any) => f.name === colorField || f.id === colorField
      )
      if (!colorFieldObj || (colorFieldObj.type !== "single_select" && colorFieldObj.type !== "multi_select")) {
        return null
      }

      const colorValue = row.data?.[colorFieldObj.name || colorField]
      if (!colorValue) return null

      const normalizedValue = String(colorValue).trim()
      return normalizeHexColor(
        resolveChoiceColor(
          normalizedValue,
          colorFieldObj.type,
          colorFieldObj.options,
          colorFieldObj.type === "single_select"
        )
      )
    },
    [colorField, tableFields]
  )

  const getCardImage = useCallback(
    (row: TableRow): string | null => {
      if (!imageField) return null

      const imageValue = row.data?.[imageField]
      if (!imageValue) return null

      // Attachment field (array of strings/objects)
      if (Array.isArray(imageValue) && imageValue.length > 0) {
        const first = imageValue[0]
        if (typeof first === "string") return first
        if (first && typeof first === "object" && typeof (first as any).url === "string") return (first as any).url
      }

      // URL field (string)
      if (typeof imageValue === "string" && (imageValue.startsWith("http") || imageValue.startsWith("/"))) {
        return imageValue
      }

      return null
    },
    [imageField]
  )

  const filteredRows = useMemo(() => {
    if (!searchQuery || !Array.isArray(tableFields) || tableFields.length === 0) return rows

    const flatRows = rows.map((r) => ({
      ...(r.data || {}),
      _rowId: r.id,
    }))

    const filtered = filterRowsBySearch(flatRows, tableFields, searchQuery, safeFieldIds)
    const ids = new Set((filtered || []).map((r: any) => r._rowId))
    return rows.filter((r) => ids.has(r.id))
  }, [rows, tableFields, searchQuery, safeFieldIds])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        Loading...
      </div>
    )
  }

  if (!supabaseTableName) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-1">Gallery view requires a table connection.</p>
          <p className="text-xs text-gray-400">Configure a table in block settings.</p>
        </div>
      </div>
    )
  }

  if (!imageField) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-1">Gallery view needs an image field.</p>
          <p className="text-xs text-gray-400">Set it in Appearance → Cover image field.</p>
        </div>
      </div>
    )
  }

  if (filteredRows.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-1">No records found</p>
          {filters.length > 0 && <p className="text-xs text-gray-400">Try adjusting filters.</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full overflow-auto bg-gray-50">
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredRows.map((row) => {
          const cardColor = getCardColor(row)
          const cardImage = getCardImage(row)
          const borderColor = cardColor ? { borderLeftColor: cardColor, borderLeftWidth: "4px" } : {}

          const titleRaw = row.data?.[titleField]
          const title = titleRaw !== undefined && titleRaw !== null && String(titleRaw).trim() !== "" ? String(titleRaw) : "Untitled"

          return (
            <Card
              key={row.id}
              className="cursor-pointer hover:shadow-md transition-shadow bg-white border-gray-200 rounded-lg overflow-hidden"
              style={borderColor}
              onClick={() => {
                if (onRecordClick) {
                  onRecordClick(row.id)
                  return
                }
                if (tableId) {
                  window.location.href = `/tables/${tableId}/records/${row.id}`
                }
              }}
            >
              {cardImage && (
                <div className={`w-full ${fitImageSize ? "h-auto" : "h-40"} bg-gray-100`}>
                  <img
                    src={cardImage}
                    alt=""
                    className={`w-full ${fitImageSize ? "h-auto object-contain" : "h-40 object-cover"}`}
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = "none"
                    }}
                  />
                </div>
              )}
              <CardContent className="p-4 space-y-2">
                <div className="text-sm font-semibold text-gray-900 line-clamp-2">{title}</div>
                <div className="space-y-1">
                  {secondaryFields.map((fieldName) => {
                    const fieldObj = (Array.isArray(tableFields) ? tableFields : []).find(
                      (f: any) => f.name === fieldName || f.id === fieldName
                    ) as TableField | undefined
                    const label = fieldObj?.name || fieldName
                    const value = row.data?.[fieldObj?.name || fieldName]
                    return (
                      <div key={fieldName} className="text-xs text-gray-700">
                        <span className="text-gray-500 font-medium">{label}:</span>{" "}
                        <span className="text-gray-900">{value === null || value === undefined || value === "" ? "—" : String(value)}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

