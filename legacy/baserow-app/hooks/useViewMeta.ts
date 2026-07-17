"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { ViewField, ViewFilter, ViewSort } from "@/types/database"
import { VIEWS_ENABLED } from "@/lib/featureFlags"
import { normalizeUuid } from "@/lib/utils/ids"

export interface ViewMetadata {
  fields: ViewField[]
  filters: ViewFilter[]
  sorts: ViewSort[]
}

// Global cache to prevent duplicate requests across components
const metadataCache = new Map<string, {
  data: ViewMetadata | null
  promise: Promise<ViewMetadata> | null
  timestamp: number
}>()

// Track in-flight requests for dev-only warnings
const inFlightRequests = new Set<string>()

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function useViewMeta(viewId: string | null | undefined, tableId: string | null | undefined) {
  const [metadata, setMetadata] = useState<ViewMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  // Use refs to prevent re-renders from triggering reloads
  const metadataRef = useRef<ViewMetadata | null>(null)
  const loadingRef = useRef(false)
  const viewIdRef = useRef<string | null | undefined>(null)
  const tableIdRef = useRef<string | null | undefined>(null)

  useEffect(() => {
    // Global rule: views are currently disabled unless explicitly enabled.
    // Treat any viewId/tableId as "no view metadata" in this mode.
    if (!VIEWS_ENABLED) {
      setMetadata(null)
      setLoading(false)
      setError(null)
      return
    }

    const viewUuid = normalizeUuid(viewId)
    const tableUuid = normalizeUuid(tableId)

    // Skip if no (valid) viewId or tableId
    if (!viewUuid || !tableUuid) {
      if (metadataRef.current) {
        // Keep existing metadata if viewId/tableId cleared
        return
      }
      setMetadata(null)
      setLoading(false)
      return
    }

    // Skip if already loading the same view
    if (loadingRef.current && viewIdRef.current === viewUuid && tableIdRef.current === tableUuid) {
      return
    }

    // Check cache first
    const cacheKey = `${tableUuid}:${viewUuid}`
    const cached = metadataCache.get(cacheKey)
    
    if (cached?.data && Date.now() - cached.timestamp < CACHE_TTL) {
      // Use cached data
      metadataRef.current = cached.data
      setMetadata(cached.data)
      setLoading(false)
      setError(null)
      viewIdRef.current = viewUuid
      tableIdRef.current = tableUuid
      return
    }

    // If there's an in-flight promise, wait for it
    if (cached?.promise) {
      // 🧯 Guardrail 1: Dev-only warning for parallel metadata loads
      if (process.env.NODE_ENV === 'development') {
        if (inFlightRequests.has(cacheKey)) {
          console.warn('[useViewMeta] Deduplicated concurrent request:', cacheKey)
        }
      }
      
      loadingRef.current = true
      setLoading(true)
      cached.promise
        .then((data) => {
          metadataRef.current = data
          setMetadata(data)
          setLoading(false)
          setError(null)
          loadingRef.current = false
        })
        .catch((err) => {
          setError(err)
          setLoading(false)
          loadingRef.current = false
        })
      return
    }

    // Load metadata (SERIALIZED - no parallel requests)
    loadingRef.current = true
    viewIdRef.current = viewUuid
    tableIdRef.current = tableUuid
    setLoading(true)
    setError(null)

    const loadMetadata = async (): Promise<ViewMetadata> => {
      const supabase = createClient()

      // CRITICAL: Serialize requests to avoid connection exhaustion
      // Load fields first
      const { data: fields, error: fieldsError } = await supabase
        .from("view_fields")
        .select("*")
        .eq("view_id", viewUuid)
        .order("position", { ascending: true })

      if (fieldsError && fieldsError.code !== 'PGRST116' && fieldsError.code !== '42P01') {
        console.warn("Error loading view fields:", fieldsError)
      }

      // Then load filters
      const { data: filters, error: filtersError } = await supabase
        .from("view_filters")
        .select("*")
        .eq("view_id", viewUuid)

      if (filtersError && filtersError.code !== 'PGRST116' && filtersError.code !== '42P01') {
        console.warn("Error loading view filters:", filtersError)
      }

      // Finally load sorts
      const { data: sorts, error: sortsError } = await supabase
        .from("view_sorts")
        .select("*")
        .eq("view_id", viewUuid)

      if (sortsError) {
        // Handle different error cases
        if (sortsError.code === 'PGRST116' || sortsError.code === '42P01') {
          // Table doesn't exist or no rows - return empty array
        } else if (sortsError.code === '42703' || sortsError.message?.includes('order_index')) {
          // If order_index column doesn't exist, try without ordering
          const { data: sortsWithoutOrder } = await supabase
            .from("view_sorts")
            .select("*")
            .eq("view_id", viewUuid)
          
          if (sortsWithoutOrder) {
            return {
              fields: (fields || []) as ViewField[],
              filters: (filters || []) as ViewFilter[],
              sorts: (sortsWithoutOrder || []) as ViewSort[],
            }
          }
        } else {
          console.warn("Error loading view sorts:", sortsError)
        }
      }

      // Sort client-side if order_index exists
      let sortedSorts = (sorts || []) as ViewSort[]
      if (sortedSorts.length > 0 && 'order_index' in sortedSorts[0]) {
        sortedSorts = [...sortedSorts].sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
      }

      return {
        fields: (fields || []) as ViewField[],
        filters: (filters || []) as ViewFilter[],
        sorts: sortedSorts,
      }
    }

    // Store promise in cache to prevent duplicate requests
    inFlightRequests.add(cacheKey)
    const promise = loadMetadata()
    metadataCache.set(cacheKey, {
      data: null,
      promise,
      timestamp: Date.now(),
    })

    promise
      .then((data) => {
        // Update cache with data
        inFlightRequests.delete(cacheKey)
        metadataCache.set(cacheKey, {
          data,
          promise: null,
          timestamp: Date.now(),
        })
        metadataRef.current = data
        setMetadata(data)
        setLoading(false)
        setError(null)
        loadingRef.current = false
      })
      .catch((err) => {
        // Remove failed promise from cache
        inFlightRequests.delete(cacheKey)
        metadataCache.delete(cacheKey)
        setError(err)
        setLoading(false)
        loadingRef.current = false
        
        // CRITICAL: Do NOT retry automatically on network failure
        // If we have cached metadata, keep using it
        if (metadataRef.current) {
          setMetadata(metadataRef.current)
          setLoading(false)
        }
      })
  }, [viewId, tableId])

  // Return cached metadata if available, even if loading
  return {
    metadata: metadataRef.current || metadata,
    loading,
    error,
  }
}

// Helper to clear cache (useful when metadata is updated)
export function clearViewMetaCache(viewId?: string, tableId?: string) {
  if (viewId && tableId) {
    metadataCache.delete(`${tableId}:${viewId}`)
  } else {
    metadataCache.clear()
  }
}

