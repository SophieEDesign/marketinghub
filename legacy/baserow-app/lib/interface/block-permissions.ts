/**
 * Block-level permissions utilities
 * 
 * These functions help enforce block-level permissions for record operations.
 * Permissions are stored in block.config.permissions
 */

import type { BlockConfig } from "./types"

export interface BlockPermissions {
  mode?: 'view' | 'edit'
  allowInlineCreate?: boolean
  allowInlineDelete?: boolean
  allowOpenRecord?: boolean
}

/**
 * Get permissions from block config with defaults
 */
export function getBlockPermissions(config: BlockConfig | undefined): BlockPermissions {
  const permissions = config?.permissions || {}
  return {
    mode: permissions.mode || 'edit',
    allowInlineCreate: permissions.allowInlineCreate ?? true,
    allowInlineDelete: permissions.allowInlineDelete ?? true,
    allowOpenRecord: permissions.allowOpenRecord ?? true,
  }
}

/**
 * Check if block allows editing (not view-only)
 */
export function canEditBlock(config: BlockConfig | undefined): boolean {
  const perms = getBlockPermissions(config)
  return perms.mode === 'edit'
}

/**
 * Check if block allows inline record creation
 */
export function canCreateRecords(config: BlockConfig | undefined): boolean {
  const perms = getBlockPermissions(config)
  return perms.mode === 'edit' && (perms.allowInlineCreate ?? true)
}

/**
 * Check if block allows inline record deletion
 */
export function canDeleteRecords(config: BlockConfig | undefined): boolean {
  const perms = getBlockPermissions(config)
  return perms.mode === 'edit' && (perms.allowInlineDelete ?? true)
}

/**
 * Check if block allows opening record details
 */
export function canOpenRecords(config: BlockConfig | undefined): boolean {
  const perms = getBlockPermissions(config)
  return perms.allowOpenRecord ?? true
}

/**
 * Server-side: Get block config from database and check permissions
 * This should be used in API routes to enforce permissions
 */
export async function checkBlockPermissions(
  supabase: any,
  blockId: string,
  operation: 'create' | 'update' | 'delete' | 'open'
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Get block from database
    const { data: block, error } = await supabase
      .from('view_blocks')
      .select('config')
      .eq('id', blockId)
      .single()

    if (error || !block) {
      return { allowed: false, reason: 'Block not found' }
    }

    const config = block.config || {}
    const permissions = getBlockPermissions(config)

    // Check permissions based on operation
    switch (operation) {
      case 'create':
        if (permissions.mode === 'view') {
          return { allowed: false, reason: 'Block is view-only' }
        }
        if (!permissions.allowInlineCreate) {
          return { allowed: false, reason: 'Inline creation not allowed' }
        }
        return { allowed: true }

      case 'update':
        if (permissions.mode === 'view') {
          return { allowed: false, reason: 'Block is view-only' }
        }
        return { allowed: true }

      case 'delete':
        if (permissions.mode === 'view') {
          return { allowed: false, reason: 'Block is view-only' }
        }
        if (!permissions.allowInlineDelete) {
          return { allowed: false, reason: 'Inline deletion not allowed' }
        }
        return { allowed: true }

      case 'open':
        if (!permissions.allowOpenRecord) {
          return { allowed: false, reason: 'Record details access not allowed' }
        }
        return { allowed: true }

      default:
        return { allowed: false, reason: 'Unknown operation' }
    }
  } catch (error: any) {
    console.error('Error checking block permissions:', error)
    return { allowed: false, reason: 'Error checking permissions' }
  }
}
