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

  // CRITICAL: Stabilize enabled check - only run interval when mounted, not when enabled changes
  // This prevents re-creating intervals on every enabled state change
  useEffect(() => {
    if (!mounted) return
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[NavigationDiagnostics] Enabled check effect MOUNTED')
    }
    
    // Check if diagnostics are enabled
    const checkEnabled = () => {
      try {
        return typeof window !== "undefined" && localStorage.getItem("DEBUG_NAVIGATION") === "1"
      } catch (e) {
        return false
      }
    }
    
    // Initial check
    const currentEnabled = checkEnabled()
    if (currentEnabled !== enabled) {
      setEnabled(currentEnabled)
      if (currentEnabled) {
        console.log("🔍 Navigation Diagnostics ENABLED - monitoring navigation clicks")
      } else {
        console.log("🔍 Navigation Diagnostics DISABLED")
      }
    }
    
    // CRITICAL: Use ref to access latest enabled value without causing re-runs
    // Check localStorage periodically but don't recreate interval when enabled changes
    const interval = setInterval(() => {
      const newEnabled = checkEnabled()
      setEnabled(prev => {
        if (prev !== newEnabled) {
          if (newEnabled) {
            console.log("🔍 Navigation Diagnostics ENABLED - monitoring navigation clicks")
          } else {
            console.log("🔍 Navigation Diagnostics DISABLED")
          }
          return newEnabled
        }
        return prev
      })
    }, 1000) // Reduced frequency: check every 1s instead of 500ms

    return () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[NavigationDiagnostics] Enabled check effect CLEANUP - clearing interval')
      }
      clearInterval(interval)
    }
  }, [mounted]) // CRITICAL: Only depend on mounted, not enabled - prevents interval recreation

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
    // Sidebar lives in WorkspaceShell (page-level), so it may mount after root layout — allow time for it.
    // CRITICAL: Defer heavy DOM operations to avoid blocking UI thread during navigation
    const runDiagnostics = (checkKind: 'immediate' | 'short' | 'final') => {
      // CRITICAL: Wrap heavy operations in requestIdleCallback or setTimeout to avoid blocking
      const runHeavyDiagnostics = () => {
        const sidebarCheck = document.querySelector('[data-sidebar]')
        if (!sidebarCheck) {
          // Skip immediate check; sidebar often isn't in DOM yet (page-level layout).
          if (checkKind === 'immediate') return
          if (checkKind === 'short') {
            // After 1s: might still be loading — don't treat as critical yet
            console.log("🔍 Navigation Diagnostics: Sidebar not yet found (may still be loading)")
            return
          }
          // checkKind === 'final': after 2.5s, treat as missing
          console.group("🔍 Navigation Diagnostics - ISSUES DETECTED")
          console.warn("⚠️ Sidebar not found after load. Looking for [data-sidebar] attribute")
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
      // CRITICAL: Batch getComputedStyle calls to reduce layout thrashing
      const overlays = document.querySelectorAll('[class*="fixed"][class*="inset"]')
      const overlayData = Array.from(overlays).map(el => {
        const style = window.getComputedStyle(el) // Single getComputedStyle call per element
        return {
          element: el,
          classes: el.className,
          zIndex: style.zIndex,
          pointerEvents: style.pointerEvents,
          display: style.display,
        }
      })
      console.log("📋 Overlays:", {
        count: overlays.length,
        items: overlayData
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
      // CRITICAL: Batch getComputedStyle calls to reduce layout thrashing
      const dialogs = document.querySelectorAll('[role="dialog"]')
      const dialogData = Array.from(dialogs).map(el => {
        const style = window.getComputedStyle(el) // Single getComputedStyle call per element
        return {
          element: el,
          dataState: el.getAttribute("data-state"),
          ariaModal: el.getAttribute("aria-modal"),
          display: style.display,
        }
      })
      console.log("🚪 Dialogs:", {
        count: dialogs.length,
        items: dialogData
      })

      // 4. Check sidebar links (Next.js Link components render as <a> tags)
      // CRITICAL: Batch getComputedStyle calls to reduce layout thrashing
      const sidebarContainer = document.querySelector('[data-sidebar]')
      const sidebarLinks = sidebarContainer 
        ? Array.from(sidebarContainer.querySelectorAll('a[href]'))
        : []
      const linkData = sidebarLinks.map(el => {
        const style = window.getComputedStyle(el) // Single getComputedStyle call per element
        return {
          element: el,
          href: el.getAttribute("href"),
          pointerEvents: style.pointerEvents,
          zIndex: style.zIndex,
          display: style.display,
          tagName: el.tagName,
        }
      })
      console.log("🔗 Sidebar Links:", {
        count: sidebarLinks.length,
        containerFound: !!sidebarContainer,
        items: linkData
      })

      // 5. Check for elements with pointer-events: none
      // CRITICAL: Defer expensive querySelectorAll("*") to avoid blocking UI thread
      // Use requestIdleCallback to run when browser is idle, or setTimeout as fallback
      const checkPointerEvents = () => {
        // Only check common container elements instead of ALL elements
        const containers = document.querySelectorAll('[class*="fixed"], [class*="absolute"], [class*="sticky"], [role="dialog"], [data-sidebar]')
        const noPointerEvents = Array.from(containers).filter(el => {
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
      }
      
      // 6. Check z-index stacking
      // CRITICAL: Defer expensive querySelectorAll("*") to avoid blocking UI thread
      const checkZIndex = () => {
        // Only check elements that commonly have z-index (overlays, modals, fixed elements)
        const candidates = document.querySelectorAll('[class*="fixed"], [class*="absolute"], [class*="sticky"], [role="dialog"], [data-sidebar], [style*="z-index"]')
        const highZIndex = Array.from(candidates).filter(el => {
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
      }
      
      // Defer heavy operations to avoid blocking UI thread
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => {
          checkPointerEvents()
          checkZIndex()
        }, { timeout: 2000 })
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          checkPointerEvents()
          checkZIndex()
        }, 0)
      }

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
      
      // Defer heavy diagnostics to avoid blocking UI thread
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(runHeavyDiagnostics, { timeout: 1000 })
      } else {
        // Fallback: use setTimeout with small delay
        setTimeout(runHeavyDiagnostics, 0)
      }
    }

    // Run after delays so page-level sidebar (WorkspaceShell) has time to mount
    // CRITICAL: Use requestIdleCallback for non-critical diagnostics to avoid blocking navigation
    const timeouts: number[] = []
    const idleCallbacks: number[] = []
    
    const scheduleDiagnostics = (checkKind: 'immediate' | 'short' | 'final', delay: number) => {
      if (typeof requestIdleCallback !== 'undefined') {
        const timeoutId = setTimeout(() => {
          const idleId = requestIdleCallback(() => runDiagnostics(checkKind), { timeout: delay + 500 })
          idleCallbacks.push(idleId)
        }, delay)
        timeouts.push(timeoutId as unknown as number)
      } else {
        const timeoutId = setTimeout(() => runDiagnostics(checkKind), delay)
        timeouts.push(timeoutId as unknown as number)
      }
    }
    
    scheduleDiagnostics('immediate', 100)
    scheduleDiagnostics('short', 1000)
    scheduleDiagnostics('final', 2500)

    return () => {
      timeouts.forEach(id => clearTimeout(id))
      idleCallbacks.forEach(id => {
        if (typeof cancelIdleCallback !== 'undefined') {
          cancelIdleCallback(id)
        }
      })
    }
  }, [pathname, enabled])

  // Add click listener to document to catch ALL clicks (even blocked ones)
  useEffect(() => {
    if (!enabled) return

    if (process.env.NODE_ENV === 'development') {
      console.log('[NavigationDiagnostics] Click listeners effect MOUNTED')
    }

    // Sidebar is in page-level layout (WorkspaceShell) — it may not exist at effect run time.
    // Click detection still works once the sidebar is in the DOM; no error needed here.

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      
      // Log ALL clicks in sidebar area, not just on links
      const sidebarContainerForClick = target.closest('[data-sidebar]')
      
      if (sidebarContainerForClick) {
        // CRITICAL: Log basic info immediately (non-blocking)
        const basicInfo = {
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
        }
        console.log("🖱️ CLICK DETECTED in sidebar area:", basicInfo)

        // Find link if clicked element is inside one
        const sidebarLink = sidebarContainerForClick 
          ? (target.closest('a[href]') as HTMLAnchorElement)
          : null
      
        if (sidebarLink) {
          // CRITICAL: Defer heavy getComputedStyle calls to avoid blocking UI thread
          // These operations force layout recalculation and can block navigation
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => {
              const linkStyle = window.getComputedStyle(sidebarLink)
              console.log("🔗 Click is on a link:", {
                href: sidebarLink.getAttribute("href"),
                element: sidebarLink,
                pointerEvents: linkStyle.pointerEvents,
                zIndex: linkStyle.zIndex,
                display: linkStyle.display,
                visibility: linkStyle.visibility,
                opacity: linkStyle.opacity,
                pathname: pathname,
              })

              // Check if something is blocking (deferred)
              const rect = sidebarLink.getBoundingClientRect()
              const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY)
              
              const blockingStyle = elementAtPoint ? window.getComputedStyle(elementAtPoint) : null
              console.log("📍 Element at click point:", {
                element: elementAtPoint,
                elementTag: elementAtPoint?.tagName,
                elementClasses: elementAtPoint?.className,
                isLink: elementAtPoint === sidebarLink,
                isLinkChild: sidebarLink.contains(elementAtPoint),
                blockingZIndex: blockingStyle?.zIndex || null,
                linkZIndex: linkStyle.zIndex,
              })
              
              if (elementAtPoint !== sidebarLink && !sidebarLink.contains(elementAtPoint)) {
                console.warn("⚠️ CLICK BLOCKED! Something is on top of the link:", {
                  blockingElement: elementAtPoint,
                  blockingTag: elementAtPoint?.tagName,
                  blockingClasses: elementAtPoint?.className,
                  blockingZIndex: blockingStyle?.zIndex || null,
                  blockingPointerEvents: blockingStyle?.pointerEvents || null,
                  expectedElement: sidebarLink,
                  linkRect: rect,
                })
              }
            }, { timeout: 500 })
          } else {
            // Fallback: defer with setTimeout
            setTimeout(() => {
              const linkStyle = window.getComputedStyle(sidebarLink)
              console.log("🔗 Click is on a link:", {
                href: sidebarLink.getAttribute("href"),
                element: sidebarLink,
                pointerEvents: linkStyle.pointerEvents,
                zIndex: linkStyle.zIndex,
                display: linkStyle.display,
                visibility: linkStyle.visibility,
                opacity: linkStyle.opacity,
                pathname: pathname,
              })

              const rect = sidebarLink.getBoundingClientRect()
              const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY)
              const blockingStyle = elementAtPoint ? window.getComputedStyle(elementAtPoint) : null
              
              console.log("📍 Element at click point:", {
                element: elementAtPoint,
                elementTag: elementAtPoint?.tagName,
                elementClasses: elementAtPoint?.className,
                isLink: elementAtPoint === sidebarLink,
                isLinkChild: sidebarLink.contains(elementAtPoint),
                blockingZIndex: blockingStyle?.zIndex || null,
                linkZIndex: linkStyle.zIndex,
              })
              
              if (elementAtPoint !== sidebarLink && !sidebarLink.contains(elementAtPoint)) {
                console.warn("⚠️ CLICK BLOCKED! Something is on top of the link:", {
                  blockingElement: elementAtPoint,
                  blockingTag: elementAtPoint?.tagName,
                  blockingClasses: elementAtPoint?.className,
                  blockingZIndex: blockingStyle?.zIndex || null,
                  blockingPointerEvents: blockingStyle?.pointerEvents || null,
                  expectedElement: sidebarLink,
                  linkRect: rect,
                })
              }
            }, 0)
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
      if (process.env.NODE_ENV === 'development') {
        console.log('[NavigationDiagnostics] Click listeners effect CLEANUP - removing listeners')
      }
      document.removeEventListener("click", handleClick, true)
      document.removeEventListener("click", handleBubble, false)
      document.removeEventListener("mousedown", handleMouseDown, true)
    }
  }, [enabled]) // CRITICAL: Remove pathname dependency - listeners don't need to re-attach on navigation

  // Performance monitoring - detect if UI is frozen/blocked
  // CRITICAL: Use throttled monitoring to reduce overhead - check every 10 frames instead of every frame
  useEffect(() => {
    if (!enabled || !mounted) return

    let lastCheck = performance.now()
    let frameCount = 0
    let blockedFrames = 0
    let lastWarningTime = 0
    const WARNING_COOLDOWN = 5000 // Only warn once every 5 seconds
    const CHECK_INTERVAL = 10 // Check every 10 frames instead of every frame

    const checkPerformance = () => {
      const now = performance.now()
      const elapsed = now - lastCheck
      // We check every CHECK_INTERVAL frames, so average frame time = elapsed / CHECK_INTERVAL
      const avgFrameTime = elapsed / CHECK_INTERVAL

      // UI is blocked if average frame time > 100ms (vs ~16ms for 60fps)
      if (avgFrameTime > 100) {
        blockedFrames++
        // Only warn if we've accumulated enough blocked frames AND enough time has passed since last warning
        if (blockedFrames > 3 && (now - lastWarningTime) > WARNING_COOLDOWN) {
          lastWarningTime = now
          console.warn("⚠️ UI BLOCKED - Performance issue detected!", {
            blockedFrames,
            averageFrameTime: avgFrameTime,
            message: "UI thread is blocked, clicks may not register",
          })
        }
      } else {
        blockedFrames = 0
      }

      frameCount++
      lastCheck = now
    }

    let rafId: number
    let checkCounter = 0
    const monitor = () => {
      checkCounter++
      // Only check performance every N frames to reduce overhead
      if (checkCounter >= CHECK_INTERVAL) {
        checkPerformance()
        checkCounter = 0
      }
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
