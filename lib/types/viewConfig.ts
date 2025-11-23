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
  // View-specific fields
  card_fields?: string[];
  kanban_group_field?: string;
  calendar_date_field?: string;
  timeline_date_field?: string;
  created_at?: string;
  updated_at?: string;
}

