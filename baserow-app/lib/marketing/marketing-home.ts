/**
 * Marketing Home — executive snapshot metrics and page detection.
 */

import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import type { ContentPlanningItem } from "@/lib/marketing/content-planning"
import {
  formatDisplayValue,
  getCurrentQuarter,
  quarterLabel,
  type QuarterNum,
  type ThemeOverviewCard,
} from "@/lib/marketing/theme-overview"

export type PipelineStage = "ideas" | "drafting" | "review" | "scheduled" | "published"

export interface MarketingHomeKpis {
  upcomingContent: number
  scheduledThisWeek: number
  overdueItems: number
  activeCampaigns: number
}

export interface PipelineCounts {
  ideas: number
  drafting: number
  review: number
  scheduled: number
  published: number
}

export interface SocialSnapshot {
  scheduledThisWeek: number
  scheduledThisMonth: number
  overduePosts: number
  gapHint: string | null
}

const COMPLETED_PATTERN =
  /published|complete|completed|done|live|posted|approved/i

const PIPELINE_PATTERNS: Record<PipelineStage, RegExp[]> = {
  ideas: [/idea/i, /brainstorm/i, /backlog/i, /concept/i, /new/i],
  drafting: [/draft/i, /writing/i, /in\s*progress/i, /\bwip\b/i, /creating/i],
  review: [/review/i, /approval/i, /proof/i, /sent\s*for/i, /awaiting/i, /check/i],
  scheduled: [/schedul/i, /planned/i, /ready\s*to/i, /queued/i, /confirmed/i],
  published: [/publish/i, /complete/i, /done/i, /live/i, /posted/i, /approved/i],
}

const SOCIAL_TYPE_PATTERN =
  /social|linkedin|instagram|facebook|twitter|x\.com|tiktok|youtube|bluesky/i

const INACTIVE_CAMPAIGN_PATTERN = /archived|complete|done|closed|cancelled|canceled|paused|on\s*hold/i

export function isMarketingHomePage(page: { name?: string; config?: unknown } | null): boolean {
  if (!page) return false
  const cfg = page.config as { layout_style?: string } | undefined
  const name = String(page.name || "").trim().toLowerCase()
  return (
    cfg?.layout_style === "marketing_home" ||
    name === "dashboard" ||
    name === "marketing home"
  )
}

function isCompletedStatus(status: string | null): boolean {
  if (!status) return false
  return COMPLETED_PATTERN.test(status)
}

export function isSocialContentType(contentType: string | null): boolean {
  if (!contentType) return false
  return SOCIAL_TYPE_PATTERN.test(contentType)
}

export function classifyPipelineStage(status: string | null): PipelineStage {
  if (!status) return "ideas"
  const normalized = status.trim()
  for (const stage of Object.keys(PIPELINE_PATTERNS) as PipelineStage[]) {
    if (PIPELINE_PATTERNS[stage].some((p) => p.test(normalized))) return stage
  }
  return "drafting"
}

export function buildPipelineCounts(items: ContentPlanningItem[]): PipelineCounts {
  const counts: PipelineCounts = {
    ideas: 0,
    drafting: 0,
    review: 0,
    scheduled: 0,
    published: 0,
  }
  for (const item of items) {
    counts[classifyPipelineStage(item.status)]++
  }
  return counts
}

export function buildMarketingHomeKpis(
  items: ContentPlanningItem[],
  campaignRows: Record<string, unknown>[],
  campaignStatusField: string | null
): MarketingHomeKpis {
  const today = startOfDay(new Date())
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 })

  let upcomingContent = 0
  let scheduledThisWeek = 0
  let overdueItems = 0

  for (const item of items) {
    if (item.isOverdue) overdueItems++
    const d = item.date ?? item.dueDate
    if (!d || isCompletedStatus(item.status)) continue
    if (!isBefore(startOfDay(d), today)) upcomingContent++
    if (
      isWithinInterval(startOfDay(d), { start: weekStart, end: weekEnd })
    ) {
      scheduledThisWeek++
    }
  }

  let activeCampaigns = 0
  if (!campaignStatusField) {
    activeCampaigns = campaignRows.length
  } else {
    for (const row of campaignRows) {
      const status = formatDisplayValue(row[campaignStatusField])
      if (status && INACTIVE_CAMPAIGN_PATTERN.test(status)) continue
      activeCampaigns++
    }
  }

  return { upcomingContent, scheduledThisWeek, overdueItems, activeCampaigns }
}

export function buildSocialSnapshot(items: ContentPlanningItem[]): SocialSnapshot {
  const social = items.filter((i) => isSocialContentType(i.contentType))
  const today = startOfDay(new Date())
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)

  let scheduledThisWeek = 0
  let scheduledThisMonth = 0
  let overduePosts = 0

  for (const item of social) {
    if (item.isOverdue) overduePosts++
    const d = item.date ?? item.dueDate
    if (!d || isCompletedStatus(item.status)) continue
    const day = startOfDay(d)
    if (isWithinInterval(day, { start: weekStart, end: weekEnd })) scheduledThisWeek++
    if (isWithinInterval(day, { start: monthStart, end: monthEnd })) scheduledThisMonth++
  }

  let gapHint: string | null = null
  if (scheduledThisWeek === 0 && social.length > 0) {
    gapHint = "No social posts scheduled this week"
  } else if (overduePosts > 0) {
    gapHint = `${overduePosts} overdue social post${overduePosts === 1 ? "" : "s"}`
  }

  return { scheduledThisWeek, scheduledThisMonth, overduePosts, gapHint }
}

export function getUpcomingForHome(
  items: ContentPlanningItem[],
  limit = 10
): ContentPlanningItem[] {
  const today = startOfDay(new Date())
  return items
    .filter((item) => {
      const d = item.date ?? item.dueDate
      return d && !item.isOverdue && !isCompletedStatus(item.status)
    })
    .sort((a, b) => {
      const da = a.date ?? a.dueDate!
      const db = b.date ?? b.dueDate!
      return da.getTime() - db.getTime()
    })
    .slice(0, limit)
}

export function formatQuarterYear(quarter: QuarterNum, year: number): string {
  return `${quarterLabel(quarter)} ${year}`
}

export function resolveHeroFromTheme(
  activeCard: ThemeOverviewCard | null,
  year: number
): {
  quarterYear: string
  themeLabel: string
  coreFocus: string | null
  messaging: string | null
  prompts: { id: string; label: string }[]
} {
  const quarter = getCurrentQuarter()
  if (!activeCard) {
    return {
      quarterYear: formatQuarterYear(quarter, year),
      themeLabel: "No active theme",
      coreFocus: null,
      messaging: null,
      prompts: [],
    }
  }
  return {
    quarterYear: formatQuarterYear(activeCard.quarter ?? quarter, year),
    themeLabel: activeCard.name,
    coreFocus: activeCard.coreTitle ?? activeCard.name,
    messaging: activeCard.description,
    prompts: activeCard.prompts.slice(0, 3),
  }
}

export function formatItemDate(item: ContentPlanningItem): string {
  const d = item.date ?? item.dueDate
  if (!d) return "—"
  return format(d, "d MMM yyyy")
}

export function getWeekDayStrip(): { label: string; date: string; hasContent: boolean }[] {
  const today = startOfDay(new Date())
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i)
    return {
      label: format(d, "EEE"),
      date: format(d, "d"),
      hasContent: false,
    }
  })
}

export function enrichWeekStripWithItems(
  strip: ReturnType<typeof getWeekDayStrip>,
  items: ContentPlanningItem[]
): ReturnType<typeof getWeekDayStrip> {
  const social = items.filter((i) => isSocialContentType(i.contentType))
  const days = new Set<string>()
  for (const item of social) {
    const d = item.date ?? item.dueDate
    if (d) days.add(format(d, "yyyy-MM-dd"))
  }
  const today = startOfDay(new Date())
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  return strip.map((cell, i) => {
    const d = addDays(weekStart, i)
    return { ...cell, hasContent: days.has(format(d, "yyyy-MM-dd")) }
  })
}
