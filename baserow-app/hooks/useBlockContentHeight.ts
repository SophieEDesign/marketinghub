"use client"

import { useEffect, useRef, useCallback, useState } from "react"

interface UseBlockContentHeightOptions {
  /** Row height in pixels (from layoutSettings.rowHeight) */
  rowHeight: number
  /** Whether grouping is currently active */
  isGrouped?: boolean
  /** Whether autofit is enabled (default: true if isGrouped, false otherwise) */
  autofitEnabled?: boolean
  /** Maximum height in grid units (default: 50) */
  maxHeight?: number
  /** Callback when height changes (in grid units) */
  onHeightChange?: (height: number) => void
  /** Debounce delay in milliseconds (default: 100) */
  debounceMs?: number
  /** Whether manual resize is in progress (disables autofit) */
  isManuallyResizing?: boolean
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
  const { rowHeight, isGrouped, onHeightChange, debounceMs = 100, autofitEnabled, isManuallyResizing } = options
  const [height, setHeight] = useState<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const previousHeightRef = useRef<number>(0)
  const imageLoadListenersRef = useRef<Set<(event: Event) => void>>(new Set())

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

  const shouldAutofit = autofitEnabled ?? (isGrouped ?? false)

  useEffect(() => {
    if (!shouldAutofit || isManuallyResizing) {
      // Clear height when autofit is disabled
      setHeight(0)
      previousHeightRef.current = 0
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
    
    // Watch for images loading (they can change content height)
    if (ref.current) {
      const images = ref.current.querySelectorAll('img')
      images.forEach(img => {
        if (!img.complete) {
          const onLoad = () => {
            measureHeight()
            imageLoadListenersRef.current.delete(onLoad)
          }
          img.addEventListener('load', onLoad)
          imageLoadListenersRef.current.add(onLoad)
        }
      })
    }
    
    // Set up MutationObserver for DOM changes
    let mutationObserver: MutationObserver | null = null
    if (typeof MutationObserver !== 'undefined' && ref.current) {
      mutationObserver = new MutationObserver(() => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        timeoutRef.current = setTimeout(() => {
          measureHeight()
        }, debounceMs)
      })
      
      mutationObserver.observe(ref.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      })
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
      if (mutationObserver) {
        mutationObserver.disconnect()
        mutationObserver = null
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      // Clean up image load listeners
      imageLoadListenersRef.current.forEach((listener: (event: Event) => void) => {
        // Remove listeners if elements still exist
        const images = ref.current?.querySelectorAll('img')
        images?.forEach(img => {
          img.removeEventListener('load', listener)
        })
      })
      imageLoadListenersRef.current.clear()
    }
  }, [shouldAutofit, isManuallyResizing, measureHeight, debounceMs, ref])

  return height
}
