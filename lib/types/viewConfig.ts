export interface ViewConfig {
  id: string;
  table_name: string;
  view_name: string;
  view_type: "grid" | "kanban" | "calendar" | "timeline" | "cards";
  column_order: string[];
  column_widths: Record<string, number>;
  hidden_columns: string[];
  filters: any[];
  sort: any[];
  groupings: Array<{ name: string; fields: string[] }>;
  row_height: "compact" | "medium" | "tall";
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

