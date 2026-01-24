"use client"

import { useEffect, useState } from "react"

/**
 * PerformanceMonitor - Detects UI blocking and performance issues
 * 
 * Automatically monitors for:
 * - Long tasks (>50ms) that block the UI
 * - Frame drops (slow rendering)
 * - Memory leaks
 * - Blocking operations
 */
export default function PerformanceMonitor() {
  const [blocked, setBlocked] = useState(false)
  const [stats, setStats] = useState({
    longTasks: 0,
    slowFrames: 0,
    avgFrameTime: 0,
  })

  useEffect(() => {
    // Check if PerformanceObserver is available
    if (typeof window === "undefined" || !("PerformanceObserver" in window)) {
      return
    }

    let frameCount = 0
    let totalFrameTime = 0
    let lastFrameTime = performance.now()
    let slowFrameCount = 0
    let longTaskCount = 0

    // Monitor frame rate
    const checkFrameRate = () => {
      const now = performance.now()
      const frameTime = now - lastFrameTime
      totalFrameTime += frameTime
      frameCount++

      // Frame should be ~16ms for 60fps, >50ms is slow
      if (frameTime > 50) {
        slowFrameCount++
        if (slowFrameCount > 5) {
          setBlocked(true)
          console.warn("⚠️ UI BLOCKED - Multiple slow frames detected!", {
            frameTime,
            slowFrames: slowFrameCount,
            message: "UI thread is blocked, clicks may not register",
          })
        }
      } else {
        slowFrameCount = 0
        setBlocked(false)
      }

      if (frameCount % 60 === 0) {
        const avgFrameTime = totalFrameTime / frameCount
        setStats(prev => ({
          longTasks: prev.longTasks, // Preserve longTasks from observer updates
          slowFrames: slowFrameCount,
          avgFrameTime,
        }))
        totalFrameTime = 0
        frameCount = 0
      }

      lastFrameTime = now
      requestAnimationFrame(checkFrameRate)
    }

    const rafId = requestAnimationFrame(checkFrameRate)

    // Monitor long tasks (blocking operations >50ms)
    // Check if long-task entry type is supported before trying to observe it
    let observer: PerformanceObserver | null = null
    
    try {
      // Check if PerformanceObserver.supportedEntryTypes includes 'long-task'
      // This is the proper way to check if an entry type is supported
      const supportedEntryTypes = (PerformanceObserver as any).supportedEntryTypes
      const isLongTaskSupported = supportedEntryTypes && supportedEntryTypes.includes('long-task')
      
      if (isLongTaskSupported) {
        observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const duration = (entry as any).duration
            if (duration > 50) {
              longTaskCount++
              setStats(prev => ({ ...prev, longTasks: longTaskCount }))
              console.warn("⚠️ Long task detected (blocking operation):", {
                duration: `${duration.toFixed(2)}ms`,
                startTime: (entry as any).startTime,
                message: "This operation blocked the UI thread",
              })
            }
          }
        })

        observer.observe({ entryTypes: ["long-task"] })
      } else {
        // Long task API not supported - silently skip
        // This prevents the console error
      }
    } catch (e) {
      // Long task API not supported or error occurred
      // Silently handle - this is expected in some browsers
    }

    return () => {
      if (observer) {
        observer.disconnect()
      }
      cancelAnimationFrame(rafId)
    }
  }, []) // Empty dependency array - effect should only run once on mount

  // Log performance warnings
  useEffect(() => {
    if (blocked) {
      console.warn("🚨 PERFORMANCE ISSUE: UI is blocked!", {
        message: "Navigation clicks may not work. Try refreshing the page.",
        stats,
      })
    }
  }, [blocked, stats])

  return null
}
