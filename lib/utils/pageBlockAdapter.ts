import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";
import { DashboardBlock } from "@/lib/hooks/useDashboardBlocks";

/**
 * Converts a page block (with config) to a dashboard block (with content)
 * This allows Pages to use the same block components as Dashboard
 */
export function convertPageBlockToDashboardBlock(
  pageBlock: InterfacePageBlock
): DashboardBlock {
  // Map page block types to dashboard block types
  const typeMap: Record<string, string> = {
    text: "text",
    image: "image",
    kpi: "kpi",
    table: "table",
    calendar: "calendar",
    // Map unsupported types to closest match
    grid: "table", // Grid view becomes table block
    list: "table", // List view becomes table block
    gallery: "table", // Gallery view becomes table block
    kanban: "table", // Kanban view becomes table block
    timeline: "table", // Timeline view becomes table block
    chart: "kpi", // Chart becomes KPI block
    html: "html",
    embed: "embed",
  };

  const dashboardType = typeMap[pageBlock.type] || "table"; // Default to table if unknown

  // Convert config to content format
  const config = pageBlock.config || {};
  let content: any = {};

  // Common mappings
  if (config.table) content.table = config.table;
  if (config.fields) content.fields = Array.isArray(config.fields) ? config.fields : config.fields.split(",").map((f: string) => f.trim());
  if (config.filters) content.filters = Array.isArray(config.filters) ? config.filters : [];
  if (config.limit) content.limit = config.limit;

  // Type-specific conversions
  switch (pageBlock.type) {
    case "text":
      content.html = config.textContent || config.content || config.html || "";
      break;
    case "image":
      content.url = config.imageUrl || config.url || "";
      content.caption = config.caption || "";
      break;
    case "kpi":
      content.label = config.label || "KPI";
      content.aggregate = config.aggregate || "count";
      content.field = config.field || "";
      break;
    case "table":
    case "grid":
    case "list":
      // Already handled above
      break;
    case "calendar":
      content.dateField = config.calendar_date_field || config.dateField || "";
      break;
    case "html":
      content.html = config.html || "";
      break;
    case "embed":
      content.url = config.url || config.embedUrl || "";
      content.height = config.height || 400;
      break;
  }

  // Ensure required fields have defaults
  if (!content.title) content.title = "";
  if (!content.limit) content.limit = 3;
  if (!content.filters) content.filters = [];

  return {
    id: pageBlock.id,
    dashboard_id: pageBlock.page_id, // Use page_id as dashboard_id
    type: dashboardType as any,
    content,
    position: pageBlock.position_y || 0, // Legacy position field for backward compatibility
    position_x: pageBlock.position_x || 0,
    position_y: pageBlock.position_y || 0,
    width: pageBlock.width || 3,
    height: pageBlock.height || 3,
    created_at: pageBlock.created_at,
    updated_at: pageBlock.updated_at,
  };
}

/**
 * Converts dashboard block content back to page block config format
 */
export function convertDashboardContentToPageConfig(
  dashboardContent: any,
  originalType: string
): any {
  // Start with all dashboard content fields to preserve everything
  const config: any = { ...dashboardContent };

  // Type-specific field name mappings (for backwards compatibility)
  switch (originalType) {
    case "text":
      // Map html to both textContent and content for compatibility
      if (dashboardContent.html !== undefined) {
        config.textContent = dashboardContent.html;
        config.content = dashboardContent.html;
      }
      break;
    case "image":
      // Map url to both imageUrl and url for compatibility
      if (dashboardContent.url !== undefined) {
        config.imageUrl = dashboardContent.url;
      }
      break;
    case "calendar":
      // Map dateField to both calendar_date_field and dateField for compatibility
      if (dashboardContent.dateField !== undefined) {
        config.calendar_date_field = dashboardContent.dateField;
      }
      break;
    case "embed":
      // Map url to both embedUrl and url for compatibility
      if (dashboardContent.url !== undefined) {
        config.embedUrl = dashboardContent.url;
      }
      break;
  }

  return config;
}

