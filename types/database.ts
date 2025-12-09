/**
 * Database type definitions for Supabase
 * 
 * This file defines TypeScript types for all database tables.
 * For automations tables, these types match the schema defined in
 * supabase-automations-foundation.sql
 */

// Legacy row types (kept for backward compatibility)
export type ContentRow = any;
export type CampaignRow = any;
export type TaskRow = any;
export type MediaRow = any;
export type AssetRow = any;
export type ContactRow = any;
export type SponsorshipRow = any;
export type IdeaRow = any;
export type BriefingRow = any;
export type StrategyRow = any;

// ============================================
// AUTOMATIONS SUITE TYPES
// ============================================

/**
 * Automation table row type
 */
export interface AutomationRow {
  id: string;
  name: string;
  status: 'active' | 'paused';
  trigger: any; // JSONB - see lib/automations/schema.ts for structure
  conditions: any[]; // JSONB array - see lib/automations/schema.ts for structure
  actions: any[]; // JSONB array - see lib/automations/schema.ts for structure
  created_at: string;
  updated_at: string;
}

/**
 * Automation table insert type (omits auto-generated fields)
 */
export interface AutomationInsert {
  name: string;
  status?: 'active' | 'paused'; // Defaults to 'active'
  trigger: any;
  conditions?: any[]; // Defaults to []
  actions: any[];
  created_at?: string; // Auto-generated
  updated_at?: string; // Auto-generated
}

/**
 * Automation table update type (all fields optional except id)
 */
export interface AutomationUpdate {
  name?: string;
  status?: 'active' | 'paused';
  trigger?: any;
  conditions?: any[];
  actions?: any[];
  updated_at?: string; // Auto-updated by trigger
}

/**
 * Automation log table row type
 */
export interface AutomationLogRow {
  id: string;
  automation_id: string;
  timestamp: string;
  status: 'success' | 'error';
  input?: any; // JSONB
  output?: any; // JSONB
  error?: string;
  duration_ms?: number;
}

/**
 * Automation log table insert type (omits auto-generated fields)
 */
export interface AutomationLogInsert {
  automation_id: string;
  timestamp?: string; // Defaults to NOW()
  status: 'success' | 'error';
  input?: any;
  output?: any;
  error?: string;
  duration_ms?: number;
}

/**
 * Automation log table update type (all fields optional except id)
 */
export interface AutomationLogUpdate {
  automation_id?: string;
  timestamp?: string;
  status?: 'success' | 'error';
  input?: any;
  output?: any;
  error?: string;
  duration_ms?: number;
}

// ============================================
// SUPABASE DATABASE INTERFACE
// ============================================

/**
 * Main Database interface following Supabase type structure
 * This allows typed access to tables via supabase.from('table_name')
 */
export interface Database {
  public: {
    Tables: {
      automations: {
        Row: AutomationRow;
        Insert: AutomationInsert;
        Update: AutomationUpdate;
      };
      automation_logs: {
        Row: AutomationLogRow;
        Insert: AutomationLogInsert;
        Update: AutomationLogUpdate;
      };
      // Add other tables here as needed
      // tables: { ... };
      // table_fields: { ... };
      // etc.
    };
    Views: {
      // Views can be added here if needed
      [_ in never]: never;
    };
    Functions: {
      // Functions can be added here if needed
      [_ in never]: never;
    };
    Enums: {
      // Enums can be added here if needed
      [_ in never]: never;
    };
  };
}
