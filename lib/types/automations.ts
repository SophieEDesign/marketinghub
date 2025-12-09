/**
 * TypeScript types for the Automations Suite
 */

export interface Automation {
  id: string;
  name: string;
  status: 'active' | 'paused';
  trigger: any; // JSON structure - see schema.ts for details
  conditions: any[]; // JSON array - see schema.ts for details
  actions: any[]; // JSON array - see schema.ts for details
  created_at: string;
  updated_at: string;
}

export interface AutomationLog {
  id: string;
  automation_id: string;
  timestamp: string;
  status: 'success' | 'error';
  input?: any;
  output?: any;
  error?: string;
  duration_ms?: number;
}
