"use client"

import { useState, useEffect } from "react"
import { Filter } from "lucide-react"
import { Label } from "@/components/ui/label"
import type { BlockFilter } from "@/lib/interface/types"
import type { TableField } from "@/types/database"
import FilterBuilder from "@/components/filters/FilterBuilder"
import type { FilterTree } from "@/lib/filters/canonical-model"
import { conditionsToFilterTree } from "@/lib/filters/canonical-model"
import { flattenFilterTree } from "@/lib/filters/canonical-model"

interface BlockFilterEditorProps {
  filters: BlockFilter[]
  tableFields: TableField[]
  onChange: (filters: BlockFilter[]) => void
}

/**
 * Block Filter Editor
 * 
 * Uses the unified FilterBuilder component for consistent filter editing
 * across all block types. Converts between BlockFilter[] and FilterTree.
 */
export default function BlockFilterEditor({
  filters = [],
  tableFields,
  onChange,
}: BlockFilterEditorProps) {
  // Convert BlockFilter[] to FilterTree for FilterBuilder
  const [filterTree, setFilterTree] = useState<FilterTree>(null)

  useEffect(() => {
    if (filters.length === 0) {
      setFilterTree(null)
      return
    }

    // Convert BlockFilter[] to FilterCondition[] format
    const conditions = filters.map(f => ({
      field_id: f.field,
      operator: f.operator as any, // BlockFilter operators may be subset of FilterOperator
      value: f.value,
    }))

    // Convert to FilterTree (all conditions combined with AND)
    const tree = conditionsToFilterTree(conditions, 'AND')
    setFilterTree(tree)
  }, [filters])

  // Handle filter tree changes from FilterBuilder
  const handleFilterTreeChange = (newTree: FilterTree) => {
    setFilterTree(newTree)

    // Convert FilterTree back to BlockFilter[]
    if (!newTree) {
      onChange([])
      return
    }

    // Flatten tree to get all conditions
    const conditions = flattenFilterTree(newTree)
    
    // Convert to BlockFilter[]
    const blockFilters: BlockFilter[] = conditions.map(c => ({
      field: c.field_id,
      operator: c.operator as BlockFilter['operator'], // May need to filter valid operators
      value: c.value,
    }))

    onChange(blockFilters)
  }

  const filterCount = filters.length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <Label className="text-sm font-medium">Filters (optional)</Label>
          {filterCount > 0 && (
            <span className="text-xs text-gray-500">
              {filterCount} filter{filterCount !== 1 ? "s" : ""} applied
            </span>
          )}
        </div>
      </div>

      <div className="border rounded-lg p-3 bg-gray-50">
        <FilterBuilder
          filterTree={filterTree}
          tableFields={tableFields}
          onChange={handleFilterTreeChange}
          allowGroups={false}
          allowOr={false}
        />
      </div>

      {filterCount === 0 && (
        <p className="text-xs text-gray-500">
          No filters applied. Add filters to narrow the data used for this block.
        </p>
      )}
    </div>
  )
}
