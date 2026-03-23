"use client"

import { cn } from "@/lib/utils"

/** Simple illustration: empty table/database - grid with placeholder rows */
export function EmptyTableIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 80"
      className={cn("w-24 h-16 text-muted-foreground/60", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="8" y="12" width="104" height="56" rx="2" />
      <line x1="8" y1="24" x2="112" y2="24" />
      <line x1="8" y1="36" x2="80" y2="36" />
      <line x1="8" y1="48" x2="70" y2="48" />
      <line x1="8" y1="60" x2="90" y2="60" />
      <circle cx="42" cy="54" r="6" className="text-muted-foreground/40" />
    </svg>
  )
}

/** Simple illustration: empty document/interface */
export function EmptyInterfaceIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 80"
      className={cn("w-24 h-16 text-muted-foreground/60", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="20" y="8" width="80" height="64" rx="2" />
      <line x1="32" y1="24" x2="88" y2="24" />
      <line x1="32" y1="36" x2="72" y2="36" />
      <line x1="32" y1="48" x2="80" y2="48" />
      <line x1="32" y1="60" x2="64" y2="60" />
      <circle cx="56" cy="52" r="12" strokeDasharray="3 3" className="text-muted-foreground/40" />
    </svg>
  )
}

/** Simple illustration: search / no results */
export function EmptySearchIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 80"
      className={cn("w-24 h-16 text-muted-foreground/60", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="44" cy="36" r="14" />
      <line x1="62" y1="54" x2="92" y2="74" />
      <path d="M 30 24 Q 50 20 70 30" strokeDasharray="2 2" className="text-muted-foreground/40" />
    </svg>
  )
}
