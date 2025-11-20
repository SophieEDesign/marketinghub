export interface Table {
  id: string;
  name: string;
  views: string[];
}

export const tables: Table[] = [
  {
    id: "content",
    name: "Content",
    views: ["grid", "kanban", "calendar", "timeline", "cards"],
  },
  {
    id: "campaigns",
    name: "Campaigns",
    views: ["grid", "kanban", "calendar"],
  },
  {
    id: "contacts",
    name: "Contacts",
    views: ["grid", "cards"],
  },
  {
    id: "ideas",
    name: "Ideas",
    views: ["grid", "kanban", "cards"],
  },
  {
    id: "media",
    name: "Media",
    views: ["grid", "calendar", "cards"],
  },
  {
    id: "tasks",
    name: "Tasks",
    views: ["grid", "kanban", "calendar", "timeline"],
  },
];

// Table categories for sidebar organization
export interface TableCategory {
  id: string;
  name: string;
  tableIds: string[];
}

export const tableCategories: TableCategory[] = [
  {
    id: "content",
    name: "CONTENT",
    tableIds: ["content", "ideas", "media"],
  },
  {
    id: "planning",
    name: "PLANNING",
    tableIds: ["campaigns", "tasks"],
  },
  {
    id: "crm",
    name: "CRM",
    tableIds: ["contacts"],
  },
];

export function getTable(tableId: string): Table | undefined {
  return tables.find((t) => t.id === tableId);
}

export function isValidView(tableId: string, viewId: string): boolean {
  const table = getTable(tableId);
  return table?.views.includes(viewId) ?? false;
}

