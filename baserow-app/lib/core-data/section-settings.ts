/**
 * Section Settings API
 * 
 * Single source of truth for reading and writing section settings.
 * Sections are first-class entities with their own settings.
 */

import { createClient } from '@/lib/supabase/client'
import type { SectionSettings, SectionSettingsUpdate, ValidationResult } from './types'

/**
 * Get section settings
 * 
 * Retrieves section settings by table ID and section name.
 */
export async function getSectionSettings(
  tableId: string,
  sectionName: string
): Promise<SectionSettings | null> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('field_sections')
    .select('*')
    .eq('table_id', tableId)
    .eq('name', sectionName)
    .single()
  
  if (error || !data) {
    // Section might not exist yet (legacy data with group_name but no section record)
    // Return default settings
    return {
      id: '',
      table_id: tableId,
      name: sectionName,
      display_name: sectionName,
      order_index: 0,
      default_collapsed: false,
      default_visible: true,
      permissions: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }
  
  return data as SectionSettings
}

/**
 * Get all sections for a table
 * 
 * Retrieves all sections for a given table, ordered by order_index.
 */
export async function getTableSections(tableId: string): Promise<SectionSettings[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('field_sections')
    .select('*')
    .eq('table_id', tableId)
    .order('order_index', { ascending: true })
  
  if (error || !data) {
    console.error('Error loading table sections:', error)
    return []
  }
  
  return data as SectionSettings[]
}

/**
 * Create or update section settings
 * 
 * Creates a new section or updates an existing one.
 * If the section doesn't exist, it will be created.
 */
export async function upsertSectionSettings(
  tableId: string,
  sectionName: string,
  updates: SectionSettingsUpdate
): Promise<{ success: boolean; section?: SectionSettings; error?: string }> {
  const supabase = createClient()
  
  // Validate updates
  const validation = validateSectionSettings(updates)
  if (!validation.valid) {
    return { success: false, error: validation.errors.join(', ') }
  }
  
  // Check if section exists
  const existing = await getSectionSettings(tableId, sectionName)
  
  if (existing && existing.id) {
    // Update existing section
    const { data, error } = await supabase
      .from('field_sections')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()
    
    if (error) {
      console.error('Error updating section settings:', error)
      return { success: false, error: error.message }
    }
    
    return { success: true, section: data as SectionSettings }
  } else {
    // Create new section
    const { data, error } = await supabase
      .from('field_sections')
      .insert({
        table_id: tableId,
        name: sectionName,
        display_name: updates.display_name || sectionName,
        order_index: updates.order_index ?? 0,
        default_collapsed: updates.default_collapsed ?? false,
        default_visible: updates.default_visible ?? true,
        permissions: updates.permissions || {},
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error creating section settings:', error)
      return { success: false, error: error.message }
    }
    
    return { success: true, section: data as SectionSettings }
  }
}

/**
 * Update section settings
 * 
 * Updates an existing section by ID.
 */
export async function updateSectionSettings(
  sectionId: string,
  updates: SectionSettingsUpdate
): Promise<{ success: boolean; section?: SectionSettings; error?: string }> {
  const supabase = createClient()
  
  // Validate updates
  const validation = validateSectionSettings(updates)
  if (!validation.valid) {
    return { success: false, error: validation.errors.join(', ') }
  }
  
  const { data, error } = await supabase
    .from('field_sections')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sectionId)
    .select()
    .single()
  
  if (error) {
    console.error('Error updating section settings:', error)
    return { success: false, error: error.message }
  }
  
  return { success: true, section: data as SectionSettings }
}

/**
 * Delete section settings
 * 
 * Deletes a section by ID. Note: This does not delete fields with that group_name.
 */
export async function deleteSectionSettings(
  sectionId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('field_sections')
    .delete()
    .eq('id', sectionId)
  
  if (error) {
    console.error('Error deleting section settings:', error)
    return { success: false, error: error.message }
  }
  
  return { success: true }
}

/**
 * Validate section settings
 * 
 * Centralized validation logic for section settings.
 */
export function validateSectionSettings(
  settings: Partial<SectionSettings>
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Validate name
  if (settings.name !== undefined) {
    const trimmed = settings.name.trim()
    if (trimmed.length === 0) {
      errors.push('Section name cannot be empty')
    }
  }
  
  // Validate order_index
  if (settings.order_index !== undefined) {
    if (settings.order_index < 0) {
      errors.push('Section order_index must be >= 0')
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Reorder sections
 * 
 * Updates the order_index for multiple sections at once.
 */
export async function reorderSections(
  tableId: string,
  sectionOrders: Array<{ sectionId: string; order_index: number }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  
  // Update each section's order_index
  const updates = sectionOrders.map(({ sectionId, order_index }) =>
    supabase
      .from('field_sections')
      .update({ order_index, updated_at: new Date().toISOString() })
      .eq('id', sectionId)
  )
  
  const results = await Promise.all(updates)
  
  const errors = results.filter(r => r.error)
  if (errors.length > 0) {
    console.error('Error reordering sections:', errors)
    return { success: false, error: errors[0].error?.message || 'Failed to reorder sections' }
  }
  
  return { success: true }
}

/**
 * Get default section name
 * 
 * Returns the default section name for fields without a group_name.
 */
export function getDefaultSectionName(): string {
  return 'General'
}

/**
 * Ensure section exists
 * 
 * Ensures a section exists in the database for a given table and section name.
 * If it doesn't exist, creates it with default settings.
 */
export async function ensureSectionExists(
  tableId: string,
  sectionName: string
): Promise<SectionSettings> {
  const existing = await getSectionSettings(tableId, sectionName)
  
  if (existing && existing.id) {
    return existing
  }
  
  // Create section with default settings
  const result = await upsertSectionSettings(tableId, sectionName, {
    display_name: sectionName,
    order_index: 0,
    default_collapsed: false,
    default_visible: true,
  })
  
  if (!result.success || !result.section) {
    throw new Error(`Failed to create section: ${result.error}`)
  }
  
  return result.section
}
