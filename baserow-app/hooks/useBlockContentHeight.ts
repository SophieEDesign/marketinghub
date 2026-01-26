"use client"

import { useEffect, useRef, useCallback, useState } from "react"

interface UseBlockContentHeightOptions {
  /** Row height in pixels (from layoutSettings.rowHeight) */
  rowHeight: number
  /** Whether grouping is currently active */
  isGrouped: boolean
  /** Callback when height changes (in grid units) */
  onHeightChange?: (height: number) => void
  /** Debounce delay in milliseconds (default: 100) */
  debounceMs?: number
}

/**
 * Hook to measure block content height and convert to grid units.
 * Only measures when grouping is active.
 * 
 * @param ref - React ref to the element to measure
 * @param options - Configuration options
 * @returns Current height in grid units
 */
export function useBlockContentHeight(
  ref: React.RefObject<HTMLElement>,
  options: UseBlockContentHeightOptions
): number {
  const { rowHeight, isGrouped, onHeightChange, debounceMs = 100 } = options
  const [height, setHeight] = useState<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)

  const measureHeight = useCallback(() => {
    if (!ref.current || !isGrouped) {
      return
    }

    const element = ref.current
    // Measure the actual scroll height of the content
    // Use scrollHeight to get full content height, including overflow
    const pixelHeight = element.scrollHeight || element.clientHeight || 0
    
    // Convert to grid units (round up to ensure content fits)
    const heightInGridUnits = Math.ceil(pixelHeight / rowHeight)
    
    // Minimum height of 2 grid units to prevent blocks from being too small
    const finalHeight = Math.max(heightInGridUnits, 2)
    
    setHeight(finalHeight)
    
    // Call callback if provided
    if (onHeightChange && finalHeight !== height) {
      onHeightChange(finalHeight)
    }
  }, [ref, isGrouped, rowHeight, onHeightChange, height])

  useEffect(() => {
    if (!isGrouped) {
      // Clear height when grouping is disabled
      setHeight(0)
      return
    }

    // Initial measurement
    measureHeight()

    // Set up ResizeObserver to watch for content size changes
    if (typeof ResizeObserver !== 'undefined' && ref.current) {
      observerRef.current = new ResizeObserver(() => {
        // Debounce measurements to avoid excessive updates
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        timeoutRef.current = setTimeout(() => {
          measureHeight()
        }, debounceMs)
      })

      observerRef.current.observe(ref.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [isGrouped, measureHeight, debounceMs, ref])

  return height
}
