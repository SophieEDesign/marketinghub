"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/** Nav link styles for the white Marketing Hub sidebar (readable in light + dark app theme). */
export const sidebarNavItemClassName = (active: boolean) =>
  cn(
    "relative flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors duration-150",
    !active &&
      "text-muted-foreground hover:bg-muted/50 hover:text-foreground dark:!text-muted-foreground dark:hover:!text-foreground",
    active &&
      "bg-blue-50 text-foreground font-medium hover:bg-blue-50 hover:text-foreground dark:!bg-blue-50 dark:!text-foreground dark:hover:!bg-blue-50 dark:hover:!text-foreground"
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
