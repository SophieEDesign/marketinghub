'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getIconComponent } from '@/lib/icons'
import { cn } from '@/lib/utils'

interface SidebarItemProps {
  id: string
  label: string
  href: string
  icon?: string | null
  level?: number
  children?: React.ReactNode
  onClick?: () => void
}

export default function SidebarItem({
  id,
  label,
  href,
  icon,
  level = 0,
  children,
  onClick,
}: SidebarItemProps) {
  const pathname = usePathname()
  const isActive = pathname && href && (pathname === href || pathname.startsWith(`${href}/`))

  // Dynamically get icon component
  const IconComponent = getIconComponent(icon)

  const content = (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
        level > 0 && 'pl-6',
        isActive
          ? 'bg-accent text-accent-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      {IconComponent && <IconComponent className="h-4 w-4 flex-shrink-0" />}
      <span className="truncate">{label}</span>
    </div>
  )

  if (onClick) {
    return <div className="block">{content}</div>
  }

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  )
}
