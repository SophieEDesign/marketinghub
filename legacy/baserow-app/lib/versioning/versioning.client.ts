/**
 * Client-side versioning utilities
 * These use the browser Supabase client
 */

import { createClient } from '@/lib/supabase/client'
import type { EntityType, VersionReason, ActivityAction, EntityVersion, ActivityLog } from './versioning'

/**
 * Create a version snapshot (client-side)
 */
export async function createVersionClient(
  entityType: EntityType,
  entityId: string,
  snapshot: Record<string, any>,
  reason: VersionReason = 'manual_save'
): Promise<EntityVersion> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const response = await fetch('/api/versioning/versions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entity_type: entityType,
      entity_id: entityId,
      snapshot,
      reason,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to create version')
  }

  return response.json()
}

/**
 * Get versions for an entity (client-side)
 */
export async function getVersionsClient(
  entityType: EntityType,
  entityId: string,
  limit?: number
): Promise<EntityVersion[]> {
  const params = new URLSearchParams({
    entity_type: entityType,
    entity_id: entityId,
  })
  if (limit) {
    params.append('limit', limit.toString())
  }

  const response = await fetch(`/api/versioning/versions?${params.toString()}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to get versions')
  }

  return response.json()
}

/**
 * Restore a version (client-side)
 */
export async function restoreVersionClient(
  entityType: EntityType,
  entityId: string,
  versionNumber: number
): Promise<EntityVersion> {
  const response = await fetch('/api/versioning/versions/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entity_type: entityType,
      entity_id: entityId,
      version_number: versionNumber,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to restore version')
  }

  return response.json()
}

/**
 * Log activity (client-side)
 */
export async function logActivityClient(
  entityType: EntityType,
  entityId: string,
  action: ActivityAction,
  metadata: Record<string, any> = {},
  relatedEntityType?: EntityType,
  relatedEntityId?: string
): Promise<ActivityLog> {
  const response = await fetch('/api/versioning/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entity_type: entityType,
      entity_id: entityId,
      action,
      metadata,
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to log activity')
  }

  return response.json()
}

/**
 * Get activity log (client-side)
 */
export async function getActivityLogClient(
  entityType: EntityType,
  entityId: string,
  limit: number = 50
): Promise<ActivityLog[]> {
  const params = new URLSearchParams({
    entity_type: entityType,
    entity_id: entityId,
    limit: limit.toString(),
  })

  const response = await fetch(`/api/versioning/activity?${params.toString()}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to get activity log')
  }

  return response.json()
}

