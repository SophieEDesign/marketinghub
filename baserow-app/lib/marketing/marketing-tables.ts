/**
 * Discover Marketing Hub tables from public.tables (name + supabase_table).
 */

export interface MarketingTableRow {
  id: string
  name: string
  supabase_table: string
}

export function findContentTable(tables: MarketingTableRow[]): MarketingTableRow | undefined {
  return tables.find(
    (t) =>
      /^content$/i.test(String(t.name).trim()) ||
      (/content/i.test(t.name) && !/calendar/i.test(t.name) && !/briefing/i.test(t.name))
  )
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
