/**
 * Page Configuration Models
 * TypeScript interfaces for all page type configurations
 */

export interface BasePageConfig {
  table: string;
  filters?: any[];
  sorts?: any[];
}

export interface GridPageConfig extends BasePageConfig {
  fields: string[];
  rowHeight?: "short" | "medium" | "tall";
}

export interface RecordPageConfig extends BasePageConfig {
  fields: string[];
  layout?: "auto" | "twoColumn";
  recordId?: string; // For viewing a specific record
}

export interface KanbanPageConfig extends BasePageConfig {
  groupField: string;
  cardFields: string[];
}

export interface GalleryPageConfig extends BasePageConfig {
  imageField: string;
  titleField?: string;
  subtitleField?: string;
}

export interface CalendarPageConfig extends BasePageConfig {
  dateField: string;
}

export interface FormPageConfig extends BasePageConfig {
  fields: string[];
  submitAction?: "create" | "update";
}

export interface ChartPageConfig extends BasePageConfig {
  chartType: "bar" | "line" | "pie";
  xField: string;
  yField: string;
}

// Union type for all page configs
export type PageConfig = 
  | GridPageConfig 
  | RecordPageConfig 
  | KanbanPageConfig 
  | GalleryPageConfig 
  | CalendarPageConfig 
  | FormPageConfig 
  | ChartPageConfig;

/**
 * Type guard functions
 */
export function isGridPageConfig(config: any): config is GridPageConfig {
  return config && Array.isArray(config.fields);
}

export function isRecordPageConfig(config: any): config is RecordPageConfig {
  return config && Array.isArray(config.fields) && config.recordId !== undefined;
}

export function isKanbanPageConfig(config: any): config is KanbanPageConfig {
  return config && typeof config.groupField === 'string' && Array.isArray(config.cardFields);
}

export function isGalleryPageConfig(config: any): config is GalleryPageConfig {
  return config && typeof config.imageField === 'string';
}

export function isCalendarPageConfig(config: any): config is CalendarPageConfig {
  return config && typeof config.dateField === 'string';
}

export function isFormPageConfig(config: any): config is FormPageConfig {
  return config && Array.isArray(config.fields) && config.submitAction !== undefined;
}

export function isChartPageConfig(config: any): config is ChartPageConfig {
  return config && typeof config.chartType === 'string' && typeof config.xField === 'string' && typeof config.yField === 'string';
}
