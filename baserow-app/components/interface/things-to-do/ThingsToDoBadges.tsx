"use client"

import {
  getPriorityClasses,
  getPriorityLabel,
  getStatusClasses,
  getStatusLabel,
  getTypeClasses,
  getTypeLabel,
  type ThingsToDoItemType,
  type ThingsToDoPriority,
  type ThingsToDoStatus,
} from "@/lib/marketing/things-to-do"
import { cn } from "@/lib/utils"

function BadgePill({
  bg,
  text,
  label,
  className,
}: {
  bg: string
  text: string
  label: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        bg,
        text,
        className
      )}
    >
      {label}
    </span>
  )
}

export function ThingsToDoTypeBadge({
  type,
  className,
}: {
  type: ThingsToDoItemType
  className?: string
}) {
  const { bg, text } = getTypeClasses(type)
  return <BadgePill bg={bg} text={text} label={getTypeLabel(type)} className={className} />
}

export function ThingsToDoStatusBadge({
  status,
  className,
}: {
  status: ThingsToDoStatus
  className?: string
}) {
  const { bg, text } = getStatusClasses(status)
  return <BadgePill bg={bg} text={text} label={getStatusLabel(status)} className={className} />
}

export function ThingsToDoPriorityBadge({
  priority,
  className,
}: {
  priority: ThingsToDoPriority
  className?: string
}) {
  const { bg, text } = getPriorityClasses(priority)
  return <BadgePill bg={bg} text={text} label={getPriorityLabel(priority)} className={className} />
}
