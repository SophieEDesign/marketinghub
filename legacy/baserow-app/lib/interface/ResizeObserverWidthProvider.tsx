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
    const [width, setWidth] = useState<number>(0)

    useEffect(() => {
      const node = containerRef.current
      if (!node) return

      const updateWidth = () => {
        const measured = Math.floor(node.getBoundingClientRect().width)
        if (measured > 0) {
          setWidth((prev) => {
            if (prev === measured) return prev
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("app:layout-resize"))
            }
            return measured
          })
        }
      }

      // Initial measurement (after layout)
      updateWidth()

      const ro = new ResizeObserver(updateWidth)
      ro.observe(node)
      if (node.parentElement) {
        ro.observe(node.parentElement)
      }
      if (node.parentElement?.parentElement) {
        ro.observe(node.parentElement.parentElement)
      }
      window.addEventListener("resize", updateWidth)
      const rafId = requestAnimationFrame(updateWidth)

      return () => {
        window.removeEventListener("resize", updateWidth)
        cancelAnimationFrame(rafId)
        ro.disconnect()
      }
    }, [])

    return (
      <div
        ref={containerRef}
        className="w-full h-full min-w-0 min-h-0 max-w-full"
        style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
      >
        <ComposedComponent {...(props as P)} width={width} />
      </div>
    )
  }
}
