"use client"

import type { PageBlock } from "@/lib/interface/types"
import { EventCalendarFromConfig } from "@/components/interface/EventCalendarCore"
import { cn } from "@/lib/utils"

interface EventCalendarBlockProps {
  block: PageBlock
  isEditing?: boolean
  interfaceMode?: "view" | "edit"
  /** Page-level permission to add/edit events (admins on view-mode pages). */
  pageEditable?: boolean
}

/**
 * Interface Builder block wrapper for the marketing Event Calendar.
 * Renders inside the standard block canvas; full-page layout uses config.is_full_page.
 */
export default function EventCalendarBlock({
  block,
  isEditing = false,
  interfaceMode: _interfaceMode = "view",
  pageEditable,
}: EventCalendarBlockProps) {
  const canEdit = pageEditable !== false
  const embeddedInBlock = block.config?.is_full_page !== true

  return (
    <div
      className={cn(
        "flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden",
        block.config?.is_full_page && "rounded-none border-0 shadow-none"
      )}
      data-block-type="event_calendar"
      data-block-selectable
    >
      <EventCalendarFromConfig
        config={block.config}
        canEdit={canEdit}
        isEditing={isEditing}
        embeddedInBlock={embeddedInBlock}
        className="flex-1 min-h-0"
      />
    </div>
  )
}
