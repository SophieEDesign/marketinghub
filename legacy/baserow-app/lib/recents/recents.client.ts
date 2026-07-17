/**
 * Client-side recents and favorites utilities
 */

import type { EntityType, RecentItem, Favorite } from './recents'

/**
 * Record recent item (client-side)
 */
export async function recordRecentItemClient(
  entityType: EntityType,
  entityId: string
): Promise<void> {
  const response = await fetch('/api/recents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entity_type: entityType,
      entity_id: entityId,
    }),
  })

  if (!response.ok) {
    console.error('Failed to record recent item')
  }
}

/**
 * Get recent items (client-side)
 */
export async function getRecentItemsClient(
  limit: number = 10,
  entityType?: EntityType
): Promise<RecentItem[]> {
  const params = new URLSearchParams({
    limit: limit.toString(),
  })
  if (entityType) {
    params.append('entity_type', entityType)
  }

  const response = await fetch(`/api/recents?${params.toString()}`)

  if (!response.ok) {
    console.error('Failed to get recent items')
    return []
  }

  const json = await response.json()
  return Array.isArray(json) ? json : (json?.items || [])
}

/**
 * Add favorite (client-side)
 */
export async function addFavoriteClient(
  entityType: EntityType,
  entityId: string
): Promise<Favorite> {
  const response = await fetch('/api/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entity_type: entityType,
      entity_id: entityId,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to add favorite')
  }

  return response.json()
}

/**
 * Remove favorite (client-side)
 */
export async function removeFavoriteClient(
  entityType: EntityType,
  entityId: string
): Promise<void> {
  const response = await fetch('/api/favorites', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entity_type: entityType,
      entity_id: entityId,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to remove favorite')
  }
}

/**
 * Get favorites (client-side)
 */
export async function getFavoritesClient(
  limit: number = 50,
  entityType?: EntityType
): Promise<Favorite[]> {
  const params = new URLSearchParams({
    limit: limit.toString(),
  })
  if (entityType) {
    params.append('entity_type', entityType)
  }

  const response = await fetch(`/api/favorites?${params.toString()}`)

  if (!response.ok) {
    console.error('Failed to get favorites')
    return []
  }

  const json = await response.json()
  return Array.isArray(json) ? json : (json?.items || [])
}

/**
 * Check if favorited (client-side)
 */
export async function isFavoritedClient(
  entityType: EntityType,
  entityId: string
): Promise<boolean> {
  const params = new URLSearchParams({
    entity_type: entityType,
    entity_id: entityId,
  })

  const response = await fetch(`/api/favorites/check?${params.toString()}`)

  if (!response.ok) {
    return false
  }

  const { favorited } = await response.json()
  return favorited === true
}

