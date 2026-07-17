"use client"

import { ExternalLink } from "lucide-react"
import {
  externalLinkLabel,
  normalizeExternalUrl,
} from "@/lib/marketing/social-media-calendar"
import { cn } from "@/lib/utils"

export function SocialPostExternalLink({
  url,
  className,
  iconClassName,
  showLabel = false,
  showPlanableChip = false,
}: {
  url: string | null | undefined
  className?: string
  iconClassName?: string
  showLabel?: boolean
  /** Compact pill on calendar cards — reads as Planable, not a generic share icon. */
  showPlanableChip?: boolean
}) {
  const href = normalizeExternalUrl(url)
  if (!href) return null

  const label = externalLinkLabel(href)
  const isPlanable = /planable\./i.test(href)

  if (showPlanableChip && isPlanable) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={label}
        aria-label={label}
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md border border-violet-200/80 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-300",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        Planable
        <ExternalLink className={cn("h-2.5 w-2.5 opacity-80", iconClassName)} aria-hidden />
      </a>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1 shrink-0 text-muted-foreground hover:text-accent-link",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <ExternalLink className={cn("h-3.5 w-3.5", iconClassName)} aria-hidden />
      {showLabel ? <span className="text-[10px] font-medium">{label}</span> : null}
    </a>
  )
}
