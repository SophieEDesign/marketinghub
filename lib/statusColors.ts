export function getStatusColor(status: string): string {
  const statusLower = status?.toLowerCase() || "";
  
  const colorMap: Record<string, string> = {
    draft: "#9ca3af", // gray-400
    "in-progress": "#60a5fa", // blue-400
    review: "#fbbf24", // yellow-400
    approved: "#4ade80", // green-400
    published: "#a78bfa", // purple-400
    archived: "#6b7280", // gray-500
    // Additional statuses from Kanban
    ideas: "#e5e7eb",
    "dates for engagement": "#dbeafe",
    "date confirmed": "#bfdbfe",
    "on hold": "#f3f4f6",
    duplicate: "#fca5a5",
    cancelled: "#ef4444",
    "to do": "#93c5fd",
    "awaiting information": "#fbbf24",
    "in progress": "#60a5fa",
    "needs update": "#f59e0b",
    "drafted – needs internal review": "#a78bfa",
    "sent for approval – internal (p&m)": "#34d399",
    "tech check required": "#22d3ee",
    "text approved – image needed": "#818cf8",
    "approved – ready to schedule": "#4ade80",
    scheduled: "#10b981",
    "completed (published)": "#8b5cf6",
    "event passed / out of date": "#6b7280",
    "monthly (recurring)": "#a78bfa",
  };

  return colorMap[statusLower] || "#888888";
}

