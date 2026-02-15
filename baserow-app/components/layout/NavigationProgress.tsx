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
      const target = e.target as HTMLElement
      const anchor = target.closest('a[href^="/"]')
      if (!anchor || (anchor as HTMLAnchorElement).target === "_blank") return
      const href = (anchor as HTMLAnchorElement).href
      if (href && typeof window !== "undefined" && href.startsWith(window.location.origin)) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NavigationProgress.tsx:click',message:'NAV_LINK_CLICKED',data:{href:href.replace(window.location.origin,'')},timestamp:Date.now()})}).catch(()=>{})
        // #endregion
        setIsNavigating(true)
      }
    }
    document.addEventListener("click", handleClick, true)
    return () => document.removeEventListener("click", handleClick, true)
  }, [])

  // Hide progress when pathname has changed (new page loaded)
  useEffect(() => {
    if (pathname !== prevPathnameRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NavigationProgress.tsx:pathname',message:'PATHNAME_CHANGED',data:{pathname,prev:prevPathnameRef.current},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
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
