"use client"

import { useState, useEffect, useCallback } from "react"
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride"

const TOUR_STORAGE_KEY = "marketing-hub-onboarding-seen"

const TOUR_STEPS: Step[] = [
  {
    target: '[data-tour="sidebar"]',
    content: "Use the sidebar to navigate between interface pages, tables, and views.",
    placement: "right",
    disableBeacon: true,
  },
  {
    target: '[data-tour="search"]',
    content: "Search tables, pages, and views. You can also press ⌘K (or Ctrl+K) anytime.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="user-menu"]',
    content: "Access settings and sign out from your profile menu.",
    placement: "bottom",
    disableBeacon: true,
  },
]

export default function OnboardingTour() {
  const [run, setRun] = useState(false)

  useEffect(() => {
    try {
      const seen = localStorage.getItem(TOUR_STORAGE_KEY)
      if (!seen) {
        // Delay slightly so DOM is ready
        const t = setTimeout(() => setRun(true), 1500)
        return () => clearTimeout(t)
      }
    } catch {
      // Ignore
    }
  }, [])

  const handleCallback = useCallback((data: CallBackProps) => {
    const { status } = data
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRun(false)
      try {
        localStorage.setItem(TOUR_STORAGE_KEY, "true")
      } catch {
        // Ignore
      }
    }
  }, [])

  if (!run) return null

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={run}
      continuous
      showProgress
      showSkipButton
      callback={handleCallback}
      locale={{
        back: "Back",
        close: "Close",
        last: "Finish",
        next: "Next",
        skip: "Skip tour",
      }}
      styles={{
        options: {
          primaryColor: "hsl(var(--primary))",
          zIndex: 10000,
        },
      }}
    />
  )
}
