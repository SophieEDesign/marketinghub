"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import {
  EventDetailContent,
  EventDetailFloatingShell,
  type EventDetailContentProps,
} from "@/components/interface/EventDetailPanel"

export interface EventDetailDrawerProps extends EventDetailContentProps {
  open: boolean
  onClose: () => void
}

/**
 * Right-side event detail drawer for block-embedded calendars.
 * Portaled to document.body so the dim overlay covers the full main area (not clipped by block transforms).
 */
export default function EventDetailDrawer({
  open,
  onClose,
  event,
  ...contentProps
}: EventDetailDrawerProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!open || !event || !mounted) return null

  return createPortal(
    <EventDetailFloatingShell onClose={onClose} ariaLabel={`Event: ${event.eventName}`}>
      <EventDetailContent event={event} onClose={onClose} fitContent {...contentProps} />
    </EventDetailFloatingShell>,
    document.body
  )
}
