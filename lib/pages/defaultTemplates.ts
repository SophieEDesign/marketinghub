/**
 * Default Templates for Page Types
 * Provides default settings/config for each page type when creating a new page
 */

export interface PageTemplate {
  settings: Record<string, any>;
}

export const defaultPageTemplates: Record<string, PageTemplate> = {
  grid: {
    settings: {
      table: '',
      fields: [],
      filters: [],
      sort: [],
    }
  },
  record: {
    settings: {
      table: '',
      layout: 'auto',
      recordId: '',
    }
  },
  kanban: {
    settings: {
      table: '',
      groupField: '',
      fields: [],
    }
  },
  gallery: {
    settings: {
      table: '',
      imageField: '',
      fields: [],
    }
  },
  calendar: {
    settings: {
      table: '',
      dateField: '',
      fields: [],
    }
  },
  form: {
    settings: {
      table: '',
      fields: [],
      submitAction: 'create',
    }
  },
  chart: {
    settings: {
      chartType: 'bar',
      table: '',
      xField: '',
      yField: '',
    }
  },
  custom: {
    settings: {}
  }
};

/**
 * Get default template for a page type
 */
export function getDefaultTemplate(pageType: string): PageTemplate {
  return defaultPageTemplates[pageType] || defaultPageTemplates.custom;
}
