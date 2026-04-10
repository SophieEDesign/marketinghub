"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Star, ChevronRight, ChevronDown } from "lucide-react"
import { getFavoritesClient } from "@/lib/recents/recents.client"
import type { Favorite } from "@/lib/recents/recents"

interface RecentsFavoritesSectionProps {
  primaryColor: string
  sidebarTextColor: string
}

export default function RecentsFavoritesSection({ primaryColor, sidebarTextColor }: RecentsFavoritesSectionProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['favorites']))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const favoritesData = await getFavoritesClient(20)
      setFavorites(favoritesData)
    } catch (error) {
      console.error('Error loading favorites:', error)
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

  function navigateToEntity(item: Favorite) {
    const entityId = typeof item.entity_id === "string" ? item.entity_id : null
    if (!entityId) return
    switch (item.entity_type) {
      case 'table':
        router.push(`/tables/${entityId}`)
        break
      case 'interface':
      case 'page':
        router.push(`/pages/${entityId}`)
        break
      case 'view':
        if (item.table_id) {
          router.push(`/tables/${item.table_id}/views/${entityId}`)
        }
        break
    }
  }

  if (loading && favorites.length === 0) {
    return null
  }

  return (
    <>
      {/* Favorites Section */}
      {favorites.length > 0 && (
        <div className="py-2 border-t border-border/50">
          <div className="px-3 mb-1">
            <button
              onClick={() => toggleSection('favorites')}
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-wider hover:bg-black/[0.06] rounded-lg transition-colors"
              style={{ color: sidebarTextColor }}
            >
              <span>Starred</span>
              {expandedSections.has('favorites') ? (
                <ChevronDown className="h-3 w-3 flex-shrink-0" style={{ color: sidebarTextColor }} />
              ) : (
                <ChevronRight className="h-3 w-3 flex-shrink-0" style={{ color: sidebarTextColor }} />
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
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors text-sm hover:bg-black/[0.06] ${isActive ? "bg-black/[0.07] font-medium" : ""}`}
                    style={{ color: sidebarTextColor }}
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

