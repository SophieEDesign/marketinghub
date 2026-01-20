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
      
      // Load filter groups
      const { data: groups, error: groupsError } = await supabase
        .from("view_filter_groups")
        .select("*")
        .eq("view_id", viewUuid)
        .order("order_index", { ascending: true })

      if (groupsError) throw groupsError

      // Load all filters
      const { data: allFilters, error: filtersError } = await supabase
        .from("view_filters")
        .select("*")
        .eq("view_id", viewUuid)
        .order("order_index", { ascending: true })

      if (filtersError) throw filtersError

      // Convert to canonical filter tree
      const tree = dbFiltersToFilterTree(allFilters || [], groups || [])
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

      // Delete existing filter groups and filters
      await supabase.from("view_filters").delete().eq("view_id", viewUuid)
      await supabase.from("view_filter_groups").delete().eq("view_id", viewUuid)

      // Convert filter tree to database format
      const { groups, filters: dbFilters } = filterTreeToDbFormat(filterTree, viewUuid)

      // Insert filter groups first
      let insertedGroupIds: string[] = []
      if (groups.length > 0) {
        const { data: insertedGroups, error: groupsError } = await supabase
          .from("view_filter_groups")
          .insert(groups)
          .select("id")

        if (groupsError) throw groupsError
        insertedGroupIds = insertedGroups?.map((g) => g.id) || []
      }

      // Map filters to groups using temp indices
      const filtersToInsert = dbFilters.map((filter) => {
        // If filter has a temp group ID (temp-0, temp-1, etc.), map it to actual group ID
        if (filter.filter_group_id && typeof filter.filter_group_id === 'string' && filter.filter_group_id.startsWith('temp-')) {
          const tempIndex = parseInt(filter.filter_group_id.replace('temp-', ''), 10)
          const actualGroupId = insertedGroupIds[tempIndex] || null
          return {
            ...filter,
            filter_group_id: actualGroupId,
          }
        }
        return filter
      })

      // Insert all filters
      if (filtersToInsert.length > 0) {
        const { error: filtersError } = await supabase
          .from("view_filters")
          .insert(filtersToInsert)

        if (filtersError) throw filtersError
      }

      // Notify parent component (flattened for backward compatibility)
      // Note: filtersToInsert doesn't have id yet (it's Omit<ViewFilter, "id">)
      // We need to reload filters to get the actual IDs
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
