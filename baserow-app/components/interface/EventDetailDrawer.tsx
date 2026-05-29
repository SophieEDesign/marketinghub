"use client"

import { EventDetailContent } from "@/components/interface/EventDetailPanel"
import type { EventDetailContentProps } from "@/components/interface/EventDetailPanel"

export interface EventDetailDrawerProps extends EventDetailContentProps {
  open: boolean
  onClose: () => void
}

/**
 * Right-side event detail drawer for block-embedded calendars.
 * Overlay excludes the app sidebar on md+ (REG-004).
 */
export default function EventDetailDrawer({
  open,
  onClose,
  event,
  ...contentProps
}: EventDetailDrawerProps) {
  if (!open || !event) return null

  return (
    <>
      <div
        className="fixed inset-0 md:left-64 bg-black/20 z-40"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-background border-l border-border/40 shadow-xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={`Event: ${event.eventName}`}
      >
        <EventDetailContent event={event} onClose={onClose} {...contentProps} />
      </aside>
    </>
  )
}
