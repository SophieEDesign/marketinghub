"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import ViewTopBar from "@/components/layout/ViewTopBar"
import FormView from "@/components/views/FormView"
import KanbanView from "@/components/views/KanbanView"
import GalleryView from "@/components/views/GalleryView"
import CalendarView from "@/components/views/CalendarView"
import TimelineView from "@/components/views/TimelineView"
import HorizontalGroupedView from "@/components/views/HorizontalGroupedView"
import DesignSidebar from "@/components/layout/DesignSidebar"
import UnifiedFilterDialog from "@/components/filters/UnifiedFilterDialog"
import SortDialog from "@/components/grid/SortDialog"
import HideFieldsDialog from "@/components/grid/HideFieldsDialog"
import CustomizeCardsDialog, { type CardConfig } from "@/components/grid/CustomizeCardsDialog"
import { supabase } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import type { ViewFilter, ViewSort } from "@/types/database"
import type { FilterType } from "@/types/database"
import { applyFiltersToQuery, type FilterConfig } from "@/lib/interface/filters"
import type { GroupRule } from "@/lib/grouping/types"
import { normalizeUuid } from "@/lib/utils/ids"

interface ViewSummary {
  id: string
  name: string
  type: string
}

interface ViewFieldRow {
  field_name: string
  visible: boolean
  position: number
}

interface NonGridViewWrapperProps {
  viewType: "form" | "kanban" | "gallery" | "calendar" | "timeline" | "horizontal_grouped"
  viewName: string
  tableId: string
  viewId: string
  views?: ViewSummary[]
  fieldIds: string[]
  groupingFieldId?: string
  groupByRules?: GroupRule[]
  dateFieldId?: string
  viewFilters?: ViewFilter[]
  viewSorts?: ViewSort[]
  viewFields?: ViewFieldRow[]
  tableFields?: TableField[]
  cardFields?: string[]
  cardImageField?: string
  cardColorField?: string
  cardWrapText?: boolean
}

export default function NonGridViewWrapper({
  viewType,
  viewName,
  tableId,
  viewId,
  views = [],
  fieldIds: fieldIdsProp,
  groupingFieldId,
  groupByRules,
  dateFieldId,
  viewFilters = [],
  viewSorts = [],
  viewFields: viewFieldsProp = [],
  tableFields: tableFieldsProp = [],
  cardFields: cardFieldsProp = [],
  cardImageField: cardImageFieldProp,
  cardColorField: cardColorFieldProp,
  cardWrapText: cardWrapTextProp = true,
}: NonGridViewWrapperProps) {
  const viewUuid = normalizeUuid(viewId)
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchQuery = searchParams.get("q") || ""
  const [designSidebarOpen, setDesignSidebarOpen] = useState(false)
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [sortDialogOpen, setSortDialogOpen] = useState(false)
  const [hideFieldsDialogOpen, setHideFieldsDialogOpen] = useState(false)
  const [tableInfo, setTableInfo] = useState<{ name: string; supabase_table: string } | null>(null)
  const [tableFields, setTableFields] = useState<TableField[]>(tableFieldsProp)
  const [filters, setFilters] = useState<ViewFilter[]>(viewFilters)
  const [sorts, setSorts] = useState<ViewSort[]>(viewSorts)
  const initialViewFields =
    viewFieldsProp.length > 0 ? viewFieldsProp : fieldIdsProp.map((name, i) => ({ field_name: name, visible: true, position: i }))
  const [viewFields, setViewFields] = useState<ViewFieldRow[]>(initialViewFields)
  const [hiddenFields, setHiddenFields] = useState<string[]>(
    initialViewFields.filter((f) => !f.visible).map((f) => f.field_name)
  )
  const [cardFields, setCardFields] = useState<string[]>(cardFieldsProp)
  const [cardImageField, setCardImageField] = useState<string>(cardImageFieldProp || "")
  const [cardColorField, setCardColorField] = useState<string>(cardColorFieldProp || "")
  const [cardWrapText, setCardWrapText] = useState(cardWrapTextProp ?? true)
  const [customizeCardsDialogOpen, setCustomizeCardsDialogOpen] = useState(false)

  const fieldIds = useMemo(() => {
    const tableFieldNames = new Set(tableFields.map((f) => f.name))
    if (viewFields.length > 0) {
      const visible = viewFields
        .sort((a, b) => a.position - b.position)
        .filter((vf) => !hiddenFields.includes(vf.field_name))
        .map((vf) => vf.field_name)
      if ((viewType === "kanban" || viewType === "gallery") && cardFields.length > 0) {
        const ordered = cardFields.filter((n) => visible.includes(n) && tableFieldNames.has(n))
        return ordered.length > 0 ? ordered : visible
      }
      return visible
    }
    if ((viewType === "kanban" || viewType === "gallery") && cardFields.length > 0) {
      return cardFields.filter((n) => tableFieldNames.has(n))
    }
    return Array.isArray(fieldIdsProp) ? fieldIdsProp : []
  }, [viewFields, hiddenFields, fieldIdsProp, viewType, cardFields, tableFields])

  useEffect(() => {
    async function loadTableInfo() {
      try {
        const { data, error } = await supabase
          .from("tables")
          .select("name, supabase_table")
          .eq("id", tableId)
          .single()

        if (!error && data) {
          setTableInfo(data)
        }
      } catch (error) {
        console.error("Error loading table info:", error)
      }
    }
    loadTableInfo()
  }, [tableId])

  // Load table fields (only if not provided as prop)
  useEffect(() => {
    if (tableFieldsProp.length > 0) {
      setTableFields(tableFieldsProp)
      return
    }

    async function loadFields() {
      try {
        const response = await fetch(`/api/tables/${tableId}/fields`)
        const data = await response.json()
        if (data.fields) {
          setTableFields(data.fields)
        }
      } catch (error) {
        console.error("Error loading fields:", error)
      }
    }
    loadFields()
  }, [tableId, tableFieldsProp])

  useEffect(() => {
    setFilters(viewFilters)
    setSorts(viewSorts)
  }, [viewFilters, viewSorts])

  useEffect(() => {
    if (viewFieldsProp.length > 0) {
      setViewFields(viewFieldsProp)
      setHiddenFields(viewFieldsProp.filter((f) => !f.visible).map((f) => f.field_name))
    }
  }, [viewFieldsProp])

  useEffect(() => {
    setCardFields(cardFieldsProp)
  }, [cardFieldsProp])

  useEffect(() => {
    setCardImageField(cardImageFieldProp || "")
    setCardColorField(cardColorFieldProp || "")
    setCardWrapText(cardWrapTextProp ?? true)
  }, [cardImageFieldProp, cardColorFieldProp, cardWrapTextProp])

  const filtersAsConfig: FilterConfig[] = useMemo(
    () =>
      filters.map((f) => ({
        field: f.field_name,
        operator: f.operator as FilterConfig["operator"],
        value: f.value,
      })),
    [filters]
  )

  async function loadViewFields() {
    if (!viewUuid) return
    try {
      const { data } = await supabase
        .from("view_fields")
        .select("field_name, visible, position")
        .eq("view_id", viewUuid)
        .order("position", { ascending: true })
      if (data) setViewFields(data as ViewFieldRow[])
    } catch (error) {
      console.error("Error loading view fields:", error)
    }
  }


  async function handleNewRecord() {
    if (!tableInfo) return
    try {
      const { error } = await supabase
        .from(tableInfo.supabase_table)
        .insert([{ created_at: new Date().toISOString() }])

      if (error) {
        console.error("Error creating record:", error)
        const message = (error as any)?.message || 'Unknown error'
        const code = (error as any)?.code ? ` (code: ${(error as any).code})` : ''
        alert(`Failed to create record${code}: ${message}`)
      } else {
        router.refresh()
      }
    } catch (error) {
      console.error("Error creating record:", error)
      const e = error as any
      const message = e?.message || 'Unknown error'
      const code = e?.code ? ` (code: ${e.code})` : ''
      alert(`Failed to create record${code}: ${message}`)
    }
  }

  function handleFieldsUpdated() {
    router.refresh()
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <ViewTopBar
        viewName={viewName}
        viewType={viewType}
        viewId={viewId}
        tableId={tableId}
        views={views}
        tableFields={tableFields}
        onCustomizeCards={() => setCustomizeCardsDialogOpen(true)}
        onSearch={() => {}} // Handled via URL params
        onFilter={() => setFilterDialogOpen(true)}
        onSort={() => setSortDialogOpen(true)}
        onHideFields={() => setHideFieldsDialogOpen(true)}
        onDesign={() => setDesignSidebarOpen(true)}
        onAddField={() => setDesignSidebarOpen(true)}
        onNewRecord={handleNewRecord}
      />
      <div className="flex-1 overflow-hidden">
        {viewType === "form" && (
          <FormView
            tableId={tableId}
            viewId={viewId}
            fieldIds={fieldIds}
          />
        )}
        {viewType === "kanban" && (
          <KanbanView
            tableId={tableId}
            viewId={viewId}
            groupingFieldId={groupingFieldId || fieldIds[0] || ""}
            fieldIds={fieldIds}
            searchQuery={searchQuery}
            tableFields={tableFields}
            filters={filtersAsConfig}
            imageField={cardImageField || undefined}
            colorField={cardColorField || undefined}
            wrapText={cardWrapText}
          />
        )}
        {viewType === "gallery" && (
          <GalleryView
            tableId={tableId}
            viewId={viewId}
            fieldIds={fieldIds}
            searchQuery={searchQuery}
            tableFields={tableFields}
            filters={filtersAsConfig}
            imageField={cardImageField || undefined}
            colorField={cardColorField || undefined}
            defaultGroupsCollapsed={false}
            blockConfig={{
              gallery_group_by: groupingFieldId || undefined,
              group_by_rules: groupByRules || undefined,
            }}
          />
        )}
        {viewType === "calendar" && (
          <CalendarView
            tableId={tableId}
            viewId={viewId}
            dateFieldId={dateFieldId || fieldIds[0] || ""}
            fieldIds={fieldIds}
            searchQuery={searchQuery}
            tableFields={tableFields}
            filters={filtersAsConfig}
          />
        )}
        {viewType === "timeline" && (
          <TimelineView
            tableId={tableId}
            viewId={viewId}
            dateFieldId={dateFieldId || fieldIds[0] || ""}
            fieldIds={fieldIds}
            searchQuery={searchQuery}
            tableFields={tableFields}
            filters={filtersAsConfig}
          />
        )}
        {viewType === "horizontal_grouped" && tableInfo && (
          <HorizontalGroupedView
            tableId={tableId}
            viewId={viewId}
            supabaseTableName={tableInfo.supabase_table}
            tableFields={tableFields}
            filters={filters.map((f) => ({
              field: f.field_name,
              operator: f.operator as FilterConfig["operator"],
              value: f.value,
            }))}
            sorts={sorts.map((s) => ({
              field_name: s.field_name,
              direction: s.direction as "asc" | "desc",
            }))}
            groupBy={groupingFieldId}
            groupByRules={groupByRules}
            searchQuery={searchQuery}
          />
        )}
      </div>
      {tableInfo && (
        <DesignSidebar
          isOpen={designSidebarOpen}
          onClose={() => setDesignSidebarOpen(false)}
          tableId={tableId}
          tableName={tableInfo.name}
          supabaseTableName={tableInfo.supabase_table}
          onFieldsUpdated={handleFieldsUpdated}
          hideViewsTab={true}
        />
      )}

      <UnifiedFilterDialog
        isOpen={filterDialogOpen}
        onClose={() => setFilterDialogOpen(false)}
        viewId={viewId}
        tableFields={tableFields}
        filters={filters.map((f) => ({
          id: f.id ?? "",
          field_name: f.field_name,
          operator: f.operator as FilterType,
          value: f.value,
        }))}
        onFiltersChange={(newFilters) => {
          setFilters(
            newFilters.map((f) => ({
              id: f.id ?? f.field_name,
              view_id: viewId,
              field_name: f.field_name,
              operator: f.operator,
              value: f.value,
            })) as ViewFilter[]
          )
          router.refresh()
        }}
      />
      <SortDialog
        isOpen={sortDialogOpen}
        onClose={() => setSortDialogOpen(false)}
        viewId={viewId}
        tableFields={tableFields}
        sorts={sorts.map((s) => ({
          id: s.id ?? s.field_name,
          field_name: s.field_name,
          direction: s.direction,
        }))}
        onSortsChange={(newSorts) => {
          setSorts(
            newSorts.map((s) => ({
              id: s.id ?? s.field_name,
              view_id: viewId,
              field_name: s.field_name,
              direction: s.direction,
            })) as ViewSort[]
          )
          router.refresh()
        }}
      />
      {(viewType === "kanban" || viewType === "gallery") && (
        <CustomizeCardsDialog
          isOpen={customizeCardsDialogOpen}
          onClose={() => setCustomizeCardsDialogOpen(false)}
          viewId={viewId}
          tableId={tableId}
          tableFields={tableFields}
          viewFields={viewFields}
          config={{
            cardFields,
            cardImageField: cardImageField || undefined,
            cardColorField: cardColorField || undefined,
            cardWrapText: cardWrapText,
            groupBy: groupingFieldId || undefined,
          }}
          onConfigChange={(next) => {
            setCardFields(next.cardFields)
            setCardImageField(next.cardImageField || "")
            setCardColorField(next.cardColorField || "")
            setCardWrapText(next.cardWrapText ?? true)
            router.refresh()
          }}
        />
      )}
      <HideFieldsDialog
        isOpen={hideFieldsDialogOpen}
        onClose={() => setHideFieldsDialogOpen(false)}
        viewId={viewId}
        tableFields={tableFields}
        viewFields={viewFields}
        hiddenFields={hiddenFields}
        onHiddenFieldsChange={(fields) => {
          setHiddenFields(fields)
          router.refresh()
        }}
        onReorder={async (fieldNames) => {
          if (!viewUuid) return
          try {
            await Promise.all(
              fieldNames.map((fieldName, index) =>
                supabase
                  .from("view_fields")
                  .update({ position: index })
                  .eq("view_id", viewUuid)
                  .eq("field_name", fieldName)
              )
            )
            await loadViewFields()
          } catch (error) {
            console.error("Error reordering fields:", error)
          }
          router.refresh()
        }}
      />
    </div>
  )
}
