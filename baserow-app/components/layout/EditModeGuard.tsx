"use client"

/**
 * EditModeGuard - Prevents leaving the page or app while in edit mode without saving.
 * - beforeunload: Warns when closing tab, refreshing, or navigating away (external)
 * - Link click intercept: Confirms before in-app navigation when in edit mode
 */
import { useEffect } from "react"
import { useEditMode } from "@/contexts/EditModeContext"

const LEAVE_MESSAGE =
  "You're in edit mode. Save changes and exit before leaving?"

export default function EditModeGuard() {
  const { isAnyEditing, exitAllEditModes } = useEditMode()

  // Warn when closing tab, refreshing, or navigating to external URL
  useEffect(() => {
    if (!isAnyEditing()) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = LEAVE_MESSAGE
      return LEAVE_MESSAGE
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isAnyEditing])

  // Intercept in-app navigation (Link clicks) when in edit mode
  useEffect(() => {
    if (!isAnyEditing()) return

    const handleClick = (e: MouseEvent) => {
      if (!isAnyEditing()) return

      const target = e.target as HTMLElement
      const link = target.closest('a[href]')
      if (!link) return

      const href = link.getAttribute("href")
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return
      if (link.target === "_blank") return

      try {
        const url = new URL(href, window.location.origin)
        if (url.origin !== window.location.origin) return
      } catch {
        return
      }

      const currentPath = window.location.pathname
      const targetPath = new URL(href, window.location.origin).pathname
      if (targetPath === currentPath) return

      e.preventDefault()
      e.stopPropagation()

      const ok = window.confirm(LEAVE_MESSAGE)
      if (ok) {
        exitAllEditModes()
        window.location.href = href
      }
    }

    document.addEventListener("click", handleClick, true)
    return () => document.removeEventListener("click", handleClick, true)
  }, [isAnyEditing, exitAllEditModes])

  return null
}
