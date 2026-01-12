"use client"

import { useEffect, useRef, useState, ReactNode } from "react"

interface LazyBlockWrapperProps {
  children: ReactNode
  /**
   * Whether to enable lazy loading
   * Set to false for blocks that should always render immediately
   */
  enabled?: boolean
  /**
   * Root margin for IntersectionObserver
   * Default: "100px" - starts loading 100px before block enters viewport
   */
  rootMargin?: string
  /**
   * Placeholder to show while block is not visible
   * If not provided, shows a minimal placeholder div
   */
  placeholder?: ReactNode
}

/**
 * LazyBlockWrapper - Delays mounting of heavy blocks until they're visible
 * 
 * Uses IntersectionObserver to detect when block enters viewport.
 * Only mounts children once visible to improve initial page load performance.
 * 
 * CRITICAL: This must be transparent to users - no flicker, no layout shift.
 * Blocks maintain their layout space even when not mounted.
 * 
 * Usage:
 * ```tsx
 * <LazyBlockWrapper>
 *   <TextBlock block={block} isEditing={isEditing} />
 * </LazyBlockWrapper>
 * ```
 */
export default function LazyBlockWrapper({
  children,
  enabled = true,
  rootMargin = "100px",
  placeholder,
}: LazyBlockWrapperProps) {
  const [isVisible, setIsVisible] = useState(!enabled) // If disabled, render immediately
  const [hasBeenVisible, setHasBeenVisible] = useState(!enabled) // Once visible, stay mounted
  const containerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    // If lazy loading is disabled, render immediately
    if (!enabled) {
      setIsVisible(true)
      setHasBeenVisible(true)
      return
    }

    // If already visible, no need to observe
    if (hasBeenVisible) {
      return
    }

    const container = containerRef.current
    if (!container) {
      return
    }

    // Create IntersectionObserver to detect when block enters viewport
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            setHasBeenVisible(true)
            // Disconnect observer once visible (block stays mounted)
            if (observerRef.current) {
              observerRef.current.disconnect()
              observerRef.current = null
            }
          }
        })
      },
      {
        rootMargin, // Start loading before block enters viewport
        threshold: 0.01, // Trigger as soon as any part is visible
      }
    )

    observerRef.current.observe(container)

    // Cleanup observer on unmount
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
    }
  }, [enabled, rootMargin, hasBeenVisible])

  // If visible or has been visible, render children
  // Once mounted, block stays mounted (no unmounting on scroll)
  if (isVisible || hasBeenVisible) {
    return <>{children}</>
  }

  // Show placeholder while not visible
  // CRITICAL: Placeholder must maintain same dimensions to prevent layout shift
  if (placeholder) {
    return <div ref={containerRef}>{placeholder}</div>
  }

  // Default minimal placeholder - maintains layout space
  // CRITICAL: Do NOT set minHeight - height must be DERIVED from content
  // minHeight causes gaps when blocks collapse - it persists after collapse
  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      // Removed minHeight - height must be derived from content, not fixed
      aria-hidden="true"
    />
  )
}
