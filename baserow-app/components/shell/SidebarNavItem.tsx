"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export const sidebarNavItemClassName = (active: boolean) =>
  cn(
    "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
    "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
    active && "bg-hub-nav-active text-hub-primary hover:bg-hub-nav-active hover:text-hub-primary"
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
