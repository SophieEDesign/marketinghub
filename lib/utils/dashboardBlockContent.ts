/**
 * Dashboard Block Content Schema Validator
 * Ensures all block types have valid content structures
 */

export type BlockType = "text" | "image" | "embed" | "kpi" | "table" | "calendar" | "html";

export interface BlockContentSchemas {
  text: { html: string };
  image: { url: string; caption: string };
  embed: { url: string };
  kpi: { table: string; label: string; filter: string; aggregate: string };
  table: { table: string; fields: string[]; limit: number };
  calendar: { table: string; dateField: string; limit: number };
  html: { html: string };
}

/**
 * Get default content for a block type
 */
export function getDefaultContentForType(type: BlockType): BlockContentSchemas[BlockType] {
  switch (type) {
    case "text":
      return { html: "" };
    case "image":
      return { url: "", caption: "" };
    case "embed":
      return { url: "" };
    case "kpi":
      return { table: "", label: "Total Records", filter: "", aggregate: "count" };
    case "table":
      return { table: "", fields: [], limit: 5 };
    case "calendar":
      return { table: "", dateField: "publish_date", limit: 5 };
    case "html":
      return { html: "" };
    default:
      return {} as any;
  }
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

