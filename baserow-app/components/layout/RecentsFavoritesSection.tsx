"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Clock, Star, ChevronRight, ChevronDown } from "lucide-react"
import { getRecentItemsClient, getFavoritesClient } from "@/lib/recents/recents.client"
import { recordRecentItemClient } from "@/lib/recents/recents.client"
import type { RecentItem, Favorite } from "@/lib/recents/recents"

interface RecentsFavoritesSectionProps {
  primaryColor: string
  sidebarTextColor: string
}

export default function RecentsFavoritesSection({ primaryColor, sidebarTextColor }: RecentsFavoritesSectionProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [recents, setRecents] = useState<RecentItem[]>([])
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['recents', 'favorites']))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  // Record current page as recent when navigating
  useEffect(() => {
    const currentPath = pathname
    if (currentPath) {
      const entityMatch = currentPath.match(/\/(tables|pages|automations)\/([^\/]+)/)
      if (entityMatch) {
        const [, entityType, entityId] = entityMatch
        const mappedType = entityType === 'pages' ? 'interface' : entityType === 'tables' ? 'table' : 'automation'
        recordRecentItemClient(mappedType as any, entityId).catch(console.error)
      }
    }
  }, [pathname])

  async function loadData() {
    setLoading(true)
    try {
      const [recentsData, favoritesData] = await Promise.all([
        getRecentItemsClient(10),
        getFavoritesClient(20),
      ])
      setRecents(recentsData)
      setFavorites(favoritesData)
    } catch (error) {
      console.error('Error loading recents/favorites:', error)
    } finally {
      setLoading(false)
    }
  }

  function toggleSection(section: string) {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  function navigateToEntity(item: RecentItem | Favorite) {
    switch (item.entity_type) {
      case 'table':
        router.push(`/tables/${item.entity_id}`)
        break
      case 'interface':
      case 'page':
        router.push(`/pages/${item.entity_id}`)
        break
      case 'view':
        if (item.table_id) {
          router.push(`/tables/${item.table_id}/views/${item.entity_id}`)
        }
        break
    }
  }

  if (loading && recents.length === 0 && favorites.length === 0) {
    return null
  }

  return (
    <>
      {/* Recents Section */}
      {recents.length > 0 && (
        <div className="py-2 border-t border-gray-100">
          <div className="px-3 mb-1">
            <button
              onClick={() => toggleSection('recents')}
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-wider hover:bg-gray-50 rounded transition-colors"
              style={{ color: sidebarTextColor }}
            >
              <span>Recently Viewed</span>
              {expandedSections.has('recents') ? (
                <ChevronDown className="h-3 w-3" style={{ color: sidebarTextColor }} />
              ) : (
                <ChevronRight className="h-3 w-3" style={{ color: sidebarTextColor }} />
              )}
            </button>
          </div>
          {expandedSections.has('recents') && (
            <div className="space-y-0.5 px-2">
              {recents.slice(0, 5).map((item) => {
                const isActive = pathname.includes(`/${item.entity_id}`)
                return (
                  <button
                    key={`recent-${item.entity_type}-${item.entity_id}`}
                    onClick={() => navigateToEntity(item)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors hover:bg-gray-100 text-sm"
                    style={isActive ? {
                      backgroundColor: primaryColor + '15',
                      color: primaryColor
                    } : { color: sidebarTextColor }}
                  >
                    <Clock className="h-3 w-3 flex-shrink-0" style={{ color: isActive ? primaryColor : sidebarTextColor }} />
                    <span className="truncate flex-1 text-left">{item.name || item.entity_id}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Favorites Section */}
      {favorites.length > 0 && (
        <div className="py-2 border-t border-gray-100">
          <div className="px-3 mb-1">
            <button
              onClick={() => toggleSection('favorites')}
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-wider hover:bg-gray-50 rounded transition-colors"
              style={{ color: sidebarTextColor }}
            >
              <span>Starred</span>
              {expandedSections.has('favorites') ? (
                <ChevronDown className="h-3 w-3" style={{ color: sidebarTextColor }} />
              ) : (
                <ChevronRight className="h-3 w-3" style={{ color: sidebarTextColor }} />
              )}
            </button>
          </div>
          {expandedSections.has('favorites') && (
            <div className="space-y-0.5 px-2">
              {favorites.slice(0, 10).map((item) => {
                const isActive = pathname.includes(`/${item.entity_id}`)
                return (
                  <button
                    key={`favorite-${item.entity_type}-${item.entity_id}`}
                    onClick={() => navigateToEntity(item)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors hover:bg-gray-100 text-sm"
                    style={isActive ? {
                      backgroundColor: primaryColor + '15',
                      color: primaryColor
                    } : { color: sidebarTextColor }}
                  >
                    <Star className="h-3 w-3 flex-shrink-0 fill-yellow-400 text-yellow-400" />
                    <span className="truncate flex-1 text-left">{item.name || item.entity_id}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </>
  )
}

