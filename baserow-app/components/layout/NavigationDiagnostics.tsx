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

    // Helper function to check for actual issues
    const checkForIssues = (): boolean => {
      // Check for blocking overlays
      const overlays = document.querySelectorAll('[class*="fixed"][class*="inset"]')
      const blockingOverlays = Array.from(overlays).filter(el => {
        const style = window.getComputedStyle(el)
        const zIndex = parseInt(style.zIndex)
        return !isNaN(zIndex) && zIndex >= 40 && style.pointerEvents !== "none"
      })

      // Check body/html for locked styles
      const body = document.body
      const bodyStyle = window.getComputedStyle(body)
      const isBodyLocked = bodyStyle.pointerEvents === "none" || bodyStyle.userSelect === "none"

      // Check for open dialogs
      const dialogs = document.querySelectorAll('[role="dialog"]')
      const openDialogs = Array.from(dialogs).filter(el => {
        const style = window.getComputedStyle(el)
        return style.display !== "none" && style.visibility !== "hidden"
      })

      return blockingOverlays.length > 0 || isBodyLocked || openDialogs.length > 0
    }

    // Run diagnostics on pathname change
    // Only show detailed diagnostics if there's an issue, otherwise just a summary
    const runDiagnostics = (isDelayedCheck = false) => {
      const sidebarCheck = document.querySelector('[data-sidebar]')
      if (!sidebarCheck) {
        // During navigation transitions, sidebar might be temporarily unmounted
        // Only show error if this is a delayed check (after navigation should have completed)
        if (!isDelayedCheck) {
          // Skip immediate check during navigation - will check again after delay
          return
        }
        console.group("🔍 Navigation Diagnostics - ISSUES DETECTED")
        console.error("❌ CRITICAL: Sidebar not found! Looking for [data-sidebar] attribute")
        // Try to find sidebar by other means
        const possibleSidebars = document.querySelectorAll('[class*="sidebar"], [class*="Sidebar"], aside')
        console.log("🔍 Possible sidebar elements found:", Array.from(possibleSidebars).map(el => ({
          tag: el.tagName,
          classes: el.className,
          id: el.id,
          hasDataSidebar: el.hasAttribute('data-sidebar'),
        })))
      } else {
        // Only show full diagnostics if there are actual issues
        const hasIssues = checkForIssues()
        if (hasIssues) {
          console.group("🔍 Navigation Diagnostics - ISSUES DETECTED")
        } else {
          // Just log a simple summary when everything is OK
          console.log("✅ Navigation Diagnostics: All checks passed")
          return // Exit early if no issues
        }
      }
      
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

      // 9. Performance check - detect if UI is blocked (only log if slow)
      const perfStart = performance.now()
      requestAnimationFrame(() => {
        const perfElapsed = performance.now() - perfStart
        // Only log if there's an actual performance issue
        if (perfElapsed > 100) {
          console.warn("⚡ Performance issue detected:", {
            rafLatency: perfElapsed,
            status: "SLOW",
            warning: "UI thread may be blocked!",
          })
        }
      })

      // 10. Check for long-running operations
      // Only check if long-task API is supported
      try {
        const supportedEntryTypes = (PerformanceObserver as any).supportedEntryTypes
        const isLongTaskSupported = supportedEntryTypes && supportedEntryTypes.includes('long-task')
        
        if (isLongTaskSupported) {
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
        }
      } catch (e) {
        // Long task API not supported - silently skip
      }

      console.groupEnd()
    }

    // Run after a delay to allow navigation to complete and sidebar to mount
    // First check is delayed to avoid false positives during navigation transitions
    const timeout1 = setTimeout(() => runDiagnostics(false), 100)
    const timeout2 = setTimeout(() => runDiagnostics(true), 1000)

    return () => {
      clearTimeout(timeout1)
      clearTimeout(timeout2)
    }
  }, [pathname, enabled])

  // Add click listener to document to catch ALL clicks (even blocked ones)
  useEffect(() => {
    if (!enabled) return

    // First, verify sidebar exists
    const sidebarExists = document.querySelector('[data-sidebar]')
    if (!sidebarExists) {
      console.error("❌ Sidebar not found! Click detection may not work.")
    }

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      
      // Log ALL clicks in sidebar area, not just on links
      const sidebarContainerForClick = target.closest('[data-sidebar]')
      
      if (sidebarContainerForClick) {
        console.log("🖱️ CLICK DETECTED in sidebar area:", {
          target: target,
          targetTag: target.tagName,
          targetClasses: target.className,
          targetId: target.id,
          href: target.getAttribute("href") || (target.closest("a")?.getAttribute("href")),
          clientX: e.clientX,
          clientY: e.clientY,
          defaultPrevented: e.defaultPrevented,
          stopPropagation: e.cancelBubble,
          timestamp: performance.now(),
        })

        // Find link if clicked element is inside one
        const sidebarLink = sidebarContainerForClick 
          ? (target.closest('a[href]') as HTMLAnchorElement)
          : null
      
        if (sidebarLink) {
          console.log("🔗 Click is on a link:", {
            href: sidebarLink.getAttribute("href"),
            element: sidebarLink,
            pointerEvents: window.getComputedStyle(sidebarLink).pointerEvents,
            zIndex: window.getComputedStyle(sidebarLink).zIndex,
            display: window.getComputedStyle(sidebarLink).display,
            visibility: window.getComputedStyle(sidebarLink).visibility,
            opacity: window.getComputedStyle(sidebarLink).opacity,
            pathname: pathname,
          })

          // Check if something is blocking
          const rect = sidebarLink.getBoundingClientRect()
          const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY)
          
          console.log("📍 Element at click point:", {
            element: elementAtPoint,
            elementTag: elementAtPoint?.tagName,
            elementClasses: elementAtPoint?.className,
            isLink: elementAtPoint === sidebarLink,
            isLinkChild: sidebarLink.contains(elementAtPoint),
            blockingZIndex: elementAtPoint ? window.getComputedStyle(elementAtPoint).zIndex : null,
            linkZIndex: window.getComputedStyle(sidebarLink).zIndex,
          })
          
          if (elementAtPoint !== sidebarLink && !sidebarLink.contains(elementAtPoint)) {
            console.warn("⚠️ CLICK BLOCKED! Something is on top of the link:", {
              blockingElement: elementAtPoint,
              blockingTag: elementAtPoint?.tagName,
              blockingClasses: elementAtPoint?.className,
              blockingZIndex: elementAtPoint ? window.getComputedStyle(elementAtPoint).zIndex : null,
              blockingPointerEvents: elementAtPoint ? window.getComputedStyle(elementAtPoint).pointerEvents : null,
              expectedElement: sidebarLink,
              linkRect: rect,
            })
          }
        } else {
          console.warn("⚠️ Click in sidebar but NOT on a link:", {
            clickedElement: target,
            clickedTag: target.tagName,
            clickedClasses: target.className,
            parentLink: target.closest("a"),
          })
        }
      }
    }

    // Use capture phase to catch clicks BEFORE they can be prevented
    // This should catch ALL clicks, even if they're prevented later
    document.addEventListener("click", handleClick, true)
    
    // Also listen in bubble phase to see if it gets through
    const handleBubble = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-sidebar]')) {
        console.log("🖱️ Click reached bubble phase:", {
          defaultPrevented: e.defaultPrevented,
          target: target,
          href: target.getAttribute("href") || target.closest("a")?.getAttribute("href"),
        })
      }
    }
    document.addEventListener("click", handleBubble, false)
    
    // Also listen for mousedown to catch even earlier
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-sidebar]')) {
        console.log("🖱️ MOUSEDOWN in sidebar:", {
          target: target.tagName,
          targetClasses: target.className,
          href: target.getAttribute("href") || target.closest("a")?.getAttribute("href"),
        })
      }
    }
    document.addEventListener("mousedown", handleMouseDown, true)
    
    return () => {
      document.removeEventListener("click", handleClick, true)
      document.removeEventListener("click", handleBubble, false)
      document.removeEventListener("mousedown", handleMouseDown, true)
    }
  }, [enabled, pathname])

  // Performance monitoring - detect if UI is frozen/blocked
  // Only log when issues are detected, not continuously
  useEffect(() => {
    if (!enabled || !mounted) return

    let lastCheck = performance.now()
    let frameCount = 0
    let blockedFrames = 0
    let lastWarningTime = 0
    const WARNING_COOLDOWN = 5000 // Only warn once every 5 seconds

    const checkPerformance = () => {
      const now = performance.now()
      const elapsed = now - lastCheck
      
      // If frame took > 100ms, UI is likely blocked
      if (elapsed > 100) {
        blockedFrames++
        // Only warn if we've accumulated enough blocked frames AND enough time has passed since last warning
        if (blockedFrames > 3 && (now - lastWarningTime) > WARNING_COOLDOWN) {
          lastWarningTime = now
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
      
      // Only log performance status when there's an issue, not every second
      // This reduces console noise significantly
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

      (window as any).testSidebarClick = () => {
        console.log("🧪 Testing sidebar click detection...")
        const sidebar = document.querySelector('[data-sidebar]')
        if (!sidebar) {
          console.error("❌ Sidebar not found!")
          return
        }
        const link = sidebar.querySelector('a[href^="/pages/"]') as HTMLAnchorElement
        if (!link) {
          console.error("❌ No page links found in sidebar!")
          console.log("Available links:", Array.from(sidebar.querySelectorAll('a')).map(a => ({
            href: a.getAttribute("href"),
            text: a.textContent?.trim(),
          })))
          return
        }
        console.log("✅ Found link, simulating click:", link.getAttribute("href"))
        // Simulate a real click event
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        })
        link.dispatchEvent(clickEvent)
        console.log("✅ Click event dispatched")
      }

      (window as any).verifyClickListeners = () => {
        console.log("🔍 Verifying click listeners...")
        // Check if we can find event listeners (this is tricky in JS, but we can test)
        const sidebar = document.querySelector('[data-sidebar]')
        if (!sidebar) {
          console.error("❌ Sidebar not found!")
          return
        }
        const link = sidebar.querySelector('a[href^="/pages/"]') as HTMLAnchorElement
        if (!link) {
          console.error("❌ No page links found!")
          return
        }
        console.log("✅ Sidebar and link found")
        console.log("📋 Link details:", {
          href: link.getAttribute("href"),
          pointerEvents: window.getComputedStyle(link).pointerEvents,
          display: window.getComputedStyle(link).display,
          visibility: window.getComputedStyle(link).visibility,
          zIndex: window.getComputedStyle(link).zIndex,
          rect: link.getBoundingClientRect(),
        })
        // Test if link is actually clickable
        const testClick = () => {
          console.log("✅ Click listener is working - this message proves it!")
        }
        link.addEventListener("click", testClick, { once: true })
        console.log("💡 Test listener added. Click the link to verify.")
      }
      
      console.log("💡 Test functions available:")
      console.log("   - window.testNavigation(pageId) - Test clicking a link")
      console.log("   - window.checkNavigationDiagnostics() - Check diagnostics status")
      console.log("   - window.checkPerformance() - Check if UI thread is blocked")
      console.log("   - window.testSidebarClick() - Simulate a sidebar click")
      console.log("   - window.verifyClickListeners() - Verify click detection is working")
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
