import {
  FileText,
  Megaphone,
  Users,
  Lightbulb,
  Newspaper,
  CheckSquare,
  BookOpen,
  Gift,
  Compass,
  Image,
  Contact,
} from "lucide-react";

export interface TableField {
  id: string;
  label: string;
  type: "text" | "longtext" | "select" | "multi-select" | "date" | "number" | "boolean" | "user" | "relation" | "image" | "file" | "color" | "attachment";
  table?: string; // For relation fields
  required?: boolean;
  options?: string[]; // For select/multi-select
}

export interface LinkedFromRelation {
  table: string;
  field: string;
}

export interface TableMetadata {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultView: "grid" | "kanban" | "calendar" | "timeline" | "cards";
  views: ("grid" | "kanban" | "calendar" | "timeline" | "cards")[];
  fields: TableField[];
  linkedFrom?: LinkedFromRelation[];
  deleteAllowed?: boolean;
}

export const tableMetadata: Record<string, TableMetadata> = {
  content: {
    label: "Content",
    icon: FileText,
    defaultView: "grid",
    views: ["grid", "kanban", "calendar", "timeline", "cards"],
    fields: [
      { id: "title", label: "Title", type: "text", required: true },
      { id: "status", label: "Status", type: "select" },
      { id: "content_type", label: "Content Type", type: "select" },
      { id: "channels", label: "Channels", type: "multi-select" },
      { id: "publish_date", label: "Publish Date", type: "date" },
      { id: "description", label: "Description", type: "longtext" },
      { id: "assigned_to", label: "Assigned To", type: "user" },
      { id: "campaign_id", label: "Campaign", type: "relation", table: "campaigns" },
      { id: "thumbnail_url", label: "Thumbnail", type: "image" },
    ],
    linkedFrom: [
      { table: "tasks", field: "content_id" },
      { table: "media", field: "content_id" },
      { table: "briefings", field: "content_id" },
      { table: "assets", field: "content_id" },
    ],
  },
  campaigns: {
    label: "Campaigns",
    icon: Megaphone,
    defaultView: "grid",
    views: ["grid", "kanban", "calendar", "cards"],
    fields: [
      { id: "name", label: "Name", type: "text", required: true },
      { id: "description", label: "Description", type: "longtext" },
      { id: "status", label: "Status", type: "select" },
      { id: "colour", label: "Colour", type: "color" },
      { id: "start_date", label: "Start Date", type: "date" },
      { id: "end_date", label: "End Date", type: "date" },
    ],
    linkedFrom: [
      { table: "content", field: "campaign_id" },
    ],
  },
  contacts: {
    label: "Contacts",
    icon: Users,
    defaultView: "grid",
    views: ["grid", "cards"],
    fields: [
      { id: "name", label: "Name", type: "text", required: true },
      { id: "email", label: "Email", type: "text" },
      { id: "phone", label: "Phone", type: "text" },
      { id: "company", label: "Company", type: "text" },
      { id: "notes", label: "Notes", type: "longtext" },
    ],
  },
  ideas: {
    label: "Ideas",
    icon: Lightbulb,
    defaultView: "grid",
    views: ["grid", "kanban", "cards"],
    fields: [
      { id: "title", label: "Title", type: "text", required: true },
      { id: "description", label: "Description", type: "longtext" },
      { id: "category", label: "Category", type: "text" },
      { id: "status", label: "Status", type: "select" },
    ],
  },
  media: {
    label: "Media",
    icon: Newspaper,
    defaultView: "grid",
    views: ["grid", "calendar", "cards"],
    fields: [
      { id: "publication", label: "Publication", type: "text" },
      { id: "url", label: "URL", type: "text" },
      { id: "date", label: "Date", type: "date" },
      { id: "notes", label: "Notes", type: "longtext" },
      { id: "content_id", label: "Content", type: "relation", table: "content" },
    ],
  },
  tasks: {
    label: "Tasks",
    icon: CheckSquare,
    defaultView: "grid",
    views: ["grid", "kanban", "calendar", "timeline"],
    deleteAllowed: true,
    fields: [
      { id: "title", label: "Title", type: "text", required: true },
      { id: "description", label: "Description", type: "longtext" },
      { id: "status", label: "Status", type: "select" },
      { id: "due_date", label: "Due Date", type: "date" },
      { id: "assigned_to", label: "Assigned To", type: "user" },
      { id: "content_id", label: "Content", type: "relation", table: "content" },
    ],
  },
  briefings: {
    label: "Briefings",
    icon: BookOpen,
    defaultView: "grid",
    views: ["grid", "cards"],
    fields: [
      { id: "title", label: "Title", type: "text", required: true },
      { id: "notes", label: "Notes", type: "longtext" },
      { id: "content_id", label: "Content", type: "relation", table: "content" },
    ],
  },
  sponsorships: {
    label: "Sponsorships",
    icon: Gift,
    defaultView: "grid",
    views: ["grid", "calendar", "cards"],
    fields: [
      { id: "name", label: "Name", type: "text", required: true },
      { id: "notes", label: "Notes", type: "longtext" },
      { id: "start_date", label: "Start Date", type: "date" },
      { id: "end_date", label: "End Date", type: "date" },
    ],
  },
  strategy: {
    label: "Strategy",
    icon: Compass,
    defaultView: "grid",
    views: ["grid", "cards"],
    fields: [
      { id: "title", label: "Title", type: "text", required: true },
      { id: "details", label: "Details", type: "longtext" },
      { id: "category", label: "Category", type: "text" },
    ],
  },
  assets: {
    label: "Assets",
    icon: Image,
    defaultView: "grid",
    views: ["grid", "cards"],
    fields: [
      { id: "filename", label: "Filename", type: "text" },
      { id: "file_url", label: "File URL", type: "file" },
      { id: "asset_type", label: "Asset Type", type: "text" },
      { id: "content_id", label: "Content", type: "relation", table: "content" },
    ],
  },
};

export function getTableMetadata(tableId: string): TableMetadata | undefined {
  return tableMetadata[tableId];
}

export async function getAllTablesFromDB(): Promise<string[]> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return Object.keys(tableMetadata);
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase
      .from("table_metadata")
      .select("table_name");
    
    if (error || !data) {
      // Fallback to hardcoded list if database query fails
      return Object.keys(tableMetadata);
    }
    
    // Merge database tables with hardcoded tables (for backward compatibility)
    const dbTables = data.map((row) => row.table_name);
    const hardcodedTables = Object.keys(tableMetadata);
    const allTables = [...new Set([...hardcodedTables, ...dbTables])];
    return allTables;
  } catch (error) {
    console.warn("Error fetching tables from database, using hardcoded list:", error);
    return Object.keys(tableMetadata);
  }
}

export function getAllTables(): string[] {
  // This is the synchronous version for backward compatibility
  // For dynamic loading, use getAllTablesFromDB() instead
  return Object.keys(tableMetadata);
}

export function getTableIcon(tableId: string) {
  return tableMetadata[tableId]?.icon || FileText;
}

export function getTableLabel(tableId: string): string {
  return tableMetadata[tableId]?.label || tableId;
}

export function getTableViews(tableId: string): string[] {
  return tableMetadata[tableId]?.views || ["grid"];
}

export function isValidViewForTable(tableId: string, viewId: string): boolean {
  const views = getTableViews(tableId);
  return views.includes(viewId as any);
}

