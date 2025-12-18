"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { 
  GripVertical, 
  MoreVertical, 
  Plus, 
  Trash2,
  Edit,
  ChevronDown,
  ChevronRight,
  Type,
  FileText,
  Hash,
  Percent,
  DollarSign,
  Calendar,
  List,
  CheckSquare,
  Paperclip,
  Link2,
  Calculator,
  Search
} from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import { FIELD_TYPES } from "@/types/fields"
import { computeFormulaFields } from "@/lib/formulas/computeFormulaFields"

interface AirtableGridViewProps {
  tableId: string
  viewId: string
  supabaseTableName: string
  viewFields: Array<{
    field_name: string
    visible: boolean
    position: number
  }>
  viewFilters?: Array<{
    field_name: string
    operator: string
    value?: string
  }>
  viewSorts?: Array<{
    field_name: string
    direction: string
  }>
  tableFields: TableField[]
  onAddField?: () => void
  onEditField?: (fieldName: string) => void
  onDeleteField?: (fieldName: string) => void
  onReorderFields?: (fieldNames: string[]) => void
}

const ROW_HEIGHT = 40
const HEADER_HEIGHT = 40
const COLUMN_MIN_WIDTH = 150
const COLUMN_DEFAULT_WIDTH = 200

export default function AirtableGridView({
  tableId,
  viewId,
  supabaseTableName,
  viewFields,
  viewFilters = [],
  viewSorts = [],
  tableFields = [],
  onAddField,
  onEditField,
  onDeleteField,
  onReorderFields,
}: AirtableGridViewProps) {
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(true)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; fieldName: string } | null>(null)
  const [editingCell, setEditingCell] = useState<{ rowId: string; fieldName: string } | null>(null)
  const [cellValue, setCellValue] = useState<string>("")
  const gridRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(600)

  // Get visible fields ordered by position
  const visibleFields = useMemo(() => {
    return viewFields
      .filter((f) => f.visible)
      .sort((a, b) => a.position - b.position)
      .map((vf) => {
        const field = tableFields.find((f) => f.name === vf.field_name)
        return { ...vf, field }
      })
      .filter((vf) => vf.field) // Only include fields that exist
  }, [viewFields, tableFields])

  // Initialize column widths
  useEffect(() => {
    const widths: Record<string, number> = {}
    visibleFields.forEach((vf) => {
      widths[vf.field_name] = COLUMN_DEFAULT_WIDTH
    })
    setColumnWidths(widths)
  }, [visibleFields.map(vf => vf.field_name).join(",")])

  // Load rows
  useEffect(() => {
    loadRows()
  }, [supabaseTableName, viewFilters, viewSorts, tableFields])

  // Update container height
  useEffect(() => {
    if (gridRef.current) {
      const updateHeight = () => {
        setContainerHeight(gridRef.current?.clientHeight || 600)
      }
      updateHeight()
      window.addEventListener("resize", updateHeight)
      return () => window.removeEventListener("resize", updateHeight)
    }
  }, [])

  async function loadRows() {
    if (!supabaseTableName) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      let query = supabase.from(supabaseTableName).select("*")

      // Apply filters
      for (const filter of viewFilters) {
        const fieldValue = filter.value
        switch (filter.operator) {
          case "equal":
            query = query.eq(filter.field_name, fieldValue)
            break
          case "not_equal":
            query = query.neq(filter.field_name, fieldValue)
            break
          case "contains":
            query = query.ilike(filter.field_name, `%${fieldValue}%`)
            break
          case "is_empty":
            query = query.or(`${filter.field_name}.is.null,${filter.field_name}.eq.`)
            break
          case "is_not_empty":
            query = query.not(filter.field_name, "is", null)
            break
          case "greater_than":
            query = query.gt(filter.field_name, fieldValue)
            break
          case "less_than":
            query = query.lt(filter.field_name, fieldValue)
            break
        }
      }

      // Apply sorting
      if (viewSorts.length > 0) {
        for (const sort of viewSorts) {
          query = query.order(sort.field_name, {
            ascending: sort.direction === "asc",
          })
        }
      } else {
        query = query.order("id", { ascending: false })
      }

      const { data, error } = await query

      if (error) {
        console.error("Error loading rows:", error)
        setRows([])
      } else {
        // Compute formula fields
        const computedRows = (data || []).map((row) => {
          return computeFormulaFields(row, tableFields, tableFields)
        })
        setRows(computedRows)
      }
    } catch (error) {
      console.error("Error loading rows:", error)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  // Virtualization calculations
  const visibleRowCount = Math.ceil(containerHeight / ROW_HEIGHT) + 2
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 1)
  const endIndex = Math.min(rows.length, startIndex + visibleRowCount)
  const visibleRows = rows.slice(startIndex, endIndex)
  const totalWidth = visibleFields.reduce((sum, vf) => sum + (columnWidths[vf.field_name] || COLUMN_DEFAULT_WIDTH), 0) + 50

  function handleResizeStart(fieldName: string) {
    setResizingColumn(fieldName)
  }

  function handleResize(e: MouseEvent) {
    if (!resizingColumn) return

    const gridRect = gridRef.current?.getBoundingClientRect()
    if (!gridRect) return

    const newWidth = Math.max(COLUMN_MIN_WIDTH, e.clientX - gridRect.left - 50)
    setColumnWidths((prev) => ({
      ...prev,
      [resizingColumn]: newWidth,
    }))
  }

  function handleResizeEnd() {
    setResizingColumn(null)
  }

  useEffect(() => {
    if (resizingColumn) {
      document.addEventListener("mousemove", handleResize)
      document.addEventListener("mouseup", handleResizeEnd)
      return () => {
        document.removeEventListener("mousemove", handleResize)
        document.removeEventListener("mouseup", handleResizeEnd)
      }
    }
  }, [resizingColumn])

  async function handleCellSave(rowId: string, fieldName: string, value: any) {
    try {
      const { error } = await supabase
        .from(supabaseTableName)
        .update({ [fieldName]: value })
        .eq("id", rowId)

      if (error) {
        console.error("Error saving cell:", error)
        alert("Failed to save cell")
      } else {
        await loadRows()
      }
    } catch (error) {
      console.error("Error saving cell:", error)
    }
    setEditingCell(null)
    setSelectedCell(null)
  }

  function getFieldIcon(type: string) {
    const iconClass = "h-3.5 w-3.5 text-gray-500"
    switch (type) {
      case "text":
        return <Type className={iconClass} />
      case "long_text":
        return <FileText className={iconClass} />
      case "number":
        return <Hash className={iconClass} />
      case "percent":
        return <Percent className={iconClass} />
      case "currency":
        return <DollarSign className={iconClass} />
      case "date":
        return <Calendar className={iconClass} />
      case "single_select":
      case "multi_select":
        return <List className={iconClass} />
      case "checkbox":
        return <CheckSquare className={iconClass} />
      case "attachment":
        return <Paperclip className={iconClass} />
      case "link_to_table":
        return <Link2 className={iconClass} />
      case "formula":
        return <Calculator className={iconClass} />
      case "lookup":
        return <Search className={iconClass} />
      default:
        return <Type className={iconClass} />
    }
  }

  function formatCellValue(value: any, field: TableField | undefined): string {
    if (value === null || value === undefined) return ""
    if (field?.type === "checkbox") return value ? "✓" : ""
    if (field?.type === "date") {
      return new Date(value).toLocaleDateString()
    }
    return String(value)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Grid Container */}
      <div
        ref={gridRef}
        className="flex-1 overflow-auto relative bg-white"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        style={{ height: "calc(100vh - 14rem)" }}
      >
        {/* Grid */}
        <div style={{ width: totalWidth, height: rows.length * ROW_HEIGHT, position: "relative" }}>
          {/* Header */}
          <div
            className="sticky top-0 z-10 bg-white border-b border-gray-300 shadow-sm flex"
            style={{ height: HEADER_HEIGHT }}
          >
            {/* Row number column */}
            <div
              className="border-r border-gray-200 bg-gray-50 flex items-center justify-center text-xs font-medium text-gray-600"
              style={{ width: 50, height: HEADER_HEIGHT }}
            >
              #
            </div>

            {/* Field columns */}
            {visibleFields.map((vf, idx) => {
              const field = vf.field!
              const width = columnWidths[vf.field_name] || COLUMN_DEFAULT_WIDTH
              return (
                <div
                  key={vf.field_name}
                  className="border-r border-gray-200 flex items-center group relative bg-white hover:bg-gray-50 transition-colors"
                  style={{ width, height: HEADER_HEIGHT }}
                >
                  <div className="flex items-center gap-2 px-3 flex-1 min-w-0">
                    <span className="text-gray-500">{getFieldIcon(field.type)}</span>
                    <span className="text-sm font-semibold text-gray-900 truncate">{field.name}</span>
                  </div>
                  <button
                    onClick={() => onEditField?.(vf.field_name)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity mr-1"
                  >
                    <MoreVertical className="h-4 w-4 text-gray-500" />
                  </button>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors"
                    onMouseDown={() => handleResizeStart(vf.field_name)}
                  />
                </div>
              )
            })}

            {/* Add field column */}
            <div
              className="border-r border-gray-200 bg-gray-50 flex items-center justify-center"
              style={{ width: 50, height: HEADER_HEIGHT }}
            >
              <button
                onClick={onAddField}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
              >
                <Plus className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Rows */}
          <div style={{ marginTop: startIndex * ROW_HEIGHT }}>
            {visibleRows.map((row, rowIdx) => {
              const actualRowIndex = startIndex + rowIdx
              const isEven = actualRowIndex % 2 === 0
              return (
                <div
                  key={row.id}
                  className={`flex border-b border-gray-100 hover:bg-blue-50 group transition-colors ${
                    isEven ? "bg-white" : "bg-gray-50/50"
                  }`}
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Row number */}
                  <div
                    className="border-r border-gray-200 bg-gray-50 flex items-center justify-center text-xs text-gray-500 font-medium"
                    style={{ width: 50, height: ROW_HEIGHT }}
                  >
                    {actualRowIndex + 1}
                  </div>

                  {/* Cells */}
                  {visibleFields.map((vf) => {
                    const field = vf.field!
                    const width = columnWidths[vf.field_name] || COLUMN_DEFAULT_WIDTH
                    const isEditing = editingCell?.rowId === row.id && editingCell?.fieldName === vf.field_name
                    const isSelected = selectedCell?.rowId === row.id && selectedCell?.fieldName === vf.field_name
                    const value = row[vf.field_name]
                    const displayValue = formatCellValue(value, field)

                    return (
                      <div
                        key={vf.field_name}
                        className={`border-r border-gray-100 flex items-center relative ${
                          isSelected ? "bg-blue-100 ring-2 ring-blue-500 ring-inset" : ""
                        }`}
                        style={{ width, height: ROW_HEIGHT }}
                        onClick={() => setSelectedCell({ rowId: row.id, fieldName: vf.field_name })}
                        onDoubleClick={() => {
                          setEditingCell({ rowId: row.id, fieldName: vf.field_name })
                          setCellValue(String(value || ""))
                        }}
                      >
                        {isEditing ? (
                          <input
                            type={field.type === "number" ? "number" : "text"}
                            value={cellValue}
                            onChange={(e) => setCellValue(e.target.value)}
                            onBlur={() => {
                              const newValue = field.type === "number" ? parseFloat(cellValue) : cellValue
                              handleCellSave(row.id, vf.field_name, newValue)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const newValue = field.type === "number" ? parseFloat(cellValue) : cellValue
                                handleCellSave(row.id, vf.field_name, newValue)
                              } else if (e.key === "Escape") {
                                setEditingCell(null)
                              }
                            }}
                            className="w-full h-full px-3 text-sm border-none outline-none bg-white focus:ring-2 focus:ring-blue-500 rounded"
                            autoFocus
                          />
                        ) : (
                          <div className="px-3 text-sm text-gray-900 truncate w-full">
                            {displayValue || <span className="text-gray-400">—</span>}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Row actions */}
                  <div
                    className="border-r border-gray-200 bg-gray-50 flex items-center justify-center"
                    style={{ width: 50, height: ROW_HEIGHT }}
                  >
                    <button className="p-1 hover:bg-gray-200 rounded transition-opacity opacity-0 group-hover:opacity-100">
                      <MoreVertical className="h-4 w-4 text-gray-500" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
