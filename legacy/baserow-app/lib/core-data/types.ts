/**
 * Core Data Types
 * 
 * These types define the canonical structure for field settings, section settings,
 * and block defaults. This is the single source of truth for how settings are
 * structured and validated.
 */

import type { FieldType, FieldOptions, TableField } from '@/types/fields'

/**
 * Canonical Field Settings
 * 
 * This represents the complete field settings structure as stored in core data.
 * All field editing components should use this structure.
 */
export interface CanonicalFieldSettings {
  // Identity (core data)
  id: string
  name: string
  label?: string | null
  type: FieldType
  
  // Behavior (core data)
  required: boolean
  read_only: boolean
  default_value: any
  
  // Validation (core data)
  // Note: validation_rules can be added in the future
  // validation_rules?: ValidationRule[]
  
  // UX Metadata (core data)
  // Note: help_text, placeholder, error_message can be added to options JSONB
  // help_text?: string
  // placeholder?: string
  // error_message?: string
  
  // Display Behavior (core data)
  // Note: default_visibility and supports_pills are derived from type
  // default_visibility: 'visible' | 'hidden' | 'conditional'
  // supports_pills: boolean  // Derived from type, but can be explicit
  
  // Grouping (core data)
  group_name?: string | null
  
  // Relationships (core data)
  // Note: depends_on and drives_fields can be added in the future
  // depends_on?: string[]  // Field names this depends on
  // drives_fields?: string[]  // Fields this drives
  
  // Type-specific options (core data)
  options: FieldOptions
  
  // Metadata
  position: number
  order_index?: number
  created_at: string
  updated_at?: string
}

/**
 * Section Settings
 * 
 * Represents section-level configuration for field groupings.
 */
export interface SectionSettings {
  id: string
  table_id: string
  name: string
  display_name?: string | null
  order_index: number
  default_collapsed: boolean
  default_visible: boolean
  permissions?: Record<string, any>
  created_at: string
  updated_at?: string
}

/**
 * Validation Result
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Field Settings Update
 * 
 * Partial update to field settings. Only specified fields will be updated.
 */
export type FieldSettingsUpdate = Partial<Omit<CanonicalFieldSettings, 'id' | 'created_at' | 'updated_at'>>

/**
 * Section Settings Update
 * 
 * Partial update to section settings.
 */
export type SectionSettingsUpdate = Partial<Omit<SectionSettings, 'id' | 'table_id' | 'created_at' | 'updated_at'>>
