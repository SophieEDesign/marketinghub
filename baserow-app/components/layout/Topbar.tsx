"use client"

import AppHeader from "@/components/shell/AppHeader"

interface TopbarProps {
  title?: string
  onSidebarToggle?: () => void
  isAdmin?: boolean
}

export default function Topbar({ title, onSidebarToggle }: TopbarProps) {
  return (
    <AppHeader
      title={title}
      onSidebarToggle={onSidebarToggle}
      showSearch
    />
  )
}
