"use client"

/**
 * Filter State Context
 * Manages filter block state across a page
 * Allows multiple filter blocks to emit filters that affect target blocks
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { FilterConfig } from './filters'

interface FilterBlockState {
  blockId: string
  filters: FilterConfig[]
  targetBlocks: string[] | 'all'
}

interface FilterStateContextValue {
  // Get filters for a specific block (from all filter blocks that target it)
  getFiltersForBlock: (blockId: string) => FilterConfig[]
  // Update filter block state
  updateFilterBlock: (blockId: string, filters: FilterConfig[], targetBlocks: string[] | 'all') => void
  // Remove filter block state
  removeFilterBlock: (blockId: string) => void
  // Get all filter blocks
  getAllFilterBlocks: () => FilterBlockState[]
}

const FilterStateContext = createContext<FilterStateContextValue | null>(null)

export function FilterStateProvider({ children }: { children: ReactNode }) {
  const [filterBlocks, setFilterBlocks] = useState<Map<string, FilterBlockState>>(new Map())

  const getFiltersForBlock = useCallback((blockId: string): FilterConfig[] => {
    const filters: FilterConfig[] = []
    
    // Collect filters from all filter blocks that target this block
    for (const [filterBlockId, state] of filterBlocks.entries()) {
      if (state.targetBlocks === 'all' || state.targetBlocks.includes(blockId)) {
        // Merge filters (avoid duplicates by field)
        for (const filter of state.filters) {
          const existingIndex = filters.findIndex(f => f.field === filter.field)
          if (existingIndex >= 0) {
            // If multiple filter blocks target same field, last one wins
            filters[existingIndex] = filter
          } else {
            filters.push(filter)
          }
        }
      }
    }
    
    return filters
  }, [filterBlocks])

  const updateFilterBlock = useCallback((
    blockId: string,
    filters: FilterConfig[],
    targetBlocks: string[] | 'all'
  ) => {
    setFilterBlocks(prev => {
      const next = new Map(prev)
      next.set(blockId, { blockId, filters, targetBlocks })
      return next
    })
  }, [])

  const removeFilterBlock = useCallback((blockId: string) => {
    setFilterBlocks(prev => {
      const next = new Map(prev)
      next.delete(blockId)
      return next
    })
  }, [])

  const getAllFilterBlocks = useCallback(() => {
    return Array.from(filterBlocks.values())
  }, [filterBlocks])

  return (
    <FilterStateContext.Provider
      value={{
        getFiltersForBlock,
        updateFilterBlock,
        removeFilterBlock,
        getAllFilterBlocks,
      }}
    >
      {children}
    </FilterStateContext.Provider>
  )
}

export function useFilterState() {
  const context = useContext(FilterStateContext)
  if (!context) {
    throw new Error('useFilterState must be used within FilterStateProvider')
  }
  return context
}

