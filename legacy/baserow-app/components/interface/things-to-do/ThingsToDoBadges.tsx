"use client"

import {
  getPriorityLabel,
  getStatusLabel,
  getTypeLabel,
  type ThingsToDoItemType,
  type ThingsToDoPriority,
  type ThingsToDoStatus,
} from "@/lib/marketing/things-to-do"
import { ChoicePill } from "@/components/fields/ChoicePill"

function BadgePill({ label, className }: { label: string; className?: string }) {
  return (
    <ChoicePill
      label={label}
      fieldType="single_select"
      className={className}
      truncate
    />
  )
}

export function ThingsToDoTypeBadge({
  type,
  className,
}: {
  type: ThingsToDoItemType
  className?: string
}) {
  return <BadgePill label={getTypeLabel(type)} className={className} />
}

export function ThingsToDoStatusBadge({
  status,
  className,
}: {
  status: ThingsToDoStatus
  className?: string
}) {
  return <BadgePill label={getStatusLabel(status)} className={className} />
}

export function ThingsToDoPriorityBadge({
  priority,
  className,
}: {
  priority: ThingsToDoPriority
  className?: string
}) {
  return <BadgePill label={getPriorityLabel(priority)} className={className} />
}
