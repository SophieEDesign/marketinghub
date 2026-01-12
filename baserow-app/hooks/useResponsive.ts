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
 */
export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() => {
    if (typeof window === 'undefined') return 'desktop'
    const width = window.innerWidth
    if (width <= BREAKPOINTS.mobile) return 'mobile'
    if (width <= BREAKPOINTS.tablet) return 'tablet'
    return 'desktop'
  })

  useEffect(() => {
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

    window.addEventListener('resize', handleResize)
    handleResize() // Check on mount

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return breakpoint
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
