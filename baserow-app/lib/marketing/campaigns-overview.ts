export interface CampaignOverviewItem {
  id: string
  title: string
  thumbnailUrl?: string
  type?: string
  division?: string
  status?: string
  priority?: string
  stage?: string
  startDate?: string
  endDate?: string
  owner?: string
  progress?: number | null
  openTasksCount: number
  linkedContentCount: number
  needsAttention: boolean
  recordTableId?: string
  recordSupabaseTable?: string
  notesSearchText?: string
  linkedEventsText?: string
}

export interface CampaignOverviewFilters {
  status: string
  stage: string
  campaignType: string
  division: string
  owner: string
  priority: string
}

export const EMPTY_CAMPAIGN_FILTERS: CampaignOverviewFilters = {
  status: "all",
  stage: "all",
  campaignType: "all",
  division: "all",
  owner: "all",
  priority: "all",
}

export function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase()
}

export function toCount(value: unknown): number {
  if (Array.isArray(value)) return value.length
  if (value == null) return 0
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value)
  const text = String(value).trim()
  if (!text) return 0
  if (text.startsWith("[") && text.endsWith("]")) {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) return parsed.length
    } catch {
      return 0
    }
  }
  if (text.includes(",")) {
    return text
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean).length
  }
  const num = Number(text)
  return Number.isFinite(num) ? Math.max(0, num) : 0
}

export function parseProgress(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, value))
  }
  const text = String(value).replace("%", "").trim()
  const num = Number(text)
  if (!Number.isFinite(num)) return null
  return Math.max(0, Math.min(100, num))
}

export function formatDateRange(start?: string, end?: string): string {
  const startText = start ? new Date(start).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : ""
  const endText = end ? new Date(end).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : ""
  if (startText && endText) return `${startText} - ${endText}`
  return startText || endText || "Ongoing"
}

export function buildCampaignSearchText(item: CampaignOverviewItem): string {
  return [
    item.title,
    item.type,
    item.division,
    item.notesSearchText,
    item.linkedEventsText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

export function filterCampaigns(
  items: CampaignOverviewItem[],
  filters: CampaignOverviewFilters,
  searchQuery: string
): CampaignOverviewItem[] {
  const q = normalizeText(searchQuery)
  return items.filter((item) => {
    if (filters.status !== "all" && normalizeText(item.status) !== normalizeText(filters.status)) return false
    if (filters.stage !== "all" && normalizeText(item.stage) !== normalizeText(filters.stage)) return false
    if (filters.campaignType !== "all" && normalizeText(item.type) !== normalizeText(filters.campaignType)) return false
    if (filters.division !== "all" && normalizeText(item.division) !== normalizeText(filters.division)) return false
    if (filters.owner !== "all" && normalizeText(item.owner) !== normalizeText(filters.owner)) return false
    if (filters.priority !== "all" && normalizeText(item.priority) !== normalizeText(filters.priority)) return false
    if (!q) return true
    return buildCampaignSearchText(item).includes(q)
  })
}

export { computeCampaignKpis } from "@/lib/marketing/campaigns-overview-kpi"

export const CAMPAIGNS_OVERVIEW_MOCK: CampaignOverviewItem[] = [
  { id: "c1", title: "Admirals Cup & Fastnet Race 2027", type: "Event", division: "Racing Logistics", status: "Planning", priority: "High", stage: "Planning", startDate: "2026-04-01", endDate: "2027-08-01", owner: "SO", progress: 20, openTasksCount: 4, linkedContentCount: 8, needsAttention: false },
  { id: "c2", title: "ARC 2026", type: "Event", division: "Sailing Logistics", status: "Active", priority: "High", stage: "Active", startDate: "2025-11-01", endDate: "2026-01-01", owner: "MJ", progress: 65, openTasksCount: 6, linkedContentCount: 10, needsAttention: true },
  { id: "c3", title: "Antigua Sailing Week 2026", type: "Event", division: "Racing Logistics", status: "Planning", priority: "Medium", stage: "Planning", startDate: "2026-03-01", endDate: "2026-04-01", owner: "JB", progress: 15, openTasksCount: 3, linkedContentCount: 6, needsAttention: false },
  { id: "c4", title: "SailGP 2026", type: "Sponsorship", division: "Brand & Marketing", status: "Active", priority: "High", stage: "Outreach", startDate: "2026-02-01", endDate: "2026-12-01", owner: "SO", progress: 40, openTasksCount: 5, linkedContentCount: 12, needsAttention: true },
  { id: "c5", title: "ROLEX Sydney Hobart 2025", type: "Event", division: "Racing Logistics", status: "Completed", priority: "Medium", stage: "Complete", startDate: "2024-12-01", endDate: "2025-01-01", owner: "MJ", progress: 100, openTasksCount: 0, linkedContentCount: 5, needsAttention: false },
  { id: "c6", title: "New Service Launch - USA", type: "Product Launch", division: "Shipping Services", status: "Completed", priority: "High", stage: "Complete", startDate: "2024-09-01", endDate: "2024-11-01", owner: "SO", progress: 100, openTasksCount: 0, linkedContentCount: 9, needsAttention: false },
  { id: "c7", title: "Customer Testimonial Series", type: "Brand Awareness", division: "Brand & Marketing", status: "On hold", priority: "Low", stage: "Review", startDate: "", endDate: "", owner: "JB", progress: null, openTasksCount: 2, linkedContentCount: 4, needsAttention: true },
]
