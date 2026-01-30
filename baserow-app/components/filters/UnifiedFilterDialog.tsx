"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import type { ViewFilterGroup, ViewFilter, FilterConditionType, FilterType } from "@/types/database"
import type { FilterTree } from "@/lib/filters/canonical-model"
import { dbFiltersToFilterTree, filterTreeToDbFormat } from "@/lib/filters/converters"
import FilterBuilder from "./FilterBuilder"
import { normalizeUuid } from "@/lib/utils/ids"

interface UnifiedFilterDialogProps {
  isOpen: boolean
  onClose: () => void
  viewId: string
  tableFields: TableField[]
  filters: Array<{
    id: string
    field_name: string
    operator: FilterType
    value?: string
    filter_group_id?: string | null
    order_index?: number
  }>
  onFiltersChange?: (filters: Array<{ id?: string; field_name: string; operator: FilterType; value?: string }>) => void
}

/**
 * Unified Filter Dialog
 * 
 * Uses the unified FilterBuilder component for consistent filter editing
 * across all block types and views.
 */
export default function UnifiedFilterDialog({
  isOpen,
  onClose,
  viewId,
  tableFields,
  filters,
  onFiltersChange,
}: UnifiedFilterDialogProps) {
  const viewUuid = normalizeUuid(viewId)
  const [filterTree, setFilterTree] = useState<FilterTree>(null)
  const [loading, setLoading] = useState(false)

  // Load filters and groups when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadFilters()
    }
  }, [isOpen, viewId])

  async function loadFilters() {
    try {
      setLoading(true)
      if (!viewUuid) {
        throw new Error("Invalid viewId (expected UUID).")
      }

      // Load filter groups (optional: table may not exist or RLS may return 500)
      let groups: ViewFilterGroup[] = []
      const { data: groupsData, error: groupsError } = await supabase
        .from("view_filter_groups")
        .select("*")
        .eq("view_id", viewUuid)
        .order("order_index", { ascending: true })

      if (!groupsError && groupsData) {
        groups = groupsData as ViewFilterGroup[]
      }
      // If view_filter_groups fails (500, missing table, etc.), continue with empty groups

      // Load all filters
      const { data: allFilters, error: filtersError } = await supabase
        .from("view_filters")
        .select("*")
        .eq("view_id", viewUuid)
        .order("order_index", { ascending: true })

      if (filtersError) throw filtersError

      // Convert to canonical filter tree
      const tree = dbFiltersToFilterTree(allFilters || [], groups)
      setFilterTree(tree)
    } catch (error) {
      console.error("Error loading filters:", error)
      // Fallback to empty tree
      setFilterTree(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      setLoading(true)
      if (!viewUuid) {
        alert("This view is not linked to a valid view ID, so filters can't be saved.")
        return
      }

      const { groups, filters: dbFilters } = filterTreeToDbFormat(filterTree, viewUuid)

      // Core Data views: save via API (allows filters except on "All Records" view)
      const apiRes = await fetch(`/api/views/${viewUuid}/filters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groups: groups.map((g) => ({
            view_id: g.view_id,
            condition_type: g.condition_type,
            order_index: g.order_index ?? 0,
          })),
          filters: dbFilters.map((f) => ({
            view_id: f.view_id,
            field_name: f.field_name,
            operator: f.operator,
            value: f.value,
            filter_group_id: f.filter_group_id ?? null,
            order_index: f.order_index ?? 0,
          })),
        }),
      })

      const apiJson = await apiRes.json().catch(() => ({}))
      if (apiRes.ok && apiJson.ok === true) {
        const flattenedFilters = (apiJson.filters || []).map((f: { id: string; field_name: string; operator: string; value?: string }) => ({
          id: f.id,
          field_name: f.field_name,
          operator: f.operator,
          value: f.value,
        }))
        onFiltersChange?.(flattenedFilters)
        onClose()
        return
      }
      if (apiRes.status === 400 && apiJson.error_code === "ALL_RECORDS_VIEW") {
        alert(apiJson.error || "Filters cannot be saved on the default All Records view. Create another view to save filters.")
        return
      }

      // Fallback: direct Supabase (e.g. interface views or when API not used)
      await supabase.from("view_filters").delete().eq("view_id", viewUuid)
      const { error: deleteGroupsErr } = await supabase
        .from("view_filter_groups")
        .delete()
        .eq("view_id", viewUuid)
      if (deleteGroupsErr) {
        // view_filter_groups table may not exist or RLS may fail; continue
      }

      let insertedGroupIds: string[] = []
      if (groups.length > 0) {
        const { data: insertedGroups, error: groupsError } = await supabase
          .from("view_filter_groups")
          .insert(groups)
          .select("id")
        if (!groupsError && insertedGroups) {
          insertedGroupIds = insertedGroups.map((g) => g.id)
        }
      }

      const filtersToInsert = dbFilters.map((filter) => {
        if (filter.filter_group_id && typeof filter.filter_group_id === "string" && filter.filter_group_id.startsWith("temp-")) {
          const tempIndex = parseInt(filter.filter_group_id.replace("temp-", ""), 10)
          const actualGroupId = insertedGroupIds[tempIndex] ?? null
          return { ...filter, filter_group_id: actualGroupId }
        }
        return filter
      })

      if (filtersToInsert.length > 0) {
        const { error: filtersError } = await supabase.from("view_filters").insert(filtersToInsert)
        if (filtersError) throw filtersError
      }

      const { data: insertedFilters } = await supabase
        .from("view_filters")
        .select("id, field_name, operator, value")
        .eq("view_id", viewUuid)
        .order("order_index", { ascending: true })
      const flattenedFilters = (insertedFilters || []).map((f) => ({
        id: f.id,
        field_name: f.field_name,
        operator: f.operator,
        value: f.value,
      }))
      onFiltersChange?.(flattenedFilters)
      onClose()
    } catch (error) {
      console.error("Error saving filters:", error)
      alert("Failed to save filters. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Filter Records</DialogTitle>
          <DialogDescription>
            Create filter groups with AND/OR logic to narrow down the records displayed.
            Filters behave consistently across all blocks and views.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <FilterBuilder
            filterTree={filterTree}
            tableFields={tableFields}
            onChange={setFilterTree}
            className="py-4"
          />
        )}

        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            Apply Filters
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
