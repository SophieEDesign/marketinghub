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
    html: "html",
    embed: "embed",
  };

  const dashboardType = typeMap[pageBlock.type] || pageBlock.type;

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
  const config: any = {};

  // Common mappings
  if (dashboardContent.table) config.table = dashboardContent.table;
  if (dashboardContent.fields) config.fields = dashboardContent.fields;
  if (dashboardContent.filters) config.filters = dashboardContent.filters;
  if (dashboardContent.limit) config.limit = dashboardContent.limit;

  // Type-specific conversions
  switch (originalType) {
    case "text":
      config.textContent = dashboardContent.html || "";
      config.content = dashboardContent.html || "";
      break;
    case "image":
      config.imageUrl = dashboardContent.url || "";
      config.url = dashboardContent.url || "";
      config.caption = dashboardContent.caption || "";
      break;
    case "kpi":
      config.label = dashboardContent.label || "KPI";
      config.aggregate = dashboardContent.aggregate || "count";
      config.field = dashboardContent.field || "";
      break;
    case "calendar":
      config.calendar_date_field = dashboardContent.dateField || "";
      config.dateField = dashboardContent.dateField || "";
      break;
    case "html":
      config.html = dashboardContent.html || "";
      break;
    case "embed":
      config.url = dashboardContent.url || "";
      config.embedUrl = dashboardContent.url || "";
      config.height = dashboardContent.height || 400;
      break;
  }

  return config;
}

