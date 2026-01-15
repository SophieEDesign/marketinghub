import type { BlockType, BlockConfig } from './types'

export interface BlockDefinition {
  type: BlockType
  label: string
  icon: string
  defaultWidth: number
  defaultHeight: number
  minWidth: number
  minHeight: number
  maxWidth?: number
  maxHeight?: number
  defaultConfig: BlockConfig
}

export const BLOCK_REGISTRY: Record<BlockType, BlockDefinition> = {
  grid: {
    type: 'grid',
    label: 'Grid',
    icon: 'Grid',
    defaultWidth: 12,
    defaultHeight: 8,
    minWidth: 4,
    minHeight: 4,
    defaultConfig: {
      title: 'Table View',
      table_id: '',
    },
  },
  form: {
    type: 'form',
    label: 'Form',
    icon: 'FileText',
    defaultWidth: 6,
    defaultHeight: 10,
    minWidth: 4,
    minHeight: 6,
    defaultConfig: {
      title: 'Form',
      table_id: '',
    },
  },
  record: {
    type: 'record',
    label: 'Record',
    icon: 'FileText',
    defaultWidth: 6,
    defaultHeight: 8,
    minWidth: 4,
    minHeight: 4,
    defaultConfig: {
      title: 'Record',
      table_id: '',
      record_id: '',
    },
  },
  chart: {
    type: 'chart',
    label: 'Chart',
    icon: 'BarChart',
    defaultWidth: 6,
    defaultHeight: 6,
    minWidth: 4,
    minHeight: 4,
    defaultConfig: {
      title: 'Chart',
      table_id: '',
      chart_type: 'bar',
    },
  },
  kpi: {
    type: 'kpi',
    label: 'KPI',
    icon: 'TrendingUp',
    defaultWidth: 3,
    defaultHeight: 3,
    minWidth: 2,
    minHeight: 2,
    maxWidth: 6,
    maxHeight: 4,
    defaultConfig: {
      title: 'KPI',
      table_id: '',
      kpi_aggregate: 'count',
    },
  },
  text: {
    type: 'text',
    label: 'Text',
    icon: 'Type',
    defaultWidth: 6,
    defaultHeight: 4,
    minWidth: 2,
    minHeight: 2,
    defaultConfig: {
      title: 'Text Block',
      text_content: '',
    },
  },
  image: {
    type: 'image',
    label: 'Image',
    icon: 'Image',
    defaultWidth: 4,
    defaultHeight: 4,
    minWidth: 2,
    minHeight: 2,
    defaultConfig: {
      title: 'Image',
      image_url: '',
      image_alt: '',
    },
  },
  gallery: {
    type: 'gallery',
    label: 'Gallery',
    icon: 'Images',
    defaultWidth: 12,
    defaultHeight: 8,
    minWidth: 4,
    minHeight: 4,
    defaultConfig: {
      title: 'Gallery',
      table_id: '',
      view_type: 'gallery',
    },
  },
  divider: {
    type: 'divider',
    label: 'Divider',
    icon: 'Minus',
    defaultWidth: 12,
    defaultHeight: 2, // Default to 2 units for spacing
    minWidth: 2,
    minHeight: 1,
    maxHeight: 20, // Allow larger heights for intentional spacing
    defaultConfig: {
      title: '',
      appearance: {
        divider_height: 2, // Default height setting
      },
    },
  },
  button: {
    type: 'button',
    label: 'Button',
    icon: 'Zap',
    defaultWidth: 3,
    defaultHeight: 2,
    minWidth: 2,
    minHeight: 2,
    maxWidth: 6,
    maxHeight: 3,
    defaultConfig: {
      title: 'Button',
      button_label: 'Click Me',
      button_automation_id: '',
    },
  },
  action: {
    type: 'action',
    label: 'Action',
    icon: 'Zap',
    defaultWidth: 3,
    defaultHeight: 2,
    minWidth: 2,
    minHeight: 2,
    maxWidth: 6,
    maxHeight: 3,
    defaultConfig: {
      title: 'Action',
      action_type: 'navigate',
      label: 'Click Me',
      route: '',
    },
  },
  link_preview: {
    type: 'link_preview',
    label: 'Link Preview',
    icon: 'ExternalLink',
    defaultWidth: 4,
    defaultHeight: 4,
    minWidth: 2,
    minHeight: 2,
    defaultConfig: {
      title: 'Link Preview',
      url: '',
    },
  },
  filter: {
    type: 'filter',
    label: 'Filter',
    icon: 'Filter',
    defaultWidth: 12,
    defaultHeight: 4,
    minWidth: 4,
    minHeight: 3,
    maxHeight: 8,
    defaultConfig: {
      title: 'Filters',
      table_id: '',
      target_blocks: 'all',
      allowed_fields: [],
      allowed_operators: [],
      filters: [],
    },
  },
  field: {
    type: 'field',
    label: 'Field',
    icon: 'FileText',
    defaultWidth: 6,
    defaultHeight: 3,
    minWidth: 2,
    minHeight: 2,
    defaultConfig: {
      title: 'Field',
      field_id: '',
    },
  },
  calendar: {
    type: 'calendar',
    label: 'Calendar',
    icon: 'Calendar',
    defaultWidth: 12,
    defaultHeight: 10,
    minWidth: 6,
    minHeight: 8,
    defaultConfig: {
      title: 'Calendar',
      table_id: '',
      view_type: 'calendar',
    },
  },
  kanban: {
    type: 'kanban',
    label: 'Kanban',
    icon: 'Columns',
    defaultWidth: 12,
    defaultHeight: 8,
    minWidth: 6,
    minHeight: 6,
    defaultConfig: {
      title: 'Kanban Board',
      table_id: '',
      view_type: 'kanban',
    },
  },
  timeline: {
    type: 'timeline',
    label: 'Timeline',
    icon: 'GitBranch',
    defaultWidth: 12,
    defaultHeight: 8,
    minWidth: 6,
    minHeight: 6,
    defaultConfig: {
      title: 'Timeline',
      table_id: '',
      view_type: 'timeline',
    },
  },
  list: {
    type: 'list',
    label: 'List',
    icon: 'List',
    defaultWidth: 12,
    defaultHeight: 8,
    minWidth: 4,
    minHeight: 4,
    defaultConfig: {
      title: 'List',
      table_id: '',
      view_type: 'grid',
    },
  },
  number: {
    type: 'number',
    label: 'Number',
    icon: 'Hash',
    defaultWidth: 4,
    defaultHeight: 3,
    minWidth: 2,
    minHeight: 2,
    maxWidth: 6,
    maxHeight: 4,
    defaultConfig: {
      title: 'Number',
      table_id: '',
      field_id: '',
    },
  },
}

export function getBlockDefinition(type: BlockType): BlockDefinition {
  return BLOCK_REGISTRY[type]
}

export function getAllBlockTypes(): BlockType[] {
  return Object.keys(BLOCK_REGISTRY) as BlockType[]
}
