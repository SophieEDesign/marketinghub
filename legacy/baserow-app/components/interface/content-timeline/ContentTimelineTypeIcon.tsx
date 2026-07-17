"use client"

import {
  Globe,
  FileText,
  Newspaper,
  Mail,
  Megaphone,
  CalendarDays,
  BookOpen,
  Send,
  Radio,
  Target,
  type LucideIcon,
} from "lucide-react"
import type { ContentTimelineItemType } from "@/lib/marketing/content-timeline"
import { cn } from "@/lib/utils"

const TYPE_ICONS: Record<ContentTimelineItemType, LucideIcon> = {
  social: Megaphone,
  website: Globe,
  blog: FileText,
  newsletter: Mail,
  campaign: Target,
  event: CalendarDays,
  "case-study": BookOpen,
  email: Send,
  "press-release": Newspaper,
  ad: Radio,
}

export function ContentTimelineTypeIcon({
  type,
  className,
}: {
  type: ContentTimelineItemType
  className?: string
}) {
  const Icon = TYPE_ICONS[type] ?? FileText
  return <Icon className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground", className)} aria-hidden />
}
