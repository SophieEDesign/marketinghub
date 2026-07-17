/**
 * Generic Versioning System
 * 
 * Provides versioning capabilities for any entity type (interface, page, view, block, automation).
 * All functions are generic and work with any entity type.
 */

import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

export type EntityType = 'interface' | 'page' | 'view' | 'block' | 'automation'
export type VersionReason = 'manual_save' | 'autosave' | 'rollback' | 'restore'
export type ActivityAction = 'create' | 'update' | 'delete' | 'reorder' | 'publish' | 'unpublish' | 'restore' | 'duplicate'

export interface EntityVersion {
  id: string
  entity_type: EntityType
  entity_id: string
  version_number: number
  snapshot: Record<string, any>
  created_by: string | null
  created_at: string
  reason: VersionReason
}

export interface ActivityLog {
  id: string
  entity_type: EntityType
  entity_id: string
  action: ActivityAction
  metadata: Record<string, any>
  user_id: string | null
  created_at: string
  related_entity_type?: string | null
  related_entity_id?: string | null
}

export interface VersionConfig {
  id: string
  entity_type: EntityType
  entity_id: string
  max_versions: number
  auto_save_enabled: boolean
  auto_save_interval_seconds: number
  created_at: string
  updated_at: string
}

/**
 * Create a new version snapshot for an entity
 */
export async function createVersion(
  entityType: EntityType,
  entityId: string,
  snapshot: Record<string, any>,
  reason: VersionReason = 'manual_save',
  userId?: string
): Promise<EntityVersion> {
  const supabase = await createClient()
  
  // Get current user if not provided
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id
  }

  // Get next version number
  const { data: versionData, error: versionError } = await supabase
    .rpc('get_next_version_number', {
      p_entity_type: entityType,
      p_entity_id: entityId,
    })

  if (versionError) {
    throw new Error(`Failed to get version number: ${versionError.message}`)
  }

  const versionNumber = versionData || 1

  // Create version record
  const { data, error } = await supabase
    .from('entity_versions')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      version_number: versionNumber,
      snapshot,
      created_by: userId || null,
      reason,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create version: ${error.message}`)
  }

  return data as EntityVersion
}

/**
 * Get all versions for an entity, ordered by version number (newest first)
 */
export async function getVersions(
  entityType: EntityType,
  entityId: string,
  limit?: number
): Promise<EntityVersion[]> {
  const supabase = await createClient()

  let query = supabase
    .from('entity_versions')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('version_number', { ascending: false })

  if (limit) {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to get versions: ${error.message}`)
  }

  return (data || []) as EntityVersion[]
}

/**
 * Get a specific version by version number
 */
export async function getVersion(
  entityType: EntityType,
  entityId: string,
  versionNumber: number
): Promise<EntityVersion | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('entity_versions')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('version_number', versionNumber)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    throw new Error(`Failed to get version: ${error.message}`)
  }

  return data as EntityVersion
}

/**
 * Get the latest version for an entity
 */
export async function getLatestVersion(
  entityType: EntityType,
  entityId: string
): Promise<EntityVersion | null> {
  const versions = await getVersions(entityType, entityId, 1)
  return versions.length > 0 ? versions[0] : null
}

/**
 * Restore an entity to a specific version
 * Creates a new version entry with reason 'restore'
 */
export async function restoreVersion(
  entityType: EntityType,
  entityId: string,
  versionNumber: number,
  userId?: string
): Promise<EntityVersion> {
  const version = await getVersion(entityType, entityId, versionNumber)
  
  if (!version) {
    throw new Error(`Version ${versionNumber} not found`)
  }

  // Create a new version with the restored snapshot
  return createVersion(entityType, entityId, version.snapshot, 'restore', userId)
}

/**
 * Log an activity/audit event
 */
export async function logActivity(
  entityType: EntityType,
  entityId: string,
  action: ActivityAction,
  metadata: Record<string, any> = {},
  relatedEntityType?: EntityType,
  relatedEntityId?: string,
  userId?: string
): Promise<ActivityLog> {
  const supabase = await createClient()

  // Get current user if not provided
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id
  }

  const { data, error } = await supabase
    .from('entity_activity_log')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      action,
      metadata,
      user_id: userId || null,
      related_entity_type: relatedEntityType || null,
      related_entity_id: relatedEntityId || null,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to log activity: ${error.message}`)
  }

  return data as ActivityLog
}

/**
 * Get activity log for an entity
 */
export async function getActivityLog(
  entityType: EntityType,
  entityId: string,
  limit: number = 50
): Promise<ActivityLog[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('entity_activity_log')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to get activity log: ${error.message}`)
  }

  return (data || []) as ActivityLog[]
}

/**
 * Get or create version config for an entity
 */
export async function getVersionConfig(
  entityType: EntityType,
  entityId: string
): Promise<VersionConfig> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('entity_version_config')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // Config doesn't exist, create default
      return createDefaultVersionConfig(entityType, entityId)
    }
    throw new Error(`Failed to get version config: ${error.message}`)
  }

  return data as VersionConfig
}

/**
 * Create default version config for an entity
 */
async function createDefaultVersionConfig(
  entityType: EntityType,
  entityId: string
): Promise<VersionConfig> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('entity_version_config')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      max_versions: 25,
      auto_save_enabled: true,
      auto_save_interval_seconds: 60,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create version config: ${error.message}`)
  }

  return data as VersionConfig
}

/**
 * Update version config for an entity
 */
export async function updateVersionConfig(
  entityType: EntityType,
  entityId: string,
  updates: Partial<Pick<VersionConfig, 'max_versions' | 'auto_save_enabled' | 'auto_save_interval_seconds'>>
): Promise<VersionConfig> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('entity_version_config')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update version config: ${error.message}`)
  }

  return data as VersionConfig
}

