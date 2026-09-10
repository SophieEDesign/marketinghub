/** HubStore page_notes key for recurring monthly admin/reporting tasks. */
export const SOCIAL_MONTHLY_TASKS_KEY = "social_monthly_tasks" as const;

export type SocialMonthlyTaskItem = {
  label: string;
  notes?: string;
};

export type SocialMonthlyTasksList = {
  version: 1;
  items: SocialMonthlyTaskItem[];
};

/** Default end-of-month reporting and admin checklist. */
export const DEFAULT_SOCIAL_MONTHLY_TASKS: SocialMonthlyTasksList = {
  version: 1,
  items: [
    { label: "Social media report" },
    { label: "CRM report" },
  ],
};

function isTaskItem(value: unknown): value is SocialMonthlyTaskItem {
  if (!value || typeof value !== "object") return false;
  const item = value as SocialMonthlyTaskItem;
  return typeof item.label === "string";
}

export function isMonthlyTasksList(
  value: unknown
): value is SocialMonthlyTasksList {
  if (!value || typeof value !== "object") return false;
  const list = value as SocialMonthlyTasksList;
  return (
    list.version === 1 &&
    Array.isArray(list.items) &&
    list.items.length > 0 &&
    list.items.every(isTaskItem)
  );
}

export function serializeMonthlyTasks(list: SocialMonthlyTasksList): string {
  return JSON.stringify(list);
}

export function parseMonthlyTasks(
  raw: string | null | undefined
): SocialMonthlyTasksList {
  if (!raw?.trim()) return DEFAULT_SOCIAL_MONTHLY_TASKS;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isMonthlyTasksList(parsed)) return parsed;
  } catch {
    // Legacy plain text — fall back to default list.
  }
  return DEFAULT_SOCIAL_MONTHLY_TASKS;
}

export function cloneMonthlyTasks(
  list: SocialMonthlyTasksList
): SocialMonthlyTasksList {
  return {
    version: 1,
    items: list.items.map((item) => ({
      label: item.label,
      notes: item.notes,
    })),
  };
}

/** Merge saved tasks with defaults so newly added defaults appear without overwriting custom entries. */
export function mergeMonthlyTasksWithDefaults(
  saved: SocialMonthlyTasksList
): SocialMonthlyTasksList {
  const seen = new Set(
    saved.items.map((item) => item.label.trim().toLowerCase())
  );
  const merged = [...saved.items];
  for (const item of DEFAULT_SOCIAL_MONTHLY_TASKS.items) {
    const key = item.label.trim().toLowerCase();
    if (!seen.has(key)) {
      merged.push(item);
      seen.add(key);
    }
  }
  return { version: 1, items: merged };
}
