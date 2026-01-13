"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  Calendar,
  Folder,
  MessageSquare,
  Lightbulb,
  Umbrella,
  BarChart3,
  Users,
  FileText,
  Settings,
  Home,
  Database,
  Grid,
  List,
  Kanban,
  Clock,
  Target,
  TrendingUp,
  DollarSign,
  Mail,
  Phone,
  Globe,
  Image,
  Video,
  Music,
  Book,
  Briefcase,
  ShoppingCart,
  Heart,
  Star,
  Zap,
  Shield,
  Lock,
  Unlock,
  Bell,
  Search,
  Filter,
  Plus,
  Minus,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  Edit,
  Trash2,
  Copy,
  Share,
  Download,
  Upload,
  Eye,
  EyeOff,
  MoreVertical,
  MoreHorizontal,
} from 'lucide-react'

// Common interface icons - simple, recognizable icons
const INTERFACE_ICONS = [
  { name: 'Calendar', icon: Calendar },
  { name: 'Folder', icon: Folder },
  { name: 'MessageSquare', icon: MessageSquare },
  { name: 'Lightbulb', icon: Lightbulb },
  { name: 'Umbrella', icon: Umbrella },
  { name: 'BarChart3', icon: BarChart3 },
  { name: 'Users', icon: Users },
  { name: 'FileText', icon: FileText },
  { name: 'Settings', icon: Settings },
  { name: 'Home', icon: Home },
  { name: 'Database', icon: Database },
  { name: 'Grid', icon: Grid },
  { name: 'List', icon: List },
  { name: 'Kanban', icon: Kanban },
  { name: 'Clock', icon: Clock },
  { name: 'Target', icon: Target },
  { name: 'TrendingUp', icon: TrendingUp },
  { name: 'DollarSign', icon: DollarSign },
  { name: 'Mail', icon: Mail },
  { name: 'Phone', icon: Phone },
  { name: 'Globe', icon: Globe },
  { name: 'Image', icon: Image },
  { name: 'Video', icon: Video },
  { name: 'Music', icon: Music },
  { name: 'Book', icon: Book },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'ShoppingCart', icon: ShoppingCart },
  { name: 'Heart', icon: Heart },
  { name: 'Star', icon: Star },
  { name: 'Zap', icon: Zap },
  { name: 'Shield', icon: Shield },
  { name: 'Lock', icon: Lock },
  { name: 'Unlock', icon: Unlock },
  { name: 'Bell', icon: Bell },
  { name: 'Search', icon: Search },
  { name: 'Filter', icon: Filter },
]

// Map icon names to components for rendering
const iconMap: Record<string, React.ElementType> = {
  Calendar,
  Folder,
  MessageSquare,
  Lightbulb,
  Umbrella,
  BarChart3,
  Users,
  FileText,
  Settings,
  Home,
  Database,
  Grid,
  List,
  Kanban,
  Clock,
  Target,
  TrendingUp,
  DollarSign,
  Mail,
  Phone,
  Globe,
  Image,
  Video,
  Music,
  Book,
  Briefcase,
  ShoppingCart,
  Heart,
  Star,
  Zap,
  Shield,
  Lock,
  Unlock,
  Bell,
  Search,
  Filter,
}

interface LucideIconPickerProps {
  value?: string
  onChange: (iconName: string) => void
  placeholder?: string
  className?: string
}

export function LucideIconPicker({ 
  value = '', 
  onChange, 
  placeholder = 'Folder',
  className 
}: LucideIconPickerProps) {
  const [open, setOpen] = useState(false)

  // Get the icon component for the selected value
  const SelectedIcon = value ? iconMap[value] : null
  const PlaceholderIcon = iconMap[placeholder] || Folder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          {SelectedIcon ? (
            <SelectedIcon className="h-4 w-4 mr-2" />
          ) : (
            <PlaceholderIcon className="h-4 w-4 mr-2" />
          )}
          <span className="text-sm text-muted-foreground">
            {value ? value : 'Select icon'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-2">
          <div className="text-sm font-medium mb-3">Select an icon</div>
          <div className="grid grid-cols-8 gap-2 max-h-64 overflow-y-auto">
            {INTERFACE_ICONS.map(({ name, icon: Icon }) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onChange(name)
                  setOpen(false)
                }}
                className={cn(
                  "w-10 h-10 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors",
                  value === name && "bg-blue-100 ring-2 ring-blue-500"
                )}
                title={name}
              >
                <Icon className="h-5 w-5" />
              </button>
            ))}
          </div>
          <div className="pt-2 border-t">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
            >
              Clear icon
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Helper function to render an icon by name
export function renderIconByName(iconName: string | null | undefined, className: string = "h-4 w-4") {
  if (!iconName) return null
  const IconComponent = iconMap[iconName]
  if (!IconComponent) return null
  return <IconComponent className={className} />
}
