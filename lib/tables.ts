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
    id: "media",
    name: "Media",
    views: ["grid"],
  },
  {
    id: "sponsorships",
    name: "Sponsorships",
    views: ["grid"],
  },
  {
    id: "strategy",
    name: "Strategy",
    views: ["grid"],
  },
  {
    id: "ideas",
    name: "Ideas",
    views: ["grid", "cards"],
  },
  {
    id: "briefings",
    name: "Briefings",
    views: ["grid"],
  },
  {
    id: "tasks",
    name: "Tasks",
    views: ["grid", "kanban"],
  },
];

export function getTable(tableId: string): Table | undefined {
  return tables.find((t) => t.id === tableId);
}

export function isValidView(tableId: string, viewId: string): boolean {
  const table = getTable(tableId);
  return table?.views.includes(viewId) ?? false;
}

