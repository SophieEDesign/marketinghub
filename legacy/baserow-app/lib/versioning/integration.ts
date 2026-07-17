/**
 * Versioning Integration Helpers
 * 
 * Provides helper functions to integrate versioning into entity save flows
 */

import { createVersion, logActivity } from './versioning'
import type { EntityType, ActivityAction } from './versioning'

/**
 * Create a version snapshot when saving an entity
 * Should be called after successful save operations
 */
export async function createVersionOnSave(
  entityType: EntityType,
  entityId: string,
  snapshot: Record<string, any>,
  reason: 'manual_save' | 'autosave' = 'manual_save'
): Promise<void> {
  try {
    await createVersion(entityType, entityId, snapshot, reason)
    
    // Log activity
    await logActivity(entityType, entityId, 'update', {
      reason,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    // Don't throw - versioning failures shouldn't break saves
    console.error('Failed to create version:', error)
  }
}

/**
 * Log activity for block operations
 */
export async function logBlockActivity(
  pageId: string,
  action: ActivityAction,
  blockId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await logActivity(
      'page',
      pageId,
      action,
      {
        ...metadata,
        block_id: blockId,
      },
      blockId ? 'block' : undefined,
      blockId || undefined
    )
  } catch (error) {
    console.error('Failed to log block activity:', error)
  }
}

/**
 * Create snapshot from page state (blocks + layout)
 */
export function createPageSnapshot(blocks: any[], layout?: any[]): Record<string, any> {
  return {
    blocks: blocks.map((block) => ({
      id: block.id,
      type: block.type,
      x: block.x,
      y: block.y,
      w: block.w,
      h: block.h,
      config: block.config,
    })),
    layout: layout || blocks.map((block) => ({
      i: block.id,
      x: block.x,
      y: block.y,
      w: block.w,
      h: block.h,
    })),
    timestamp: new Date().toISOString(),
  }
}

