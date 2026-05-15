"use client"

import { ArrowUpRight, FileText, Folder, LayoutTemplate, Palette, Presentation } from "lucide-react"
import DashboardPanel from "@/components/interface/primitives/DashboardPanel"
import type { StaffHubAsset } from "@/lib/marketing/internal-staff-hub"
import { cn } from "@/lib/utils"

const ICONS = [Palette, Folder, Presentation, LayoutTemplate, FileText]

interface QuickAccessPanelProps {
  items: StaffHubAsset[]
  onOpen: (asset: StaffHubAsset) => void
  className?: string
}

export default function QuickAccessPanel({ items, onOpen, className }: QuickAccessPanelProps) {
  return (
    <DashboardPanel
      title="Quick access"
      subtitle="Pinned essentials"
      density="compact"
      className={cn("h-full", className)}
      bodyClassName="px-3 py-2"
    >
      <ul className="flex flex-col gap-0.5">
        {items.map((item, i) => {
          const Icon = ICONS[i % ICONS.length]
          const hasLink = Boolean(item.link?.openUrl)
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpen(item)}
                disabled={!hasLink && item.id.startsWith("placeholder-")}
                className={cn(
                  "w-full flex items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors",
                  hasLink ? "hover:bg-muted/50 group" : "opacity-60 cursor-default"
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-inner bg-muted/60 text-muted-foreground">
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-foreground truncate">
                    {item.title}
                  </span>
                  <span className="block text-[11px] text-muted-foreground truncate">
                    {item.link?.providerLabel ?? "Google Drive"}
                  </span>
                </span>
                {hasLink ? (
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-accent-link transition-colors" />
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </DashboardPanel>
  )
}
