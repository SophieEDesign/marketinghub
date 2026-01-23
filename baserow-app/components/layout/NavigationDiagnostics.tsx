"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

/**
 * NavigationDiagnostics - Helps identify what's blocking navigation clicks
 * 
 * Enable via: localStorage.setItem("DEBUG_NAVIGATION", "1")
 * Then open browser console to see diagnostic info
 */
export default function NavigationDiagnostics() {
  const pathname = usePathname()
  const [enabled, setEnabled] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Mount check - ensure we're on client side
  useEffect(() => {
    setMounted(true)
    // Log that diagnostics component is loaded
    if (typeof window !== "undefined") {
      try {
        const isEnabled = localStorage.getItem("DEBUG_NAVIGATION") === "1"
        console.log("🔍 NavigationDiagnostics component loaded", {
          enabled: isEnabled,
          instruction: isEnabled ? "Diagnostics active" : 'Run localStorage.setItem("DEBUG_NAVIGATION", "1") to enable',
          localStorageAvailable: true,
        })
      } catch (e) {
        console.error("🔍 NavigationDiagnostics: localStorage error", e)
      }
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    
    // Check if diagnostics are enabled
    const checkEnabled = () => {
      try {
        return typeof window !== "undefined" && localStorage.getItem("DEBUG_NAVIGATION") === "1"
      } catch (e) {
        return false
      }
    }
    
    const currentEnabled = checkEnabled()
    if (currentEnabled !== enabled) {
      setEnabled(currentEnabled)
      if (currentEnabled) {
        console.log("🔍 Navigation Diagnostics ENABLED - monitoring navigation clicks")
      } else {
        console.log("🔍 Navigation Diagnostics DISABLED")
      }
    }
    
    const interval = setInterval(() => {
      const newEnabled = checkEnabled()
      if (newEnabled !== enabled) {
        setEnabled(newEnabled)
        if (newEnabled) {
          console.log("🔍 Navigation Diagnostics ENABLED - monitoring navigation clicks")
        }
      }
    }, 500) // Check more frequently

    return () => clearInterval(interval)
  }, [mounted, enabled])

  useEffect(() => {
    if (!enabled) return

    // Run diagnostics on pathname change
    const runDiagnostics = () => {
      console.group("🔍 Navigation Diagnostics")
      
      // 1. Check for blocking overlays
      const overlays = document.querySelectorAll('[class*="fixed"][class*="inset"]')
      console.log("📋 Overlays:", {
        count: overlays.length,
        items: Array.from(overlays).map(el => ({
          element: el,
          classes: el.className,
          zIndex: window.getComputedStyle(el).zIndex,
          pointerEvents: window.getComputedStyle(el).pointerEvents,
          display: window.getComputedStyle(el).display,
        }))
      })

      // 2. Check body/html styles
      const body = document.body
      const html = document.documentElement
      console.log("🎨 Body/HTML Styles:", {
        body: {
          pointerEvents: body.style.pointerEvents || window.getComputedStyle(body).pointerEvents,
          userSelect: body.style.userSelect || window.getComputedStyle(body).userSelect,
          cursor: body.style.cursor || window.getComputedStyle(body).cursor,
          overflow: body.style.overflow || window.getComputedStyle(body).overflow,
          dataScrollLocked: body.getAttribute("data-scroll-locked"),
        },
        html: {
          pointerEvents: html.style.pointerEvents || window.getComputedStyle(html).pointerEvents,
          userSelect: html.style.userSelect || window.getComputedStyle(html).userSelect,
          overflow: html.style.overflow || window.getComputedStyle(html).overflow,
        }
      })

      // 3. Check for open modals/dialogs
      const dialogs = document.querySelectorAll('[role="dialog"]')
      console.log("🚪 Dialogs:", {
        count: dialogs.length,
        items: Array.from(dialogs).map(el => ({
          element: el,
          dataState: el.getAttribute("data-state"),
          ariaModal: el.getAttribute("aria-modal"),
          display: window.getComputedStyle(el).display,
        }))
      })

      // 4. Check sidebar links (Next.js Link components render as <a> tags)
      const sidebarContainer = document.querySelector('[data-sidebar]')
      const sidebarLinks = sidebarContainer 
        ? Array.from(sidebarContainer.querySelectorAll('a[href]'))
        : []
      console.log("🔗 Sidebar Links:", {
        count: sidebarLinks.length,
        containerFound: !!sidebarContainer,
        items: sidebarLinks.map(el => ({
          element: el,
          href: el.getAttribute("href"),
          pointerEvents: window.getComputedStyle(el).pointerEvents,
          zIndex: window.getComputedStyle(el).zIndex,
          display: window.getComputedStyle(el).display,
          tagName: el.tagName,
        }))
      })

      // 5. Check for elements with pointer-events: none
      const noPointerEvents = Array.from(document.querySelectorAll("*")).filter(el => {
        const style = window.getComputedStyle(el)
        return style.pointerEvents === "none"
      })
      console.log("🚫 Elements with pointer-events: none:", {
        count: noPointerEvents.length,
        top10: noPointerEvents.slice(0, 10).map(el => ({
          tag: el.tagName,
          classes: el.className,
          id: el.id,
        }))
      })

      // 6. Check z-index stacking
      const highZIndex = Array.from(document.querySelectorAll("*")).filter(el => {
        const zIndex = parseInt(window.getComputedStyle(el).zIndex)
        return !isNaN(zIndex) && zIndex >= 40
      }).sort((a, b) => {
        const za = parseInt(window.getComputedStyle(a).zIndex)
        const zb = parseInt(window.getComputedStyle(b).zIndex)
        return zb - za
      })
      console.log("📚 High Z-Index Elements (≥40):", {
        count: highZIndex.length,
        top10: highZIndex.slice(0, 10).map(el => ({
          tag: el.tagName,
          classes: el.className,
          zIndex: window.getComputedStyle(el).zIndex,
          pointerEvents: window.getComputedStyle(el).pointerEvents,
        }))
      })

      // 7. Check for drag state
      const dragElements = document.querySelectorAll('[class*="dragging"], [class*="drag"]')
      console.log("🖱️ Drag Elements:", {
        count: dragElements.length,
        items: Array.from(dragElements).map(el => ({
          element: el,
          classes: el.className,
        }))
      })

      // 8. Test click on sidebar link
      const sidebarContainerForTest = document.querySelector('[data-sidebar]')
      const testLink = sidebarContainerForTest 
        ? (sidebarContainerForTest.querySelector('a[href^="/pages/"]') as HTMLAnchorElement)
        : null
      if (testLink) {
        console.log("🧪 Test Link Found:", {
          href: testLink.href,
          element: testLink,
          canClick: window.getComputedStyle(testLink).pointerEvents !== "none",
        })
        
        // Try to simulate click and see what happens
        testLink.addEventListener("click", (e) => {
          console.log("✅ Sidebar link clicked!", {
            href: testLink.href,
            defaultPrevented: e.defaultPrevented,
            target: e.target,
          })
        }, { once: true, capture: true })
      } else {
        console.log("🧪 No test link found in sidebar")
      }

      // 9. Performance check - detect if UI is blocked
      const perfStart = performance.now()
      requestAnimationFrame(() => {
        const perfElapsed = performance.now() - perfStart
        console.log("⚡ Performance:", {
          rafLatency: perfElapsed,
          status: perfElapsed > 16 ? "SLOW" : "OK",
          warning: perfElapsed > 100 ? "UI thread may be blocked!" : null,
        })
      })

      // 10. Check for long-running operations
      const longTasks = (performance as any).getEntriesByType?.('long-task') || []
      if (longTasks.length > 0) {
        console.warn("⚠️ Long tasks detected (blocking operations):", {
          count: longTasks.length,
          recent: longTasks.slice(-5).map((task: any) => ({
            duration: task.duration,
            startTime: task.startTime,
          })),
        })
      }

      console.groupEnd()
    }

    // Run immediately and after a delay
    runDiagnostics()
    const timeout = setTimeout(runDiagnostics, 1000)

    return () => clearTimeout(timeout)
  }, [pathname, enabled])

  // Add click listener to document to catch blocked clicks
  useEffect(() => {
    if (!enabled) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Find sidebar container first, then find link within it
      const sidebarContainerForClick = target.closest('[data-sidebar]')
      const sidebarLink = sidebarContainerForClick 
        ? (target.closest('a[href]') as HTMLAnchorElement)
        : null
      
      if (sidebarLink && sidebarContainerForClick) {
        console.log("🖱️ Click on sidebar link:", {
          href: sidebarLink.getAttribute("href"),
          element: sidebarLink,
          defaultPrevented: e.defaultPrevented,
          pointerEvents: window.getComputedStyle(sidebarLink).pointerEvents,
          zIndex: window.getComputedStyle(sidebarLink).zIndex,
          pathname: pathname,
        })

        // Check if something is blocking
        const rect = sidebarLink.getBoundingClientRect()
        const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY)
        
        if (elementAtPoint !== sidebarLink && !sidebarLink.contains(elementAtPoint)) {
          console.warn("⚠️ Click blocked! Element at point:", {
            blockingElement: elementAtPoint,
            blockingClasses: elementAtPoint?.className,
            blockingZIndex: elementAtPoint ? window.getComputedStyle(elementAtPoint).zIndex : null,
            expectedElement: sidebarLink,
          })
        }
      }
    }

    document.addEventListener("click", handleClick, true) // Use capture phase
    return () => document.removeEventListener("click", handleClick, true)
  }, [enabled, pathname])

  // Performance monitoring - detect if UI is frozen/blocked
  useEffect(() => {
    if (!enabled || !mounted) return

    let lastCheck = performance.now()
    let frameCount = 0
    let blockedFrames = 0

    const checkPerformance = () => {
      const now = performance.now()
      const elapsed = now - lastCheck
      
      // If frame took > 100ms, UI is likely blocked
      if (elapsed > 100) {
        blockedFrames++
        if (blockedFrames > 3) {
          console.warn("⚠️ UI BLOCKED - Performance issue detected!", {
            blockedFrames,
            averageFrameTime: elapsed,
            message: "UI thread is blocked, clicks may not register",
          })
        }
      } else {
        blockedFrames = 0
      }
      
      frameCount++
      lastCheck = now
      
      // Log performance every 60 frames (~1 second at 60fps)
      if (frameCount % 60 === 0) {
        console.log("⚡ Performance check:", {
          frameTime: elapsed,
          blockedFrames,
          status: blockedFrames > 0 ? "BLOCKED" : "OK",
        })
      }
    }

    let rafId: number
    const monitor = () => {
      checkPerformance()
      rafId = requestAnimationFrame(monitor)
    }
    rafId = requestAnimationFrame(monitor)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [enabled, mounted])

  // Expose a global test function for manual testing
  useEffect(() => {
    if (!mounted) return
    
    // Add a global function to test navigation and diagnostics
    if (typeof window !== "undefined") {
      (window as any).testNavigation = (pageId?: string) => {
        const testPageId = pageId || "test-page-id"
        console.log("🧪 Testing navigation to:", `/pages/${testPageId}`)
        
        const link = document.querySelector(`[data-sidebar] a[href="/pages/${testPageId}"]`) as HTMLAnchorElement
        if (link) {
          console.log("✅ Found link, clicking...")
          link.click()
        } else {
          console.warn("❌ Link not found. Available links:", 
            Array.from(document.querySelectorAll('[data-sidebar] a[href^="/pages/"]')).map(a => a.getAttribute("href"))
          )
        }
      }
      
      (window as any).checkNavigationDiagnostics = () => {
        console.log("🔍 Navigation Diagnostics Status:", {
          localStorage: typeof Storage !== "undefined",
          debugEnabled: localStorage.getItem("DEBUG_NAVIGATION") === "1",
          sidebarFound: !!document.querySelector('[data-sidebar]'),
          sidebarLinks: document.querySelectorAll('[data-sidebar] a[href]').length,
          componentMounted: mounted,
          enabled: enabled,
        })
      }

      (window as any).checkPerformance = () => {
        const start = performance.now()
        // Test if UI thread is responsive
        requestAnimationFrame(() => {
          const elapsed = performance.now() - start
          console.log("⚡ Performance Test:", {
            rafLatency: elapsed,
            status: elapsed > 16 ? "SLOW" : "OK",
            message: elapsed > 100 ? "UI thread is blocked!" : "UI thread is responsive",
          })
        })
      }
      
      console.log("💡 Test functions available:")
      console.log("   - window.testNavigation(pageId) - Test clicking a link")
      console.log("   - window.checkNavigationDiagnostics() - Check diagnostics status")
      console.log("   - window.checkPerformance() - Check if UI thread is blocked")
    }
    
    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).testNavigation
        delete (window as any).checkPerformance
      }
    }
  }, [mounted, enabled])

  return null
}
