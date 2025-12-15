/**
 * Block Types Registry for NocoDB Interface Views
 * 
 * This registry defines all available block types that can be added to views,
 * similar to Airtable Interface Designer blocks.
 */

import type { Component } from 'vue'

export interface BlockType {
  id: string
  label: string
  description?: string
  icon?: string
  component: Component | string
  settingsComponent?: Component | string
  defaultSettings: any
  defaultSize: { w: number; h: number }
  category: 'data' | 'content' | 'layout' | 'automation'
}

export interface BlockConfig {
  id: string
  type: string
  position: { x: number; y: number; w: number; h: number }
  settings: any
  visibility?: {
    mode?: 'public' | 'authenticated' | 'role' | 'condition'
    roles?: string[]
    condition?: {
      field?: string
      operator?: 'equals' | 'not_equals' | 'contains' | 'empty' | 'not_empty'
      value?: any
    }
  }
  allowed_roles?: string[]
}

// Lazy load block components
const TextBlock = () => import('~/components/blocks/TextBlock.vue')
const HtmlBlock = () => import('~/components/blocks/HtmlBlock.vue')
const KpiBlock = () => import('~/components/blocks/KpiBlock.vue')
const ChartBlock = () => import('~/components/blocks/ChartBlock.vue')
const TableBlock = () => import('~/components/blocks/TableBlock.vue')
const ImageBlock = () => import('~/components/blocks/ImageBlock.vue')
const EmbedBlock = () => import('~/components/blocks/EmbedBlock.vue')
const AutomationBlock = () => import('~/components/blocks/AutomationBlock.vue')
const SeparatorBlock = () => import('~/components/blocks/SeparatorBlock.vue')

/**
 * Block Types Registry
 */
export const BLOCK_REGISTRY: Record<string, BlockType> = {
  text: {
    id: 'text',
    label: 'Text',
    description: 'Rich text content block',
    icon: 'mdi:text',
    component: TextBlock,
    defaultSettings: {
      title: '',
      content: '',
      alignment: 'left',
    },
    defaultSize: { w: 6, h: 3 },
    category: 'content',
  },
  html: {
    id: 'html',
    label: 'HTML',
    description: 'Raw HTML content',
    icon: 'mdi:code-tags',
    component: HtmlBlock,
    defaultSettings: {
      title: '',
      html: '',
    },
    defaultSize: { w: 6, h: 3 },
    category: 'content',
  },
  kpi: {
    id: 'kpi',
    label: 'KPI',
    description: 'Key performance indicator',
    icon: 'mdi:chart-line',
    component: KpiBlock,
    defaultSettings: {
      title: '',
      table: null,
      field: null,
      aggregate: 'count',
      filters: [],
    },
    defaultSize: { w: 3, h: 2 },
    category: 'data',
  },
  chart: {
    id: 'chart',
    label: 'Chart',
    description: 'Visualize data with charts',
    icon: 'mdi:chart-bar',
    component: ChartBlock,
    defaultSettings: {
      title: '',
      table: null,
      chartType: 'bar',
      xField: null,
      yField: null,
      filters: [],
    },
    defaultSize: { w: 6, h: 4 },
    category: 'data',
  },
  table: {
    id: 'table',
    label: 'Table',
    description: 'Display data in a table',
    icon: 'mdi:table',
    component: TableBlock,
    defaultSettings: {
      title: '',
      table: null,
      columns: [],
      filters: [],
      limit: 10,
    },
    defaultSize: { w: 6, h: 5 },
    category: 'data',
  },
  image: {
    id: 'image',
    label: 'Image',
    description: 'Display an image',
    icon: 'mdi:image',
    component: ImageBlock,
    defaultSettings: {
      title: '',
      url: '',
      alt: '',
      width: '100%',
    },
    defaultSize: { w: 4, h: 3 },
    category: 'content',
  },
  embed: {
    id: 'embed',
    label: 'Embed',
    description: 'Embed external content',
    icon: 'mdi:code-json',
    component: EmbedBlock,
    defaultSettings: {
      title: '',
      url: '',
      width: '100%',
      height: '400px',
    },
    defaultSize: { w: 6, h: 4 },
    category: 'content',
  },
  automation: {
    id: 'automation',
    label: 'Automation',
    description: 'Trigger an automation',
    icon: 'mdi:lightning-bolt',
    component: AutomationBlock,
    defaultSettings: {
      title: '',
      automationId: null,
      label: 'Run Automation',
      confirm: false,
    },
    defaultSize: { w: 3, h: 2 },
    category: 'automation',
  },
  separator: {
    id: 'separator',
    label: 'Separator',
    description: 'Visual separator',
    icon: 'mdi:minus',
    component: SeparatorBlock,
    defaultSettings: {},
    defaultSize: { w: 6, h: 1 },
    category: 'layout',
  },
}

/**
 * Get block type by ID
 */
export function getBlockType(typeId: string): BlockType | undefined {
  return BLOCK_REGISTRY[typeId]
}

/**
 * Get all block types
 */
export function getAllBlockTypes(): BlockType[] {
  return Object.values(BLOCK_REGISTRY)
}

/**
 * Get block types by category
 */
export function getBlockTypesByCategory(category: BlockType['category']): BlockType[] {
  return Object.values(BLOCK_REGISTRY).filter((bt) => bt.category === category)
}

/**
 * Create a new block with default settings
 */
export function createBlock(typeId: string, position?: { x: number; y: number; w?: number; h?: number }): BlockConfig {
  const blockType = BLOCK_REGISTRY[typeId]
  if (!blockType) {
    throw new Error(`Unknown block type: ${typeId}`)
  }

  const defaultSize = blockType.defaultSize
  return {
    id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: typeId,
    position: {
      x: position?.x ?? 0,
      y: position?.y ?? 0,
      w: position?.w ?? defaultSize.w,
      h: position?.h ?? defaultSize.h,
    },
    settings: { ...blockType.defaultSettings },
  }
}
