"use client"

import { useState, useEffect } from "react"
import { Filter } from "lucide-react"
import { Label } from "@/components/ui/label"
import type { BlockFilter } from "@/lib/interface/types"
import type { TableField } from "@/types/database"
import FilterBuilder from "@/components/filters/FilterBuilder"
import type { FilterTree } from "@/lib/filters/canonical-model"
import { conditionsToFilterTree, normalizeFilterTree } from "@/lib/filters/canonical-model"
import { flattenFilterTree } from "@/lib/filters/canonical-model"
import type { BlockConfig } from "@/lib/interface/types"

interface BlockFilterEditorProps {
  filters: BlockFilter[]
  tableFields: TableField[]
  onChange: (filters: BlockFilter[]) => void
  config?: BlockConfig // Optional config to read filter_tree from
  onConfigUpdate?: (updates: Partial<BlockConfig>) => void // Optional callback to update config with filter_tree
}

/**
 * Block Filter Editor
 * 
 * Uses the unified FilterBuilder component for consistent filter editing
 * across all block types. Supports both flat filters and filter trees with groups.
 * 
 * When onConfigUpdate is provided, stores filter_tree in config (preferred).
 * Always maintains backward compatibility with flat filters array.
 */
export default function BlockFilterEditor({
  filters = [],
  tableFields,
  onChange,
  config,
  onConfigUpdate,
}: BlockFilterEditorProps) {
  // Convert BlockFilter[] or filter_tree to FilterTree for FilterBuilder
  const [filterTree, setFilterTree] = useState<FilterTree>(null)

  useEffect(() => {
    // Prefer filter_tree from config if available, otherwise convert from flat filters
    const configFilterTree = (config as any)?.filter_tree as FilterTree | undefined
    
    if (configFilterTree) {
      // Use filter_tree from config (supports groups)
      setFilterTree(normalizeFilterTree(configFilterTree))
      return
    }

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
  }, [filters, config])

  // Handle filter tree changes from FilterBuilder
  const handleFilterTreeChange = (newTree: FilterTree) => {
    setFilterTree(newTree)

    // Normalize the tree
    const normalized = normalizeFilterTree(newTree)

    // If onConfigUpdate is provided, store filter_tree in config (preferred method)
    if (onConfigUpdate) {
      const flatForLegacy = normalized ? flattenFilterTree(normalized) : []
      onConfigUpdate({
        filter_tree: normalized,
        // Keep legacy filters for backward compatibility (AND-only semantics)
        // NOTE: OR is not representable in the legacy flat list, so consumers must prefer filter_tree
        filters: flatForLegacy.map(c => ({
          field: c.field_id,
          operator: c.operator as any,
          value: c.value,
        })),
      })
    }

    // Always update flat filters for backward compatibility
    if (!normalized) {
      onChange([])
      return
    }

    // Flatten tree to get all conditions
    const conditions = flattenFilterTree(normalized)
    
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
          allowGroups={true}
          allowOr={true}
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
