"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Filter, ArrowUpDown, Group, X, Plus } from "lucide-react"
import FilterEditor from "./FilterEditor"
import SortEditor from "./SortEditor"
import GroupPicker from "./GroupPicker"

interface Filter {
  id?: string
  field_name: string
  operator: string
  value?: string
}

interface Sort {
  id?: string
  field_name: string
  direction: string
}

interface ToolbarProps {
  viewId: string
  fields: Array<{ field_name: string }>
  filters: Filter[]
  sorts: Sort[]
  groupBy?: string
  onSearchChange: (searchTerm: string) => void
  onFilterCreate: (filter: Omit<Filter, "id">) => Promise<void>
  onFilterDelete: (filterId: string) => Promise<void>
  onSortCreate: (sort: Omit<Sort, "id">) => Promise<void>
  onSortDelete: (sortId: string) => Promise<void>
  onGroupByChange: (fieldName: string | null) => Promise<void>
}

export default function Toolbar({
  viewId,
  fields,
  filters,
  sorts,
  groupBy,
  onSearchChange,
  onFilterCreate,
  onFilterDelete,
  onSortCreate,
  onSortDelete,
  onGroupByChange,
}: ToolbarProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [showFilterEditor, setShowFilterEditor] = useState(false)
  const [showSortEditor, setShowSortEditor] = useState(false)
  const [showGroupPicker, setShowGroupPicker] = useState(false)
  const [editingFilter, setEditingFilter] = useState<Filter | null>(null)
  const [editingSort, setEditingSort] = useState<Sort | null>(null)
  const filterEditorRef = useRef<HTMLDivElement>(null)
  const sortEditorRef = useRef<HTMLDivElement>(null)
  const groupPickerRef = useRef<HTMLDivElement>(null)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(searchTerm)
    }, 250)

    return () => clearTimeout(timer)
  }, [searchTerm, onSearchChange])

  // Close popovers on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        filterEditorRef.current &&
        !filterEditorRef.current.contains(event.target as Node)
      ) {
        setShowFilterEditor(false)
        setEditingFilter(null)
      }
      if (
        sortEditorRef.current &&
        !sortEditorRef.current.contains(event.target as Node)
      ) {
        setShowSortEditor(false)
        setEditingSort(null)
      }
      if (
        groupPickerRef.current &&
        !groupPickerRef.current.contains(event.target as Node)
      ) {
        setShowGroupPicker(false)
      }
    }

    if (showFilterEditor || showSortEditor || showGroupPicker) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showFilterEditor, showSortEditor, showGroupPicker])

  async function handleFilterSave(filter: Filter) {
    if (filter.id) {
      // Edit existing - for now we'll delete and recreate
      // In a real app, you'd have an update function
      await onFilterDelete(filter.id)
    }
    await onFilterCreate({
      field_name: filter.field_name,
      operator: filter.operator,
      value: filter.value,
    })
    setShowFilterEditor(false)
    setEditingFilter(null)
  }

  async function handleSortSave(sort: Sort) {
    if (sort.id) {
      await onSortDelete(sort.id)
    }
    await onSortCreate({
      field_name: sort.field_name,
      direction: sort.direction,
    })
    setShowSortEditor(false)
    setEditingSort(null)
  }

  function handleAddFilter() {
    setEditingFilter(null)
    setShowFilterEditor(true)
  }

  function handleEditFilter(filter: Filter) {
    setEditingFilter(filter)
    setShowFilterEditor(true)
  }

  function handleAddSort() {
    setEditingSort(null)
    setShowSortEditor(true)
  }

  function handleEditSort(sort: Sort) {
    setEditingSort(sort)
    setShowSortEditor(true)
  }

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search rows..."
            className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filters */}
        <div className="relative">
          <button
            onClick={handleAddFilter}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              filters.length > 0
                ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Filter className="h-4 w-4" />
            Filter
            {filters.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded">
                {filters.length}
              </span>
            )}
          </button>

          {showFilterEditor && (
            <div
              ref={filterEditorRef}
              className="absolute top-full left-0 mt-2 z-50"
            >
              <FilterEditor
                filter={editingFilter}
                fields={fields}
                onSave={handleFilterSave}
                onCancel={() => {
                  setShowFilterEditor(false)
                  setEditingFilter(null)
                }}
              />
            </div>
          )}

          {/* Active filters */}
          {filters.length > 0 && (
            <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[200px] z-40">
              <div className="space-y-1">
                {filters.map((filter, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded text-sm"
                  >
                    <span className="text-gray-700">
                      {filter.field_name} {filter.operator} {filter.value || ""}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditFilter(filter)}
                        className="p-1 hover:bg-gray-200 rounded text-gray-600"
                        title="Edit filter"
                      >
                        <Plus className="h-3 w-3 rotate-45" />
                      </button>
                      <button
                        onClick={() => filter.id && onFilterDelete(filter.id)}
                        className="p-1 hover:bg-red-100 rounded text-red-600"
                        title="Remove filter"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sorts */}
        <div className="relative">
          <button
            onClick={handleAddSort}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              sorts.length > 0
                ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <ArrowUpDown className="h-4 w-4" />
            Sort
            {sorts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded">
                {sorts.length}
              </span>
            )}
          </button>

          {showSortEditor && (
            <div
              ref={sortEditorRef}
              className="absolute top-full left-0 mt-2 z-50"
            >
              <SortEditor
                sort={editingSort}
                fields={fields}
                onSave={handleSortSave}
                onCancel={() => {
                  setShowSortEditor(false)
                  setEditingSort(null)
                }}
              />
            </div>
          )}

          {/* Active sorts */}
          {sorts.length > 0 && (
            <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[200px] z-40">
              <div className="space-y-1">
                {sorts.map((sort, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded text-sm"
                  >
                    <span className="text-gray-700">
                      {sort.field_name} ({sort.direction})
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditSort(sort)}
                        className="p-1 hover:bg-gray-200 rounded text-gray-600"
                        title="Edit sort"
                      >
                        <Plus className="h-3 w-3 rotate-45" />
                      </button>
                      <button
                        onClick={() => sort.id && onSortDelete(sort.id)}
                        className="p-1 hover:bg-red-100 rounded text-red-600"
                        title="Remove sort"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Group By */}
        <div className="relative">
          <button
            onClick={() => setShowGroupPicker(true)}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              groupBy
                ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Group className="h-4 w-4" />
            Group
            {groupBy && (
              <span className="ml-1 text-xs text-blue-600">({groupBy})</span>
            )}
          </button>

          {showGroupPicker && (
            <div
              ref={groupPickerRef}
              className="absolute top-full right-0 mt-2 z-50"
            >
              <GroupPicker
                fields={fields}
                currentGroupBy={groupBy}
                onSelect={async (fieldName) => {
                  await onGroupByChange(fieldName)
                  setShowGroupPicker(false)
                }}
                onCancel={() => setShowGroupPicker(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
