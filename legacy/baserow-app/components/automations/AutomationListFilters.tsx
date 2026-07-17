"use client"

import { useState, useEffect } from "react"
import { Filter, X } from "lucide-react"
import type { Automation } from "@/types/database"

interface AutomationListFiltersProps {
  automations: Automation[]
  onFilterChange: (filtered: Automation[]) => void
}

const CATEGORIES = [
  'Notifications',
  'Data Sync',
  'Maintenance',
  'Workflow',
  'Integrations',
  'Cleanup',
  'Other',
]

export default function AutomationListFilters({ automations, onFilterChange }: AutomationListFiltersProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Get all unique tags from automations
  const allTags = Array.from(
    new Set(
      automations
        .flatMap(a => a.tags || [])
        .filter(Boolean)
    )
  ).sort()

  // Apply filters
  const filtered = automations.filter((automation) => {
    // Category filter
    if (selectedCategory && automation.category !== selectedCategory) {
      return false
    }

    // Tag filter
    if (selectedTag && (!automation.tags || !automation.tags.includes(selectedTag))) {
      return false
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesName = automation.name.toLowerCase().includes(query)
      const matchesDescription = automation.description?.toLowerCase().includes(query) || false
      const matchesTags = automation.tags?.some(tag => tag.toLowerCase().includes(query)) || false
      
      if (!matchesName && !matchesDescription && !matchesTags) {
        return false
      }
    }

    return true
  })

  // Notify parent of filtered results
  useEffect(() => {
    if (onFilterChange) {
      onFilterChange(filtered)
    }
  }, [filtered, onFilterChange])

  function clearFilters() {
    setSelectedCategory(null)
    setSelectedTag(null)
    setSearchQuery("")
  }

  const hasActiveFilters = selectedCategory || selectedTag || searchQuery

  return (
    <div className="space-y-4">
      {/* Search */}
      <div>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search automations..."
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Category:</span>
          <select
            value={selectedCategory || ""}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Tag Filter */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Tag:</span>
            <select
              value={selectedTag || ""}
              onChange={(e) => setSelectedTag(e.target.value || null)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
        )}

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Clear filters
          </button>
        )}
      </div>

      {/* Results Count */}
      {hasActiveFilters && (
        <div className="text-sm text-gray-500">
          Showing {filtered.length} of {automations.length} automations
        </div>
      )}
    </div>
  )
}
