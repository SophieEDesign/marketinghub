export interface Table {
  id: string;
  name: string;
  views: string[];
}

import { tableMetadata, getAllTables, getTableViews, getTableLabel } from "./tableMetadata";

export const tables: Table[] = getAllTables().map((id) => ({
  id,
  name: getTableLabel(id),
  views: getTableViews(id),
}));

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

