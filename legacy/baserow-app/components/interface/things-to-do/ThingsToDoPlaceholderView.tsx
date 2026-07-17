"use client"

import { Calendar, LayoutGrid, ListOrdered, Megaphone } from "lucide-react"
import type { ThingsToDoView } from "@/lib/marketing/things-to-do"

const VIEW_META: Record<
  Exclude<ThingsToDoView, "list">,
  { icon: typeof LayoutGrid; title: string; todo: string }
> = {
  board: {
    icon: LayoutGrid,
    title: "Board view",
    todo: "TODO: implement Board view with status columns and drag-and-drop.",
  },
  "by-priority": {
    icon: ListOrdered,
    title: "By priority",
    todo: "TODO: implement By priority view grouping urgent → low.",
  },
  "by-campaign": {
    icon: Megaphone,
    title: "By campaign",
    todo: "TODO: implement By campaign view with campaign sections.",
  },
  calendar: {
    icon: Calendar,
    title: "Calendar",
    todo: "TODO: implement Calendar view with due dates on a month grid.",
  },
}

interface ThingsToDoPlaceholderViewProps {
  view: Exclude<ThingsToDoView, "list">
}

export function ThingsToDoPlaceholderView({ view }: ThingsToDoPlaceholderViewProps) {
  const meta = VIEW_META[view]
  const Icon = meta.icon

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{meta.title}</h3>
      <p className="max-w-sm text-xs text-muted-foreground">{meta.todo}</p>
      <p className="text-xs text-muted-foreground/80">Switch to List to see your work queue.</p>
    </div>
  )
}
