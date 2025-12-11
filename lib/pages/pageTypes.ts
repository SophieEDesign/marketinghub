/**
 * Page Types Registry
 * Defines all available page types in the system (Airtable-style)
 */

import { Grid, User, Kanban, Image, Calendar, FileText, BarChart, File } from "lucide-react";

export interface PageType {
  id: string;
  label: string;
  icon: typeof Grid;
  description?: string;
}

export const PAGE_TYPES: PageType[] = [
  { 
    id: 'grid', 
    label: 'Grid View', 
    icon: Grid,
    description: 'Display records in a table/grid format'
  },
  { 
    id: 'record', 
    label: 'Record Detail', 
    icon: User,
    description: 'View and edit a single record in detail'
  },
  { 
    id: 'kanban', 
    label: 'Kanban Board', 
    icon: Kanban,
    description: 'Organize records in a kanban board layout'
  },
  { 
    id: 'gallery', 
    label: 'Gallery View', 
    icon: Image,
    description: 'Display records as cards in a gallery'
  },
  { 
    id: 'calendar', 
    label: 'Calendar View', 
    icon: Calendar,
    description: 'View records on a calendar timeline'
  },
  { 
    id: 'form', 
    label: 'Form Page', 
    icon: FileText,
    description: 'Create a form to add/edit records'
  },
  { 
    id: 'chart', 
    label: 'Chart Page', 
    icon: BarChart,
    description: 'Visualize data with charts and graphs'
  },
  { 
    id: 'custom', 
    label: 'Custom Page', 
    icon: File,
    description: 'Build a custom page with blocks'
  },
];

export type PageTypeId = typeof PAGE_TYPES[number]['id'];

/**
 * Get a page type by ID
 */
export function getPageType(id: string): PageType | undefined {
  return PAGE_TYPES.find(type => type.id === id);
}

/**
 * Check if a page type ID is valid
 */
export function isValidPageType(id: string): id is PageTypeId {
  return PAGE_TYPES.some(type => type.id === id);
}
