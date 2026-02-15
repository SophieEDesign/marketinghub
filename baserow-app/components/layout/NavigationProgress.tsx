"use client"

import { useState, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

/**
 * Shows a thin progress bar at the top of the viewport when the user
 * navigates (clicks an internal link). Hides when the new page has loaded.
 * Gives clear feedback that a page transfer is in progress.
 */
export default function NavigationProgress() {
  const pathname = usePathname()
  const [isNavigating, setIsNavigating] = useState(false)
  const prevPathnameRef = useRef(pathname)

  // Detect internal link clicks and show progress
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      // #region agent log
      console.log("Message/click handler triggered [NavigationProgress]")
      // #endregion
      const target = e.target as HTMLElement
      const anchor = target.closest('a[href^="/"]')
      if (!anchor || (anchor as HTMLAnchorElement).target === "_blank") return
      const href = (anchor as HTMLAnchorElement).href
      if (href && typeof window !== "undefined" && href.startsWith(window.location.origin)) {
        setIsNavigating(true)
      }
    }
    document.addEventListener("click", handleClick, true)
    return () => document.removeEventListener("click", handleClick, true)
  }, [])

  // Hide progress when pathname has changed (new page loaded)
  useEffect(() => {
    if (pathname !== prevPathnameRef.current) {
      prevPathnameRef.current = pathname
      setIsNavigating(false)
    }
  }, [pathname])

  if (!isNavigating) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] h-1 bg-primary/20 overflow-hidden"
      role="progressbar"
      aria-label="Page loading"
    >
      <div className="navigation-progress-bar h-full w-1/3 bg-primary" />
    </div>
  )
}
