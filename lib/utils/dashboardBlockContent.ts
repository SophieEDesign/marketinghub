/**
 * Dashboard Block Content Schema Validator
 * Ensures all block types have valid content structures
 */

export type BlockType = "text" | "image" | "embed" | "kpi" | "table" | "calendar" | "html";

// Universal content structure - all blocks support these fields
export interface UniversalBlockContent {
  title?: string;
  limit?: number;
  filters?: Array<{ field: string; operator: string; value: string }>;
  table?: string;
  fields?: string[];
  aggregate?: string;
  dateField?: string;
  html?: string;
  url?: string;
  caption?: string;
  maxHeight?: number;
  style?: string;
  height?: number;
  field?: string; // For KPI blocks when aggregate != count
}

export interface BlockContentSchemas {
  text: UniversalBlockContent & { html: string; maxHeight?: number };
  image: UniversalBlockContent & { url: string; caption: string; style?: string };
  embed: UniversalBlockContent & { url: string; height?: number };
  kpi: UniversalBlockContent & { table: string; label?: string; aggregate: string; field?: string };
  table: UniversalBlockContent & { table: string; fields: string[]; limit: number };
  calendar: UniversalBlockContent & { table: string; dateField: string; limit: number };
  html: UniversalBlockContent & { html: string; height?: number };
}

/**
 * Get default content for a block type
 * All blocks now support: title, limit, filters, table, fields
 */
export function getDefaultContentForType(type: BlockType): BlockContentSchemas[BlockType] {
  const baseDefaults: UniversalBlockContent = {
    title: "",
    limit: 3,
    filters: [],
    table: "",
    fields: [],
  };

  switch (type) {
    case "text":
      return { ...baseDefaults, html: "", maxHeight: 200 } as BlockContentSchemas["text"];
    case "image":
      return { ...baseDefaults, url: "", caption: "", style: "contain" } as BlockContentSchemas["image"];
    case "embed":
      return { ...baseDefaults, url: "", height: 400 } as BlockContentSchemas["embed"];
    case "kpi":
      return { ...baseDefaults, table: "", label: "Total Records", aggregate: "count" } as BlockContentSchemas["kpi"];
    case "table":
      return { ...baseDefaults, table: "", fields: [], limit: 3 } as BlockContentSchemas["table"];
    case "calendar":
      return { ...baseDefaults, table: "", dateField: "publish_date", limit: 10 } as BlockContentSchemas["calendar"];
    case "html":
      return { ...baseDefaults, html: "", height: 400 } as BlockContentSchemas["html"];
    default:
      return baseDefaults as any;
  }
}

/**
 * Get default content structure (for useDashboardBlocks)
 */
export function getDefaultContent(type: string): UniversalBlockContent {
  return {
    title: "",
    limit: 3,
    filters: [],
    table: "",
    fields: [],
    aggregate: "",
    dateField: "",
    html: "",
    url: "",
    caption: "",
    maxHeight: 200,
    style: "contain",
    height: 400,
  };
}

/**
 * Validate and fix content for a block type
 */
export function validateAndFixContent(
  type: BlockType,
  content: any
): BlockContentSchemas[BlockType] {
  if (!content || typeof content !== "object") {
    return getDefaultContentForType(type);
  }

  switch (type) {
    case "text": {
      const defaultContent = getDefaultContentForType("text") as BlockContentSchemas["text"];
      return {
        html: content.html !== undefined ? String(content.html) : defaultContent.html,
      } as BlockContentSchemas[BlockType];
    }
    case "image": {
      const defaultContent = getDefaultContentForType("image") as BlockContentSchemas["image"];
      return {
        url: content.url !== undefined ? String(content.url) : defaultContent.url,
        caption: content.caption !== undefined ? String(content.caption) : defaultContent.caption,
      } as BlockContentSchemas[BlockType];
    }
    case "embed": {
      const defaultContent = getDefaultContentForType("embed") as BlockContentSchemas["embed"];
      return {
        url: content.url !== undefined ? String(content.url) : defaultContent.url,
      } as BlockContentSchemas[BlockType];
    }
    case "kpi": {
      const defaultContent = getDefaultContentForType("kpi") as BlockContentSchemas["kpi"];
      return {
        table: content.table !== undefined ? String(content.table) : defaultContent.table,
        label: content.label !== undefined ? String(content.label) : defaultContent.label,
        filter: content.filter !== undefined ? String(content.filter) : defaultContent.filter,
        aggregate: content.aggregate !== undefined ? String(content.aggregate) : defaultContent.aggregate,
      } as BlockContentSchemas[BlockType];
    }
    case "table": {
      const defaultContent = getDefaultContentForType("table") as BlockContentSchemas["table"];
      return {
        table: content.table !== undefined ? String(content.table) : defaultContent.table,
        fields: Array.isArray(content.fields) ? content.fields.map(String) : defaultContent.fields,
        limit: typeof content.limit === "number" ? content.limit : defaultContent.limit,
      } as BlockContentSchemas[BlockType];
    }
    case "calendar": {
      const defaultContent = getDefaultContentForType("calendar") as BlockContentSchemas["calendar"];
      return {
        table: content.table !== undefined ? String(content.table) : defaultContent.table,
        dateField: content.dateField !== undefined ? String(content.dateField) : defaultContent.dateField,
        limit: typeof content.limit === "number" ? content.limit : defaultContent.limit,
      } as BlockContentSchemas[BlockType];
    }
    case "html": {
      const defaultContent = getDefaultContentForType("html") as BlockContentSchemas["html"];
      return {
        html: content.html !== undefined ? String(content.html) : defaultContent.html,
      } as BlockContentSchemas[BlockType];
    }
    default:
      return getDefaultContentForType(type);
  }
}

