"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/** Nav link styles for the white Marketing Hub sidebar (fixed contrast; not theme foreground). */
export const sidebarNavItemClassName = (active: boolean) =>
  cn(
    "relative flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors duration-150",
    !active && "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    active && "bg-blue-50 text-slate-900 font-medium hover:bg-blue-50 hover:text-slate-900"
  )

interface SidebarNavItemProps {
  active?: boolean
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
  href?: string
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
}

export default function SidebarNavItem({
  active = false,
  icon,
  children,
  className,
  href,
  onClick,
}: SidebarNavItemProps) {
  const content = (
    <>
      {icon ? <span className="flex shrink-0 opacity-90">{icon}</span> : null}
      <span className="truncate">{children}</span>
    </>
  )

  if (href) {
    return (
      <a href={href} className={cn(sidebarNavItemClassName(active), className)} onClick={onClick}>
        {content}
      </a>
    )
  }

  return <div className={cn(sidebarNavItemClassName(active), className)}>{content}</div>
}
