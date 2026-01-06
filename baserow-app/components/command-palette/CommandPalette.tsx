"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Search, FileText, Grid3x3, Layout, Calendar, Clock, Table, Star, Clock as ClockIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { formatShortcutKeys, ShortcutKeys } from "@/lib/shortcuts/shortcuts"
import { useShortcuts } from "@/hooks/useShortcuts"
import type { ShortcutContext } from "@/lib/shortcuts/shortcuts"

export interface Command {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
  keywords?: string[]
  action: () => void
  category: 'navigation' | 'action' | 'view' | 'recent' | 'favorite'
  entityType?: 'table' | 'page' | 'view' | 'interface'
  entityId?: string
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [commands, setCommands] = useState<Command[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Helper functions
  const getViewIcon = useCallback((type: string) => {
    switch (type) {
      case 'grid':
        return <Grid3x3 className="h-4 w-4" />
      case 'kanban':
        return <Layout className="h-4 w-4" />
      case 'calendar':
        return <Calendar className="h-4 w-4" />
      case 'timeline':
        return <Clock className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }, [])

  const navigateToEntity = useCallback((entityType: string, entityId: string, tableId?: string) => {
    switch (entityType) {
      case 'table':
        router.push(`/tables/${entityId}`)
        break
      case 'page':
      case 'interface':
        router.push(`/pages/${entityId}`)
        break
      case 'view':
        if (tableId) {
          router.push(`/tables/${tableId}/views/${entityId}`)
        }
        break
    }
  }, [router])

  // Register command palette shortcut
  useShortcuts([
    {
      id: 'command-palette',
      keys: [...ShortcutKeys.COMMAND_PALETTE],
      description: 'Open command palette',
      action: () => onOpenChange(true),
      context: ['global'],
      preventDefault: true,
    },
  ])

  // Load commands function
  const loadCommands = useCallback(async () => {
    setLoading(true)
    try {
      // Load tables, pages, views, and recent items
      // Use query if provided, otherwise load all
      const searchQuery = query.trim()
      const searchParam = searchQuery ? `q=${encodeURIComponent(searchQuery)}&` : 'q=&'
      const [tablesRes, pagesRes, recentRes, favoritesRes] = await Promise.all([
        fetch(`/api/search?${searchParam}type=tables`).catch(() => null),
        fetch(`/api/search?${searchParam}type=pages`).catch(() => null),
        fetch('/api/recents').catch(() => null),
        fetch('/api/favorites').catch(() => null),
      ])

      const allCommands: Command[] = []

      // Add tables
      if (tablesRes?.ok) {
        const { items } = await tablesRes.json()
        items?.forEach((table: any) => {
          allCommands.push({
            id: `table-${table.id}`,
            label: table.name,
            description: 'Table',
            icon: <Table className="h-4 w-4" />,
            keywords: [table.name, 'table'],
            action: () => {
              router.push(`/tables/${table.id}`)
              onOpenChange(false)
            },
            category: 'navigation',
            entityType: 'table',
            entityId: table.id,
          })
        })
      }

      // Add pages/interfaces
      if (pagesRes?.ok) {
        const { items } = await pagesRes.json()
        items?.forEach((page: any) => {
          const icon = page.type === 'interface' ? <FileText className="h-4 w-4" /> : getViewIcon(page.type)
          allCommands.push({
            id: `page-${page.id}`,
            label: page.name,
            description: page.type === 'interface' ? 'Interface' : `${page.type} view`,
            icon,
            keywords: [page.name, page.type, 'page', 'interface'],
            action: () => {
              if (page.type === 'interface') {
                router.push(`/pages/${page.id}`)
              } else {
                router.push(`/tables/${page.table_id}/views/${page.id}`)
              }
              onOpenChange(false)
            },
            category: 'navigation',
            entityType: page.type === 'interface' ? 'interface' : 'view',
            entityId: page.id,
          })
        })
      }

      // Add recent items
      if (recentRes?.ok) {
        const { items } = await recentRes.json()
        items?.forEach((item: any) => {
          allCommands.push({
            id: `recent-${item.entity_type}-${item.entity_id}`,
            label: item.name || item.entity_id,
            description: `Recently opened ${item.entity_type}`,
            icon: <ClockIcon className="h-4 w-4" />,
            keywords: [item.name, 'recent'],
            action: () => {
              navigateToEntity(item.entity_type, item.entity_id, item.table_id)
              onOpenChange(false)
            },
            category: 'recent',
            entityType: item.entity_type,
            entityId: item.entity_id,
          })
        })
      }

      // Add favorites
      if (favoritesRes?.ok) {
        const { items } = await favoritesRes.json()
        items?.forEach((item: any) => {
          allCommands.push({
            id: `favorite-${item.entity_type}-${item.entity_id}`,
            label: item.name || item.entity_id,
            description: `Favorite ${item.entity_type}`,
            icon: <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />,
            keywords: [item.name, 'favorite', 'starred'],
            action: () => {
              navigateToEntity(item.entity_type, item.entity_id, item.table_id)
              onOpenChange(false)
            },
            category: 'favorite',
            entityType: item.entity_type,
            entityId: item.entity_id,
          })
        })
      }

      // Add action commands
      allCommands.push({
        id: 'new-interface',
        label: 'New Interface',
        description: 'Create a new interface page',
        icon: <FileText className="h-4 w-4" />,
        keywords: ['new', 'create', 'interface'],
        action: () => {
          router.push('/interface/new')
          onOpenChange(false)
        },
        category: 'action',
      })

      allCommands.push({
        id: 'new-table',
        label: 'New Table',
        description: 'Create a new data table',
        icon: <Table className="h-4 w-4" />,
        keywords: ['new', 'create', 'table'],
        action: () => {
          router.push('/settings?tab=data')
          onOpenChange(false)
        },
        category: 'action',
      })

      setCommands(allCommands)
    } catch (error) {
      console.error('Error loading commands:', error)
    } finally {
      setLoading(false)
    }
  }, [query, router, onOpenChange, navigateToEntity, getViewIcon])

  // Load commands when palette opens
  useEffect(() => {
    if (open) {
      loadCommands()
      setQuery("")
      setSelectedIndex(0)
      // Focus input after a brief delay to ensure dialog is rendered
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [open, loadCommands])

  // Reload commands when query changes
  useEffect(() => {
    if (open) {
      loadCommands()
      setSelectedIndex(0)
    }
  }, [query, open, loadCommands])

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      // Group by category when no query
      const grouped = commands.reduce((acc, cmd) => {
        if (!acc[cmd.category]) {
          acc[cmd.category] = []
        }
        acc[cmd.category].push(cmd)
        return acc
      }, {} as Record<string, Command[]>)
      
      // Flatten grouped commands (recent first, then favorites, then others)
      const order = ['recent', 'favorite', 'navigation', 'action', 'view']
      return order.flatMap(cat => grouped[cat] || [])
    }

    const lowerQuery = query.toLowerCase()
    return commands.filter(cmd => {
      const searchable = [
        cmd.label,
        cmd.description,
        ...(cmd.keywords || []),
      ].join(' ').toLowerCase()
      return searchable.includes(lowerQuery)
    })
  }, [commands, query])

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action()
        }
      } else if (event.key === 'Escape') {
        event.preventDefault()
        onOpenChange(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, filteredCommands, selectedIndex, onOpenChange])

  // Scroll selected item into view
  useEffect(() => {
    if (scrollRef.current) {
      const selectedElement = scrollRef.current.querySelector(`[data-index="${selectedIndex}"]`)
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Group commands by category for display
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {}
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = []
      }
      groups[cmd.category].push(cmd)
    })
    return groups
  }, [filteredCommands])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0" aria-describedby="command-palette-description">
        <DialogHeader className="sr-only">
          <DialogTitle>Command Palette</DialogTitle>
          <DialogDescription id="command-palette-description">
            Search tables, pages, views, or run commands
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center border-b px-4 py-3">
          <Search className="h-4 w-4 text-gray-400 mr-2" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tables, pages, views, or run commands..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
          />
          <Badge variant="outline" className="ml-2 text-xs">
            {formatShortcutKeys(ShortcutKeys.COMMAND_PALETTE)}
          </Badge>
        </div>

        <ScrollArea className="max-h-[400px]" ref={scrollRef}>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
              Loading...
            </div>
          ) : filteredCommands.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Search className="h-8 w-8 mb-2 text-gray-300" />
              <p className="text-sm">No results found</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="py-2">
              {Object.entries(groupedCommands).map(([category, categoryCommands]) => (
                <div key={category} className="mb-2">
                  {query && (
                    <div className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase">
                      {category}
                    </div>
                  )}
                  {categoryCommands.map((cmd, index) => {
                    const globalIndex = filteredCommands.indexOf(cmd)
                    const isSelected = globalIndex === selectedIndex
                    return (
                      <button
                        key={cmd.id}
                        data-index={globalIndex}
                        onClick={cmd.action}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 transition-colors ${
                          isSelected ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex-shrink-0 text-gray-400">
                          {cmd.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {cmd.label}
                          </div>
                          {cmd.description && (
                            <div className="text-xs text-gray-500 truncate">
                              {cmd.description}
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-t px-4 py-2 text-xs text-gray-500 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

