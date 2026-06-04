"use client"

import { useEffect, useRef, type RefObject } from "react"
import { getFocusableElements } from "@/lib/a11y/focus-utils"

type UseOverlayPanelA11yOptions = {
  /** Panel is open and should manage focus */
  active: boolean
  panelRef: RefObject<HTMLElement | null>
  /** Trap Tab within the panel */
  trapFocus?: boolean
  /** Called on Escape when not pinned in edit mode (caller decides close rules) */
  onEscape?: () => void
}

/**
 * Initial focus, focus trap, and restore focus on close for overlay record drawers.
 */
export function useOverlayPanelA11y({
  active,
  panelRef,
  trapFocus = true,
  onEscape,
}: UseOverlayPanelA11yOptions) {
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) return

    restoreFocusRef.current = document.activeElement as HTMLElement | null

    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel) return
      const focusable = getFocusableElements(panel)
      const target = focusable[0]
      if (target) {
        target.focus()
      } else {
        panel.tabIndex = -1
        panel.focus()
      }
    })

    return () => {
      cancelAnimationFrame(frame)
      const el = restoreFocusRef.current
      if (el && document.contains(el)) {
        try {
          el.focus()
        } catch {
          // Element may no longer be focusable
        }
      }
      restoreFocusRef.current = null
    }
  }, [active, panelRef])

  useEffect(() => {
    if (!active || !trapFocus) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onEscape?.()
        return
      }
      if (e.key !== "Tab") return

      const panel = panelRef.current
      if (!panel) return

      const focusable = getFocusableElements(panel)
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeEl = document.activeElement as HTMLElement | null

      if (e.shiftKey) {
        if (activeEl === first || (activeEl && !panel.contains(activeEl))) {
          e.preventDefault()
          last.focus()
        }
      } else if (activeEl === last || (activeEl && !panel.contains(activeEl))) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [active, trapFocus, onEscape, panelRef])
}
