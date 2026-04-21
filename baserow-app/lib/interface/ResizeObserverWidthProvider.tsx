"use client"

/**
 * ResizeObserver-based WidthProvider for react-grid-layout.
 *
 * The default WidthProvider only listens to window resize events. When the sidebar
 * collapses/expands, the main content area width changes but the window does not
 * resize, so the grid layout keeps a stale width and the calendar (and other views)
 * appear compressed.
 *
 * This provider uses ResizeObserver to detect container size changes, ensuring
 * the grid layout updates when the sidebar state changes.
 */

import React, { useRef, useState, useEffect } from "react"
import type { ComponentType } from "react"

export default function withResizeObserverWidthProvider<P extends { width?: number }>(
  ComposedComponent: ComponentType<P>
): ComponentType<Omit<P, "width">> {
  return function ResizeObserverWidthProvider(props: Omit<P, "width">) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [width, setWidth] = useState<number | undefined>(undefined)

    useEffect(() => {
      const node = containerRef.current
      if (!node) return

      const updateWidth = () => {
        const w = node.offsetWidth
        if (w > 0) setWidth(w)
      }

      // Initial measurement (after layout)
      updateWidth()

      const ro = new ResizeObserver(updateWidth)
      ro.observe(node)

      return () => ro.disconnect()
    }, [])

    return (
      <div ref={containerRef} className="w-full h-full min-w-0 min-h-0" style={{ width: "100%" }}>
        {width !== undefined ? <ComposedComponent {...(props as P)} width={width} /> : null}
      </div>
    )
  }
}
