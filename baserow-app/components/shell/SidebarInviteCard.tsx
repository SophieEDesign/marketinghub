"use client"

import { ChevronRight, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarInviteCardProps {
  className?: string
}

export default function SidebarInviteCard({ className }: SidebarInviteCardProps) {
  return (
    <button
      type="button"
      className={cn(
        "group flex w-full items-start gap-3 rounded-xl border border-hub-border/80 bg-hub-nav-active/60 p-3 text-left transition-colors",
        "hover:bg-hub-nav-active hover:border-hub-primary/20",
        className
      )}
      aria-label="Invite your team"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
        <UserPlus className="h-4 w-4 text-hub-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">Invite your team</p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          Collaborate across your marketing projects.
        </p>
      </div>
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}
