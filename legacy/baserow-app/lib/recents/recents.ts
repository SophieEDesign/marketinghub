/**
 * Recents and Favorites Management
 * 
 * Provides functions to track and retrieve recently viewed items and favorites
 */

import { createClient } from '@/lib/supabase/server'

export type EntityType = 'table' | 'page' | 'view' | 'interface' | 'block' | 'automation'

export interface RecentItem {
  id: string
  user_id: string
  entity_type: EntityType
  entity_id: string
  last_opened_at: string
  name?: string // Populated from entity lookup
  table_id?: string // For views
}

export interface Favorite {
  id: string
  user_id: string
  entity_type: EntityType
  entity_id: string
  created_at: string
  name?: string // Populated from entity lookup
  table_id?: string // For views
}

/**
 * Record that a user opened/viewed an entity
 */
export async function recordRecentItem(
  entityType: EntityType,
  entityId: string,
  userId?: string
): Promise<void> {
  const supabase = await createClient()
  
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id
  }

  if (!userId) return

  const { error } = await supabase.rpc('upsert_recent_item', {
    p_user_id: userId,
    p_entity_type: entityType,
    p_entity_id: entityId,
  })

  if (error) {
    console.error('Failed to record recent item:', error)
  }
}

/**
 * Get recent items for a user
 */
export async function getRecentItems(
  limit: number = 10,
  entityType?: EntityType,
  userId?: string
): Promise<RecentItem[]> {
  const supabase = await createClient()

  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id
  }

  if (!userId) return []

  let query = supabase
    .from('recent_items')
    .select('*')
    .eq('user_id', userId)
    .order('last_opened_at', { ascending: false })
    .limit(limit)

  if (entityType) {
    query = query.eq('entity_type', entityType)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to get recent items:', error)
    return []
  }

  // Enrich with entity names
  const enriched = await Promise.all(
    (data || []).map(async (item) => {
      const enrichedItem: RecentItem = { ...item }
      
      try {
        switch (item.entity_type) {
          case 'table':
            const { data: table } = await supabase
              .from('tables')
              .select('name')
              .eq('id', item.entity_id)
              .single()
            if (table) enrichedItem.name = table.name
            break
          case 'interface':
          case 'page':
            // New system: interface pages live in interface_pages (do NOT filter out archived/historic pages)
            // Legacy fallback: some historic pages may still exist as rows in views.
            {
              const { data: interfacePage } = await supabase
                .from('interface_pages')
                .select('name')
                .eq('id', item.entity_id)
                .maybeSingle()

              if (interfacePage?.name) {
                enrichedItem.name = interfacePage.name
                break
              }

              const { data: legacyView } = await supabase
                .from('views')
                .select('name, table_id')
                .eq('id', item.entity_id)
                .maybeSingle()

              if (legacyView) {
                enrichedItem.name = legacyView.name
                enrichedItem.table_id = legacyView.table_id || undefined
              }
            }
            break
          case 'view':
            {
              const { data: view } = await supabase
                .from('views')
                .select('name, table_id')
                .eq('id', item.entity_id)
                .maybeSingle()

              if (view) {
                enrichedItem.name = view.name
                enrichedItem.table_id = view.table_id || undefined
              }
            }
            break
        }
      } catch (err) {
        // Ignore errors - name is optional
      }

      return enrichedItem
    })
  )

  return enriched
}

/**
 * Add an item to favorites
 */
export async function addFavorite(
  entityType: EntityType,
  entityId: string,
  userId?: string
): Promise<Favorite> {
  const supabase = await createClient()

  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id
  }

  if (!userId) {
    throw new Error('User not authenticated')
  }

  const { data, error } = await supabase
    .from('favorites')
    .insert({
      user_id: userId,
      entity_type: entityType,
      entity_id: entityId,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to add favorite: ${error.message}`)
  }

  return data as Favorite
}

/**
 * Remove an item from favorites
 */
export async function removeFavorite(
  entityType: EntityType,
  entityId: string,
  userId?: string
): Promise<void> {
  const supabase = await createClient()

  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id
  }

  if (!userId) {
    throw new Error('User not authenticated')
  }

  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)

  if (error) {
    throw new Error(`Failed to remove favorite: ${error.message}`)
  }
}

/**
 * Check if an item is favorited
 */
export async function isFavorited(
  entityType: EntityType,
  entityId: string,
  userId?: string
): Promise<boolean> {
  const supabase = await createClient()

  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id
  }

  if (!userId) return false

  const { data, error } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle()

  if (error) {
    console.error('Failed to check favorite:', error)
    return false
  }

  return !!data
}

/**
 * Get favorites for a user
 */
export async function getFavorites(
  limit: number = 50,
  entityType?: EntityType,
  userId?: string
): Promise<Favorite[]> {
  const supabase = await createClient()

  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id
  }

  if (!userId) return []

  let query = supabase
    .from('favorites')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (entityType) {
    query = query.eq('entity_type', entityType)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to get favorites:', error)
    return []
  }

  // Enrich with entity names
  const enriched = await Promise.all(
    (data || []).map(async (item) => {
      const enrichedItem: Favorite = { ...item }
      
      try {
        switch (item.entity_type) {
          case 'table':
            const { data: table } = await supabase
              .from('tables')
              .select('name')
              .eq('id', item.entity_id)
              .single()
            if (table) enrichedItem.name = table.name
            break
          case 'interface':
          case 'page':
            // New system: interface pages live in interface_pages (do NOT filter out archived/historic pages)
            // Legacy fallback: some historic pages may still exist as rows in views.
            {
              const { data: interfacePage } = await supabase
                .from('interface_pages')
                .select('name')
                .eq('id', item.entity_id)
                .maybeSingle()

              if (interfacePage?.name) {
                enrichedItem.name = interfacePage.name
                break
              }

              const { data: legacyView } = await supabase
                .from('views')
                .select('name, table_id')
                .eq('id', item.entity_id)
                .maybeSingle()

              if (legacyView) {
                enrichedItem.name = legacyView.name
                enrichedItem.table_id = legacyView.table_id || undefined
              }
            }
            break
          case 'view':
            {
              const { data: view } = await supabase
                .from('views')
                .select('name, table_id')
                .eq('id', item.entity_id)
                .maybeSingle()

              if (view) {
                enrichedItem.name = view.name
                enrichedItem.table_id = view.table_id || undefined
              }
            }
            break
        }
      } catch (err) {
        // Ignore errors - name is optional
      }

      return enrichedItem
    })
  )

  return enriched
}

