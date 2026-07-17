"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

function hasOpenModal(): boolean {
  // Radix Dialog/Sheet renders a role="dialog" element when open.
  // If a dialog is open, we must NOT touch body styles or we'll break modal behavior.
  const anyOpenDialog = document.querySelector('[role="dialog"][data-state="open"]')
  if (anyOpenDialog) return true

  // Some components might not forward data-state, so also treat any aria-modal dialog as open.
  const anyAriaModal = document.querySelector('[role="dialog"][aria-modal="true"]')
  return !!anyAriaModal
}

function bodyLooksLocked(): boolean {
  const body = document.body
  const html = document.documentElement

  const bodyStyle = body?.style
  const htmlStyle = html?.style

  return (
    body?.getAttribute("data-scroll-locked") === "1" ||
    bodyStyle?.pointerEvents === "none" ||
    htmlStyle?.pointerEvents === "none" ||
    bodyStyle?.userSelect === "none" ||
    htmlStyle?.userSelect === "none" ||
    bodyStyle?.cursor?.includes("resize") === true
  )
}

function unlockBodyInteractions(reason: string) {
  // Only unlock if there is no modal open. This prevents breaking real dialogs.
  if (hasOpenModal()) return
  if (!bodyLooksLocked()) return

  const body = document.body
  const html = document.documentElement

  // Clear the common "interaction lock" leftovers.
  // These can get stuck if an event listener cleanup doesn't run.
  body.style.pointerEvents = ""
  body.style.userSelect = ""
  body.style.cursor = ""
  body.style.overflow = ""
  body.style.paddingRight = ""

  html.style.pointerEvents = ""
  html.style.userSelect = ""
  html.style.overflow = ""

  // If scroll-lock attributes are left behind, remove them.
  if (body.getAttribute("data-scroll-locked") === "1") {
    body.removeAttribute("data-scroll-locked")
  }

  // eslint-disable-next-line no-console
  if (process.env.NODE_ENV === "development") console.log("[InteractionFailsafe] unlocked", { reason })
}

export default function InteractionFailsafe() {
  const pathname = usePathname()

  useEffect(() => {
    // Attempt an unlock after navigation renders (covers "stuck until refresh" cases).
    const t = window.setTimeout(() => unlockBodyInteractions("route-change"), 0)
    return () => window.clearTimeout(t)
  }, [pathname])

  useEffect(() => {
    // Allow users to recover without refresh if something gets stuck.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") unlockBodyInteractions("escape")
    }

    // Watch for the body getting stuck in a locked state (e.g. pointer-events none).
    // If no modal is actually open, undo it.
    let raf = 0
    const observer = new MutationObserver(() => {
      if (raf) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        unlockBodyInteractions("mutation")
      })
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "class"],
      subtree: false,
    })
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["style", "class", "data-scroll-locked"],
      childList: true,
      subtree: true,
    })

    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      observer.disconnect()
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [])

  return null
}

