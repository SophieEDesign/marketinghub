/**
 * Mock data for Upcoming Summary Block (self-contained until Supabase wiring).
 */

import {
  addDays,
  endOfDay,
  endOfQuarter,
  endOfWeek,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfQuarter,
  startOfWeek,
} from 'date-fns'
import type { BlockConfig } from '@/lib/interface/types'
import type {
  UpcomingSummaryDateRange,
  UpcomingSummarySectionId,
} from '@/lib/interface/types'

export const ALL_UPCOMING_SUMMARY_SECTIONS: UpcomingSummarySectionId[] = [
  'deadlines',
  'campaigns',
  'events',
  'approval',
  'blockers',
  'published',
]

export type DeadlineStatus =
  | 'to-do'
  | 'in-progress'
  | 'awaiting-approval'
  | 'approved'
  | 'scheduled'
  | 'overdue'

export type DeadlinePriority = 'low' | 'medium' | 'high'

export interface DeadlineItem {
  id: string
  title: string
  owner?: string
  dueDate: string
  status: DeadlineStatus
  theme?: string
  priority?: DeadlinePriority
  channel?: string
}

export interface CampaignItem {
  id: string
  title: string
  startDate?: string
  plannedCount?: number
  scheduledCount?: number
  approvedCount?: number
  status?: string
  theme?: string
}

export interface EventItem {
  id: string
  title: string
  startDate: string
  endDate?: string
  location?: string
  attendingCount?: number
  status?: string
}

export interface ApprovalItem {
  id: string
  title: string
  contentType?: string
  ownerInitials?: string
  status?: string
}

export type BlockerReason =
  | 'missing-copy'
  | 'missing-image'
  | 'needs-approval'
  | 'missing-brief'
  | 'date-not-set'

export interface BlockerItem {
  id: string
  title: string
  reason: BlockerReason
  relatedContent?: string
}

export interface PublishedItem {
  id: string
  title: string
  publishedDate: string
  channel?: string
  theme?: string
}

export const MOCK_DEADLINES: DeadlineItem[] = [
  {
    id: 'dl-1',
    title: 'ARC sailing schedule newsletter',
    dueDate: '2025-05-18',
    status: 'overdue',
    channel: 'mail',
    theme: 'ARC 2026',
    priority: 'high',
  },
  {
    id: 'dl-2',
    title: 'Southampton Boat Show social posts',
    dueDate: '2025-05-22',
    status: 'scheduled',
    channel: 'message',
    theme: 'Southampton Boat Show',
    priority: 'medium',
  },
  {
    id: 'dl-3',
    title: 'Monaco Yacht Show campaign page',
    dueDate: '2025-05-23',
    status: 'in-progress',
    channel: 'globe',
    theme: 'Monaco Yacht Show 2026',
    priority: 'high',
  },
  {
    id: 'dl-4',
    title: 'Sustainability article',
    dueDate: '2025-05-24',
    status: 'to-do',
    channel: 'file',
    theme: 'Sustainability',
    priority: 'medium',
  },
  {
    id: 'dl-5',
    title: 'Forwarding explainer post',
    dueDate: '2025-05-26',
    status: 'awaiting-approval',
    channel: 'linkedin',
    theme: 'Operational',
    priority: 'low',
  },
]

export const MOCK_CAMPAIGNS: CampaignItem[] = [
  {
    id: 'cp-1',
    title: 'Monaco Yacht Show 2026',
    startDate: '2025-09-01',
    plannedCount: 12,
    scheduledCount: 8,
    approvedCount: 5,
    status: 'In progress',
    theme: 'Monaco Yacht Show',
  },
  {
    id: 'cp-2',
    title: 'ARC 2026',
    startDate: '2025-11-15',
    plannedCount: 18,
    scheduledCount: 4,
    approvedCount: 2,
    status: 'In progress',
    theme: 'ARC',
  },
  {
    id: 'cp-3',
    title: 'Reviews',
    startDate: '2025-06-01',
    plannedCount: 6,
    scheduledCount: 2,
    status: 'Planned',
    theme: 'Reviews',
  },
  {
    id: 'cp-4',
    title: 'Aina Bauza',
    plannedCount: 4,
    scheduledCount: 0,
    status: 'Planned',
    theme: 'People',
  },
  {
    id: 'cp-5',
    title: 'New York Yacht Club Sponsorship',
    plannedCount: 8,
    scheduledCount: 3,
    status: 'In progress',
    theme: 'Sponsorship',
  },
  {
    id: 'cp-6',
    title: 'Fort Lauderdale campaign',
    startDate: '2025-10-20',
    plannedCount: 10,
    scheduledCount: 1,
    status: 'Planned',
    theme: 'Fort Lauderdale',
  },
]

export const MOCK_EVENTS: EventItem[] = [
  {
    id: 'ev-1',
    title: 'Southampton Boat Show',
    startDate: '2025-09-13',
    endDate: '2025-09-22',
    location: 'Southampton, UK',
    attendingCount: 4,
    status: 'Confirmed',
  },
  {
    id: 'ev-2',
    title: 'Monaco Yacht Show',
    startDate: '2025-09-24',
    endDate: '2025-09-27',
    location: 'Monaco',
    attendingCount: 6,
    status: 'Confirmed',
  },
  {
    id: 'ev-3',
    title: 'Fort Lauderdale International Boat Show',
    startDate: '2025-10-29',
    endDate: '2025-11-02',
    location: 'Fort Lauderdale, USA',
    attendingCount: 3,
    status: 'Confirmed',
  },
  {
    id: 'ev-4',
    title: 'ARC Start',
    startDate: '2025-11-23',
    location: 'Las Palmas',
    attendingCount: 2,
    status: 'Confirmed',
  },
  {
    id: 'ev-5',
    title: 'Antigua Charter Yacht Show',
    startDate: '2025-12-04',
    endDate: '2025-12-07',
    location: 'Antigua',
    attendingCount: 2,
    status: 'Confirmed',
  },
]

export const MOCK_APPROVAL: ApprovalItem[] = [
  {
    id: 'ap-1',
    title: 'MYS press release',
    contentType: 'Press release',
    ownerInitials: 'AK',
    status: 'Awaiting approval',
  },
  {
    id: 'ap-2',
    title: 'Sustainability infographic',
    contentType: 'Social post',
    ownerInitials: 'JL',
    status: 'Awaiting approval',
  },
  {
    id: 'ap-3',
    title: 'CEO interview blog draft',
    contentType: 'Article',
    ownerInitials: 'SE',
    status: 'Awaiting approval',
  },
  {
    id: 'ap-4',
    title: 'ARC welcome email',
    contentType: 'Email',
    ownerInitials: 'AK',
    status: 'Awaiting approval',
  },
]

export const MOCK_BLOCKERS: BlockerItem[] = [
  {
    id: 'bl-1',
    title: 'MYS campaign page',
    reason: 'missing-image',
    relatedContent: 'Missing hero image',
  },
  {
    id: 'bl-2',
    title: 'Southampton Boat Show brief',
    reason: 'missing-brief',
    relatedContent: 'Brief not uploaded',
  },
  {
    id: 'bl-3',
    title: 'Sustainability article',
    reason: 'missing-copy',
    relatedContent: 'Body copy incomplete',
  },
  {
    id: 'bl-4',
    title: 'Fort Lauderdale landing page',
    reason: 'date-not-set',
    relatedContent: 'Publish date not set',
  },
]

export const MOCK_PUBLISHED: PublishedItem[] = [
  {
    id: 'pb-1',
    title: 'Racing logistics case study',
    publishedDate: '2025-05-19',
    channel: 'Website page',
    theme: 'Case studies',
  },
  {
    id: 'pb-2',
    title: 'CEO interview',
    publishedDate: '2025-05-18',
    channel: 'LinkedIn',
    theme: 'Leadership',
  },
  {
    id: 'pb-3',
    title: 'ARC 2026 announcement',
    publishedDate: '2025-05-17',
    channel: 'Press release',
    theme: 'ARC 2026',
  },
  {
    id: 'pb-4',
    title: 'Sustainability pledge post',
    publishedDate: '2025-05-16',
    channel: 'Instagram',
    theme: 'Sustainability',
  },
  {
    id: 'pb-5',
    title: 'Newsletter — May edition',
    publishedDate: '2025-05-15',
    channel: 'Email',
    theme: 'Newsletter',
  },
]

export const DATE_RANGE_LABELS: Record<UpcomingSummaryDateRange, string> = {
  this_week: 'This week',
  next_30_days: 'Next 30 days',
  this_quarter: 'This quarter',
}

export const BLOCKER_REASON_LABELS: Record<BlockerReason, string> = {
  'missing-copy': 'Missing copy',
  'missing-image': 'Missing image',
  'needs-approval': 'Needs approval',
  'missing-brief': 'Missing brief',
  'date-not-set': 'Date not set',
}

export function getVisibleSections(config: BlockConfig): UpcomingSummarySectionId[] {
  const configured = config.upcoming_summary_sections
  if (!configured?.length) return [...ALL_UPCOMING_SUMMARY_SECTIONS]
  return ALL_UPCOMING_SUMMARY_SECTIONS.filter((id) => configured.includes(id))
}

export function sliceItems<T>(items: T[], max: number): T[] {
  const limit = Math.max(1, Math.min(20, max || 5))
  return items.slice(0, limit)
}

function parseMockDate(iso: string): Date {
  return startOfDay(parseISO(iso.length === 10 ? `${iso}T12:00:00` : iso))
}

export function upcomingSummaryDateInterval(
  range: UpcomingSummaryDateRange,
  now = new Date()
): { start: Date; end: Date } {
  const today = startOfDay(now)
  if (range === 'this_week') {
    return {
      start: startOfWeek(today, { weekStartsOn: 1 }),
      end: endOfWeek(today, { weekStartsOn: 1 }),
    }
  }
  if (range === 'next_30_days') {
    return { start: today, end: endOfDay(addDays(today, 30)) }
  }
  return { start: startOfQuarter(today), end: endOfQuarter(today) }
}

function dateInRange(iso: string | undefined, range: UpcomingSummaryDateRange, now: Date): boolean {
  if (!iso) return true
  const d = parseMockDate(iso)
  const { start, end } = upcomingSummaryDateInterval(range, now)
  return isWithinInterval(d, { start, end })
}

export function filterDeadlinesByRange(
  items: DeadlineItem[],
  range: UpcomingSummaryDateRange,
  now = new Date()
): DeadlineItem[] {
  return items.filter((item) => dateInRange(item.dueDate, range, now))
}

export function filterCampaignsByRange(
  items: CampaignItem[],
  range: UpcomingSummaryDateRange,
  now = new Date()
): CampaignItem[] {
  return items.filter((item) => !item.startDate || dateInRange(item.startDate, range, now))
}

export function filterEventsByRange(
  items: EventItem[],
  range: UpcomingSummaryDateRange,
  now = new Date()
): EventItem[] {
  return items.filter((item) => dateInRange(item.startDate, range, now))
}

export function filterPublishedByRange(
  items: PublishedItem[],
  range: UpcomingSummaryDateRange,
  now = new Date()
): PublishedItem[] {
  return items.filter((item) => dateInRange(item.publishedDate, range, now))
}

export function sortCampaignsByStatus(items: CampaignItem[]): CampaignItem[] {
  const order = ['In progress', 'Planned', 'Complete', 'On hold']
  return [...items].sort((a, b) => {
    const ai = order.indexOf(a.status ?? '')
    const bi = order.indexOf(b.status ?? '')
    const aIdx = ai === -1 ? order.length : ai
    const bIdx = bi === -1 ? order.length : bi
    if (aIdx !== bIdx) return aIdx - bIdx
    return a.title.localeCompare(b.title)
  })
}
