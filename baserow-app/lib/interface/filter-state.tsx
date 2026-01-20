"use client"

/**
 * Filter State Context
 * Manages filter block state across a page
 * Allows multiple filter blocks to emit filters that affect target blocks
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { FilterConfig } from './filters'
import type { FilterTree } from '@/lib/filters/canonical-model'
import { andFilterTrees } from '@/lib/filters/canonical-model'
import { filterConfigsToFilterTree } from '@/lib/filters/converters'

interface FilterBlockState {
  blockId: string
  /**
   * Flat filters used for backward compatibility and lightweight consumers.
   * NOTE: This cannot represent grouped OR logic. Prefer `filterTree` when applying filters to queries.
   */
  filters: FilterConfig[]
  /**
   * Canonical filter tree emitted by filter blocks (supports groups + AND/OR).
   */
  filterTree?: FilterTree
  targetBlocks: string[] | 'all'
  /**
   * A stable signature of the emitted filter payload.
   * Used to avoid provider update loops when callers re-emit equivalent values.
   */
  signature?: string
}

// Extended filter config with source information
export interface FilterConfigWithSource extends FilterConfig {
  sourceBlockId?: string // ID of the filter block that applies this filter
  sourceBlockTitle?: string // Title of the filter block (for display)
}

interface FilterStateContextValue {
  // Get filters for a specific block (from all filter blocks that target it)
  getFiltersForBlock: (blockId: string) => FilterConfigWithSource[]
  // Get canonical filter tree for a specific block (from all filter blocks that target it)
  getFilterTreeForBlock: (blockId: string) => FilterTree
  // Get filter block info for a specific block ID
  getFilterBlockInfo: (blockId: string) => { blockId: string; title?: string } | null
  // Update filter block state
  updateFilterBlock: (
    blockId: string,
    filters: FilterConfig[],
    targetBlocks: string[] | 'all',
    blockTitle?: string,
    filterTree?: FilterTree
  ) => void
  // Remove filter block state
  removeFilterBlock: (blockId: string) => void
  // Get all filter blocks
  getAllFilterBlocks: () => FilterBlockState[]
}

const FilterStateContext = createContext<FilterStateContextValue | null>(null)

export function FilterStateProvider({ children }: { children: ReactNode }) {
  const [filterBlocks, setFilterBlocks] = useState<Map<string, FilterBlockState>>(new Map())
  const [filterBlockTitles, setFilterBlockTitles] = useState<Map<string, string>>(new Map())

  const computeSignature = useCallback((
    blockId: string,
    filters: FilterConfig[],
    targetBlocks: string[] | 'all',
    filterTree?: FilterTree
  ) => {
    // IMPORTANT: We assume caller maintains stable order; this is sufficient to detect "no-op" re-emits.
    // This is intentionally cheap and avoids deep-equality footguns.
    return JSON.stringify({ blockId, filters, targetBlocks, filterTree })
  }, [])

  const getFiltersForBlock = useCallback((blockId: string): FilterConfigWithSource[] => {
    const filters: FilterConfigWithSource[] = []
    
    // Collect filters from all filter blocks that target this block
    for (const [filterBlockId, state] of filterBlocks.entries()) {
      if (state.targetBlocks === 'all' || state.targetBlocks.includes(blockId)) {
        const blockTitle = filterBlockTitles.get(filterBlockId)
        // Merge filters (avoid duplicates by field)
        for (const filter of state.filters) {
          const existingIndex = filters.findIndex(f => f.field === filter.field)
          const filterWithSource: FilterConfigWithSource = {
            ...filter,
            sourceBlockId: filterBlockId,
            sourceBlockTitle: blockTitle,
          }
          if (existingIndex >= 0) {
            // If multiple filter blocks target same field, last one wins
            filters[existingIndex] = filterWithSource
          } else {
            filters.push(filterWithSource)
          }
        }
      }
    }
    
    return filters
  }, [filterBlocks, filterBlockTitles])

  const getFilterTreeForBlock = useCallback((blockId: string): FilterTree => {
    const trees: FilterTree[] = []

    for (const [, state] of filterBlocks.entries()) {
      if (state.targetBlocks === 'all' || state.targetBlocks.includes(blockId)) {
        const tree = state.filterTree ?? filterConfigsToFilterTree(state.filters || [], 'AND')
        if (tree) trees.push(tree)
      }
    }

    return andFilterTrees(trees)
  }, [filterBlocks])

  const getFilterBlockInfo = useCallback((blockId: string): { blockId: string; title?: string } | null => {
    const title = filterBlockTitles.get(blockId)
    if (!title && !filterBlocks.has(blockId)) return null
    return { blockId, title }
  }, [filterBlocks, filterBlockTitles])

  const updateFilterBlock = useCallback((
    blockId: string,
    filters: FilterConfig[],
    targetBlocks: string[] | 'all',
    blockTitle?: string,
    filterTree?: FilterTree
  ) => {
    const signature = computeSignature(blockId, filters, targetBlocks, filterTree)
    setFilterBlocks(prev => {
      const existing = prev.get(blockId)
      if (existing?.signature === signature) {
        return prev
      }
      const next = new Map(prev)
      next.set(blockId, { blockId, filters, targetBlocks, signature, filterTree })
      return next
    })
    if (blockTitle !== undefined) {
      setFilterBlockTitles(prev => {
        const current = prev.get(blockId)
        if ((current || '') === (blockTitle || '')) {
          return prev
        }
        const next = new Map(prev)
        if (blockTitle) {
          next.set(blockId, blockTitle)
        } else {
          next.delete(blockId)
        }
        return next
      })
    }
  }, [computeSignature])

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
        getFilterTreeForBlock,
        getFilterBlockInfo,
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

