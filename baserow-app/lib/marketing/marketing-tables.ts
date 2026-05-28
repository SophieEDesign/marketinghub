/**
 * Discover Marketing Hub tables from public.tables (name + supabase_table).
 */

export interface MarketingTableRow {
  id: string
  name: string
  supabase_table: string
}

function scoreContentTable(name: string): number {
  const normalized = String(name).trim().toLowerCase()
  if (!normalized) return -1
  if (/calendar|briefing/.test(normalized)) return -1

  if (normalized === "content") return 1000

  if (
    normalized === "social posts" ||
    normalized === "social post" ||
    normalized === "social content" ||
    normalized === "social media content" ||
    normalized === "content planner" ||
    normalized === "content planning"
  ) {
    return 950
  }

  if (/social/.test(normalized) && /content|post/.test(normalized)) return 900
  if (/content planner|content planning/.test(normalized)) return 850
  if (/content/.test(normalized) && /post/.test(normalized)) return 800
  if (/social/.test(normalized) && /planner|plan/.test(normalized)) return 750
  if (/content/.test(normalized)) return 600
  if (/social/.test(normalized) && /post/.test(normalized)) return 500

  return -1
}

export function findContentTable(tables: MarketingTableRow[]): MarketingTableRow | undefined {
  const ranked = tables
    .map((table, index) => ({
      table,
      index,
      score: scoreContentTable(table.name),
    }))
    .filter((candidate) => candidate.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)

  return ranked[0]?.table
}

export function findCampaignsTable(tables: MarketingTableRow[]): MarketingTableRow | undefined {
  return tables.find((t) => /campaign/i.test(t.name) && !/content/i.test(t.name))
}

export function findQuarterlyThemesTable(tables: MarketingTableRow[]): MarketingTableRow | undefined {
  return tables.find((t) => /quarterly/i.test(t.name) && /theme/i.test(t.name))
}

export function findMediaTable(tables: MarketingTableRow[]): MarketingTableRow | undefined {
  return tables.find(
    (t) =>
      /media/i.test(t.name) &&
      (/resource/i.test(t.name) || /link/i.test(t.name) || t.name === "Media")
  )
}
