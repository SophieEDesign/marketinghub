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
}: {
  url: string | null | undefined
  className?: string
  iconClassName?: string
  showLabel?: boolean
}) {
  const href = normalizeExternalUrl(url)
  if (!href) return null

  const label = externalLinkLabel(href)

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
