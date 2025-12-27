import type { BlockType, BlockConfig } from './types'

export type LayoutTemplate = 'table' | 'planning' | 'dashboard' | 'form'

export interface LayoutTemplateDefinition {
  name: string
  description: string
  icon: string
  blocks: Array<{
    type: BlockType
    x: number
    y: number
    w: number
    h: number
    config: BlockConfig
  }>
}

export const LAYOUT_TEMPLATES: Record<LayoutTemplate, LayoutTemplateDefinition> = {
  table: {
    name: 'Table View',
    description: 'A simple grid view of your data',
    icon: '📊',
    blocks: [
      {
        type: 'grid',
        x: 0,
        y: 0,
        w: 12,
        h: 8,
        config: {
          title: 'Data Grid',
          table_id: '', // Will be set from primary table
        },
      },
    ],
  },
  planning: {
    name: 'Planning Board',
    description: 'Kanban-style board with multiple views',
    icon: '📋',
    blocks: [
      {
        type: 'grid',
        x: 0,
        y: 0,
        w: 12,
        h: 6,
        config: {
          title: 'All Items',
          table_id: '',
        },
      },
      {
        type: 'kpi',
        x: 0,
        y: 6,
        w: 3,
        h: 3,
        config: {
          title: 'Total',
          table_id: '',
          kpi_aggregate: 'count',
        },
      },
      {
        type: 'kpi',
        x: 3,
        y: 6,
        w: 3,
        h: 3,
        config: {
          title: 'Completed',
          table_id: '',
          kpi_aggregate: 'count',
        },
      },
      {
        type: 'chart',
        x: 6,
        y: 6,
        w: 6,
        h: 3,
        config: {
          title: 'Progress',
          table_id: '',
          chart_type: 'bar',
        },
      },
    ],
  },
  dashboard: {
    name: 'Dashboard',
    description: 'Overview with KPIs, charts, and data grid',
    icon: '📈',
    blocks: [
      {
        type: 'kpi',
        x: 0,
        y: 0,
        w: 3,
        h: 3,
        config: {
          title: 'Total Records',
          table_id: '',
          kpi_aggregate: 'count',
        },
      },
      {
        type: 'kpi',
        x: 3,
        y: 0,
        w: 3,
        h: 3,
        config: {
          title: 'This Month',
          table_id: '',
          kpi_aggregate: 'count',
        },
      },
      {
        type: 'kpi',
        x: 6,
        y: 0,
        w: 3,
        h: 3,
        config: {
          title: 'Active',
          table_id: '',
          kpi_aggregate: 'count',
        },
      },
      {
        type: 'kpi',
        x: 9,
        y: 0,
        w: 3,
        h: 3,
        config: {
          title: 'Pending',
          table_id: '',
          kpi_aggregate: 'count',
        },
      },
      {
        type: 'chart',
        x: 0,
        y: 3,
        w: 6,
        h: 4,
        config: {
          title: 'Trends',
          table_id: '',
          chart_type: 'line',
        },
      },
      {
        type: 'chart',
        x: 6,
        y: 3,
        w: 6,
        h: 4,
        config: {
          title: 'Distribution',
          table_id: '',
          chart_type: 'pie',
        },
      },
      {
        type: 'grid',
        x: 0,
        y: 7,
        w: 12,
        h: 6,
        config: {
          title: 'Recent Records',
          table_id: '',
        },
      },
    ],
  },
  form: {
    name: 'Form',
    description: 'A form to collect data',
    icon: '📝',
    blocks: [
      {
        type: 'text',
        x: 0,
        y: 0,
        w: 12,
        h: 2,
        config: {
          title: 'Form Title',
          text_content: '# Form Title\n\nFill out the form below to submit your information.',
        },
      },
      {
        type: 'form',
        x: 0,
        y: 2,
        w: 8,
        h: 10,
        config: {
          title: 'Submission Form',
          table_id: '',
        },
      },
      {
        type: 'text',
        x: 8,
        y: 2,
        w: 4,
        h: 10,
        config: {
          title: 'Instructions',
          text_content: '## Instructions\n\n- Fill out all required fields\n- Click submit when done\n- You will receive a confirmation',
        },
      },
    ],
  },
}

