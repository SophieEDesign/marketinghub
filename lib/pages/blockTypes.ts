/**
 * Block Types Registry for Pages
 * 
 * This registry defines all available block types that can be added to pages,
 * similar to Airtable Interface Designer blocks.
 */

import { LucideIcon, BarChart3, TrendingUp, FileText, Code, Image, Table, Zap, Minus, Layout } from "lucide-react";
import { ComponentType } from "react";

export interface BlockType {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  component: ComponentType<any>;
  settingsComponent?: ComponentType<any>;
  defaultSettings: any;
  defaultSize: { w: number; h: number };
  category: "data" | "content" | "layout" | "automation";
}

export interface BlockConfig {
  id: string;
  type: string;
  position: { x: number; y: number; w: number; h: number };
  settings: any;
  visibility?: {
    field?: string;
    operator?: "equals" | "not_equals" | "contains" | "empty" | "not_empty";
    value?: any;
  };
  allowed_roles?: string[];
}

// Import adapter components that bridge page blocks and dashboard blocks
import { 
  PageTextBlock, 
  PageImageBlock, 
  PageEmbedBlock, 
  PageKpiBlock, 
  PageTableBlock,
  PageHtmlBlock 
} from "@/components/pages/blocks/PageBlockAdapter";

// Import placeholder components for blocks not yet fully implemented
import ChartBlockPlaceholder from "@/components/pages/blocks/ChartBlockPlaceholder";
import AutomationTriggerBlockPlaceholder from "@/components/pages/blocks/AutomationTriggerBlockPlaceholder";

const ChartBlock = ChartBlockPlaceholder;
const AutomationTriggerBlock = AutomationTriggerBlockPlaceholder;

const SeparatorBlock = ({ block, isEditing, onUpdate, onDelete, onOpenSettings }: any) => (
  <div className="py-2">
    <div className="border-t border-gray-200 dark:border-gray-700" />
  </div>
);

/**
 * Block Types Registry
 * 
 * Add new block types here. Each block type must have:
 * - id: unique identifier
 * - label: display name
 * - icon: Lucide icon component
 * - component: React component to render the block
 * - defaultSettings: default configuration object
 * - defaultSize: default grid size { w, h }
 */
export const BLOCK_TYPES: Record<string, BlockType> = {
  text: {
    id: "text",
    label: "Text",
    description: "Rich text content block",
    icon: FileText,
    component: PageTextBlock,
    defaultSettings: {
      title: "",
      content: "",
      alignment: "left",
    },
    defaultSize: { w: 6, h: 3 },
    category: "content",
  },
  chart: {
    id: "chart",
    label: "Chart",
    description: "Visualize data with charts",
    icon: BarChart3,
    component: ChartBlock,
    defaultSettings: {
      title: "",
      table: null,
      chartType: "bar",
      xField: null,
      yField: null,
    },
    defaultSize: { w: 6, h: 4 },
    category: "data",
  },
  kpi: {
    id: "kpi",
    label: "KPI",
    description: "Key performance indicator",
    icon: TrendingUp,
    component: PageKpiBlock,
    defaultSettings: {
      title: "",
      table: null,
      field: null,
      aggregate: "count",
    },
    defaultSize: { w: 3, h: 2 },
    category: "data",
  },
  table: {
    id: "table",
    label: "Table",
    description: "Display table data",
    icon: Table,
    component: PageTableBlock,
    defaultSettings: {
      title: "",
      table: null,
      fields: [],
      filters: [],
      sort: [],
    },
    defaultSize: { w: 12, h: 6 },
    category: "data",
  },
  image: {
    id: "image",
    label: "Image",
    description: "Display an image",
    icon: Image,
    component: PageImageBlock,
    defaultSettings: {
      title: "",
      url: "",
      alt: "",
      fit: "cover",
    },
    defaultSize: { w: 6, h: 4 },
    category: "content",
  },
  embed: {
    id: "embed",
    label: "Embed",
    description: "Embed external content",
    icon: Code,
    component: PageEmbedBlock,
    defaultSettings: {
      title: "",
      url: "",
      height: 400,
    },
    defaultSize: { w: 12, h: 6 },
    category: "content",
  },
  automation: {
    id: "automation",
    label: "Automation Trigger",
    description: "Button to trigger an automation",
    icon: Zap,
    component: AutomationTriggerBlock,
    defaultSettings: {
      title: "Run Automation",
      automationId: null,
      buttonText: "Run",
    },
    defaultSize: { w: 3, h: 2 },
    category: "automation",
  },
  separator: {
    id: "separator",
    label: "Separator",
    description: "Visual divider",
    icon: Minus,
    component: SeparatorBlock,
    defaultSettings: {
      style: "solid",
      color: "gray",
    },
    defaultSize: { w: 12, h: 1 },
    category: "layout",
  },
};

/**
 * Get block type by ID
 */
export function getBlockType(id: string): BlockType | undefined {
  return BLOCK_TYPES[id];
}

/**
 * Get all block types
 */
export function getAllBlockTypes(): BlockType[] {
  return Object.values(BLOCK_TYPES);
}

/**
 * Get block types by category
 */
export function getBlockTypesByCategory(category: BlockType["category"]): BlockType[] {
  return Object.values(BLOCK_TYPES).filter((bt) => bt.category === category);
}

/**
 * Create a new block with default settings
 */
export function createBlock(typeId: string, position: { x: number; y: number }): BlockConfig {
  const blockType = BLOCK_TYPES[typeId];
  if (!blockType) {
    throw new Error(`Unknown block type: ${typeId}`);
  }

  return {
    id: crypto.randomUUID(),
    type: typeId,
    position: {
      ...position,
      ...blockType.defaultSize,
    },
    settings: { ...blockType.defaultSettings },
  };
}
