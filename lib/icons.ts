import * as LucideIcons from 'lucide-react'

/**
 * Converts kebab-case icon names to PascalCase and returns the icon component
 * Example: 'layout-dashboard' -> LayoutDashboard
 */
export function getIconComponent(iconName: string | null | undefined) {
  if (!iconName) return null

  // Convert kebab-case to PascalCase
  const pascalCase = iconName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')

  // Get the icon component from lucide-react
  const IconComponent = LucideIcons[pascalCase as keyof typeof LucideIcons] as
    | React.ComponentType<{ className?: string }>
    | undefined

  return IconComponent || null
}
