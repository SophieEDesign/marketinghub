"use client"

import { useState, useEffect } from 'react'

/**
 * Breakpoint definitions matching the requirements:
 * - Mobile: ≤ 767px
 * - Tablet: 768px – 1279px
 * - Desktop: ≥ 1280px
 */
export const BREAKPOINTS = {
  mobile: 767,
  tablet: 1279,
  desktop: 1280,
} as const

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

/**
 * Hook to get current breakpoint
 * Always returns 'desktop' on initial render to prevent hydration mismatches
 */
export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    function handleResize() {
      const width = window.innerWidth
      if (width <= BREAKPOINTS.mobile) {
        setBreakpoint('mobile')
      } else if (width <= BREAKPOINTS.tablet) {
        setBreakpoint('tablet')
      } else {
        setBreakpoint('desktop')
      }
    }

    // Set initial breakpoint after mount
    handleResize()
    
    window.addEventListener('resize', handleResize)

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Always return 'desktop' until mounted to prevent hydration mismatches
  return mounted ? breakpoint : 'desktop'
}

/**
 * Hook to check if current screen is mobile
 */
export function useIsMobile(): boolean {
  const breakpoint = useBreakpoint()
  return breakpoint === 'mobile'
}

/**
 * Hook to check if current screen is tablet
 */
export function useIsTablet(): boolean {
  const breakpoint = useBreakpoint()
  return breakpoint === 'tablet'
}

/**
 * Hook to check if current screen is desktop
 */
export function useIsDesktop(): boolean {
  const breakpoint = useBreakpoint()
  return breakpoint === 'desktop'
}

/**
 * Hook to check if current screen is mobile or tablet
 */
export function useIsMobileOrTablet(): boolean {
  const breakpoint = useBreakpoint()
  return breakpoint === 'mobile' || breakpoint === 'tablet'
}
