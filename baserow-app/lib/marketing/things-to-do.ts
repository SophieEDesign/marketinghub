/**
 * Things To Do block — mock data and helpers.
 *
 * TODO: connect work items to a Marketing Hub tasks/actions table.
 * TODO: link work items to Content table.
 * TODO: link work items to Campaigns table.
 * TODO: link work items to Events table.
 * TODO: link work items to Media/Resource table.
 * TODO: link work items to Website Pages table.
 * TODO: link work items to Themes table.
 * TODO: support bidirectional linked records.
 * TODO: open existing RecordModal / RecordEditor from linked items.
 * TODO: add permissions for who can create/edit/approve work items.
 * TODO: support comments/activity later.
 * TODO: support notifications/reminders later.
 */

import {
  addDays,
  endOfDay,
  endOfQuarter,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns"

export type ThingsToDoView = "list" | "board" | "by-priority" | "by-campaign" | "calendar"
export type ThingsToDoGrouping = "due-date" | "status" | "campaign" | "priority"
export type ThingsToDoSort = "due-date" | "priority" | "status"
export type ThingsToDoDateRange = "all" | "this_week" | "next_30_days" | "this_quarter"

export type ThingsToDoItemType =
  | "task"
  | "review"
  | "approval"
  | "blocker"
  | "update"
  | "follow-up"
  | "idea"

export type ThingsToDoStatus =
  | "to-do"
  | "in-progress"
  | "waiting"
  | "needs-review"
  | "changes-requested"
  | "approved"
  | "done"

export type ThingsToDoPriority = "low" | "medium" | "high" | "urgent"

export type ThingsToDoLinkedType =
  | "content"
  | "campaign"
  | "event"
  | "media"
  | "website-page"
  | "newsletter"
  | "theme"

export type ThingsToDoRowGroup =
  | "overdue"
  | "due-today"
  | "due-this-week"
  | "waiting"
  | "completed"

export interface ThingsToDoPerson {
  id: string
  name: string
  initials: string
}

export interface ThingsToDoLinkedItem {
  id: string
  type: ThingsToDoLinkedType
  title: string
  tableName?: string
  url?: string
}

export interface ThingsToDoChecklistItem {
  id: string
  label: string
  completed: boolean
}

export interface ThingsToDoItem {
  id: string
  title: string
  description?: string
  type: ThingsToDoItemType
  status: ThingsToDoStatus
  priority: ThingsToDoPriority
  owner?: ThingsToDoPerson
  reviewer?: ThingsToDoPerson
  dueDate?: string
  createdAt?: string
  updatedAt?: string
  campaign?: { id: string; title: string }
  theme?: { id: string; title: string }
  linkedItems?: ThingsToDoLinkedItem[]
  contentType?: string
  channel?: string
  checklist?: ThingsToDoChecklistItem[]
  commentsCount?: number
  /** Content table row — open in RecordModal */
  recordTableId?: string
  recordSupabaseTable?: string
}

export interface ThingsToDoFilters {
  types: string[]
  statuses: string[]
  priorities: string[]
  owners: string[]
  reviewers: string[]
  campaigns: string[]
  linkedTypes: string[]
  contentTypes: string[]
  channels: string[]
  dueDatePreset?: "overdue" | "today" | "this-week" | "none"
}

export interface ThingsToDoStats {
  overdue: number
  dueToday: number
  dueThisWeek: number
  waiting: number
  completed: number
}

export interface ThingsToDoRowGroupSection {
  /** Due-date row group key, or arbitrary key for status/campaign/priority sections */
  key: ThingsToDoRowGroup | string
  label: string
  count: number
  items: ThingsToDoItem[]
}

export function isThingsToDoRowGroup(key: string): key is ThingsToDoRowGroup {
  return (ROW_GROUP_ORDER as readonly string[]).includes(key)
}

export const THINGS_TO_DO_TYPES: { value: ThingsToDoItemType; label: string }[] = [
  { value: "task", label: "Task" },
  { value: "review", label: "Review" },
  { value: "approval", label: "Approval" },
  { value: "blocker", label: "Blocker" },
  { value: "update", label: "Update" },
  { value: "follow-up", label: "Follow-up" },
  { value: "idea", label: "Idea" },
]

export const THINGS_TO_DO_STATUSES: { value: ThingsToDoStatus; label: string }[] = [
  { value: "to-do", label: "To do" },
  { value: "in-progress", label: "In progress" },
  { value: "waiting", label: "Waiting" },
  { value: "needs-review", label: "Needs review" },
  { value: "changes-requested", label: "Changes requested" },
  { value: "approved", label: "Approved" },
  { value: "done", label: "Done" },
]

export const THINGS_TO_DO_PRIORITIES: { value: ThingsToDoPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
]

export const THINGS_TO_DO_LINKED_TYPES: { value: ThingsToDoLinkedType; label: string }[] = [
  { value: "content", label: "Content" },
  { value: "campaign", label: "Campaign" },
  { value: "event", label: "Event" },
  { value: "media", label: "Media" },
  { value: "website-page", label: "Website page" },
  { value: "newsletter", label: "Newsletter" },
  { value: "theme", label: "Theme" },
]

const ROW_GROUP_ORDER: ThingsToDoRowGroup[] = [
  "overdue",
  "due-today",
  "due-this-week",
  "waiting",
  "completed",
]

const ROW_GROUP_LABELS: Record<ThingsToDoRowGroup, string> = {
  overdue: "Overdue",
  "due-today": "Due today",
  "due-this-week": "Due this week",
  waiting: "Waiting / Review",
  completed: "Completed / Approved",
}

const TYPE_CLASSES: Record<ThingsToDoItemType, { bg: string; text: string }> = {
  task: { bg: "bg-blue-100", text: "text-blue-800" },
  review: { bg: "bg-purple-100", text: "text-purple-800" },
  approval: { bg: "bg-amber-100", text: "text-amber-800" },
  blocker: { bg: "bg-red-100", text: "text-red-800" },
  update: { bg: "bg-teal-100", text: "text-teal-800" },
  "follow-up": { bg: "bg-slate-100", text: "text-slate-700" },
  idea: { bg: "bg-violet-100", text: "text-violet-800" },
}

const STATUS_CLASSES: Record<ThingsToDoStatus, { bg: string; text: string }> = {
  "to-do": { bg: "bg-blue-100", text: "text-blue-800" },
  "in-progress": { bg: "bg-sky-100", text: "text-sky-800" },
  waiting: { bg: "bg-purple-100", text: "text-purple-800" },
  "needs-review": { bg: "bg-violet-100", text: "text-violet-800" },
  "changes-requested": { bg: "bg-orange-100", text: "text-orange-800" },
  approved: { bg: "bg-green-100", text: "text-green-800" },
  done: { bg: "bg-emerald-50", text: "text-emerald-700" },
}

const PRIORITY_CLASSES: Record<ThingsToDoPriority, { bg: string; text: string }> = {
  low: { bg: "bg-green-100", text: "text-green-800" },
  medium: { bg: "bg-amber-100", text: "text-amber-800" },
  high: { bg: "bg-red-100", text: "text-red-800" },
  urgent: { bg: "bg-red-200", text: "text-red-950" },
}

const ROW_GROUP_CLASSES: Record<ThingsToDoRowGroup, { dot: string; section: string; row: string }> = {
  overdue: {
    dot: "bg-red-500",
    section: "bg-red-50/50",
    row: "bg-red-50/60 hover:bg-red-50/90",
  },
  "due-today": {
    dot: "bg-amber-500",
    section: "bg-amber-50/50",
    row: "bg-amber-50/60 hover:bg-amber-50/90",
  },
  "due-this-week": {
    dot: "bg-blue-500",
    section: "bg-blue-50/50",
    row: "bg-blue-50/60 hover:bg-blue-50/90",
  },
  waiting: {
    dot: "bg-purple-500",
    section: "bg-purple-50/50",
    row: "bg-purple-50/60 hover:bg-purple-50/90",
  },
  completed: {
    dot: "bg-green-500",
    section: "bg-green-50/50",
    row: "bg-green-50/60 hover:bg-green-50/90",
  },
}

const PRIORITY_ORDER: Record<ThingsToDoPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const STATUS_ORDER: Record<ThingsToDoStatus, number> = {
  "changes-requested": 0,
  "needs-review": 1,
  "in-progress": 2,
  "to-do": 3,
  waiting: 4,
  approved: 5,
  done: 6,
}

const OWNER_SOPHIE: ThingsToDoPerson = { id: "u1", name: "Sophie B.", initials: "SB" }
const OWNER_ALEX: ThingsToDoPerson = { id: "u2", name: "Alex King", initials: "AK" }
const OWNER_JAMES: ThingsToDoPerson = { id: "u3", name: "James M.", initials: "JM" }
const OWNER_EMMA: ThingsToDoPerson = { id: "u4", name: "Emma L.", initials: "EL" }

export function getTypeClasses(type: ThingsToDoItemType) {
  return TYPE_CLASSES[type]
}

export function getStatusClasses(status: ThingsToDoStatus) {
  return STATUS_CLASSES[status]
}

export function getPriorityClasses(priority: ThingsToDoPriority) {
  return PRIORITY_CLASSES[priority]
}

export function getRowGroupClasses(group: ThingsToDoRowGroup) {
  return ROW_GROUP_CLASSES[group]
}

export function getTypeLabel(type: ThingsToDoItemType): string {
  return THINGS_TO_DO_TYPES.find((t) => t.value === type)?.label ?? type
}

export function getStatusLabel(status: ThingsToDoStatus): string {
  return THINGS_TO_DO_STATUSES.find((s) => s.value === status)?.label ?? status
}

export function getPriorityLabel(priority: ThingsToDoPriority): string {
  return THINGS_TO_DO_PRIORITIES.find((p) => p.value === priority)?.label ?? priority
}

export function getRowGroupLabel(group: ThingsToDoRowGroup): string {
  return ROW_GROUP_LABELS[group]
}

function parseDue(dueDate?: string): Date | null {
  if (!dueDate) return null
  try {
    return startOfDay(parseISO(dueDate))
  } catch {
    return null
  }
}

export function assignRowGroup(item: ThingsToDoItem, now = new Date()): ThingsToDoRowGroup {
  if (item.status === "approved" || item.status === "done") {
    return "completed"
  }
  if (
    item.status === "waiting" ||
    item.status === "needs-review" ||
    item.type === "review" ||
    item.type === "approval"
  ) {
    const due = parseDue(item.dueDate)
    if (due && isBefore(due, startOfDay(now))) return "overdue"
    if (due && isSameDay(due, now)) return "due-today"
    if (
      item.status === "waiting" ||
      item.status === "needs-review" ||
      (item.type === "review" && item.status !== "to-do" && item.status !== "in-progress")
    ) {
      return "waiting"
    }
  }

  const due = parseDue(item.dueDate)
  if (!due) {
    return "due-this-week"
  }

  const today = startOfDay(now)
  if (isBefore(due, today)) return "overdue"
  if (isSameDay(due, today)) return "due-today"

  const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
  if (!isAfter(due, weekEnd)) return "due-this-week"

  if (item.type === "review" || item.type === "approval") {
    return "waiting"
  }

  return "due-this-week"
}

export function formatDueDateDisplay(dueDate?: string, now = new Date()): string {
  const due = parseDue(dueDate)
  if (!due) return "—"
  const today = startOfDay(now)
  if (isBefore(due, today)) {
    const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 1) return "Yesterday"
    return format(due, "d MMM yyyy")
  }
  if (isSameDay(due, today)) return "Today"
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
  if (!isAfter(due, weekEnd)) return format(due, "EEE")
  return format(due, "d MMM yyyy")
}

export function formatDueDateLong(dueDate?: string): string {
  const due = parseDue(dueDate)
  if (!due) return "—"
  return format(due, "d MMMM yyyy")
}

function itemInDateRange(item: ThingsToDoItem, range: ThingsToDoDateRange, now = new Date()): boolean {
  if (range === "all") return true
  const due = parseDue(item.dueDate)
  const today = startOfDay(now)

  if (range === "this_week") {
    const weekStart = startOfWeek(today, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
    if (!due) return true
    return isWithinInterval(due, { start: weekStart, end: weekEnd })
  }

  if (range === "next_30_days") {
    const end = addDays(today, 30)
    if (!due) return true
    return !isAfter(due, endOfDay(end)) || isBefore(due, today)
  }

  if (range === "this_quarter") {
    const qEnd = endOfQuarter(today)
    if (!due) return true
    return !isAfter(due, qEnd) || isBefore(due, today)
  }

  return true
}

export function filterThingsToDoItems(
  items: ThingsToDoItem[],
  filters: ThingsToDoFilters,
  searchQuery: string,
  dateRange: ThingsToDoDateRange,
  statusChip?: string
): ThingsToDoItem[] {
  const q = searchQuery.trim().toLowerCase()
  const now = new Date()

  return items.filter((item) => {
    if (!itemInDateRange(item, dateRange, now)) return false

    if (filters.types.length && !filters.types.includes(item.type)) return false
    if (filters.statuses.length && !filters.statuses.includes(item.status)) return false
    if (filters.priorities.length && !filters.priorities.includes(item.priority)) return false
    if (filters.owners.length && (!item.owner || !filters.owners.includes(item.owner.id))) return false
    if (filters.reviewers.length && (!item.reviewer || !filters.reviewers.includes(item.reviewer.id)))
      return false
    if (filters.campaigns.length && (!item.campaign || !filters.campaigns.includes(item.campaign.id)))
      return false
    if (filters.contentTypes.length && (!item.contentType || !filters.contentTypes.includes(item.contentType)))
      return false
    if (filters.channels.length && (!item.channel || !filters.channels.includes(item.channel))) return false

    if (filters.linkedTypes.length) {
      const types = new Set(item.linkedItems?.map((l) => l.type) ?? [])
      if (!filters.linkedTypes.some((t) => types.has(t as ThingsToDoLinkedType))) return false
    }

    if (filters.dueDatePreset) {
      const group = assignRowGroup(item, now)
      if (filters.dueDatePreset === "overdue" && group !== "overdue") return false
      if (filters.dueDatePreset === "today" && group !== "due-today") return false
      if (filters.dueDatePreset === "this-week" && group !== "due-this-week") return false
    }

    if (statusChip && statusChip !== "all") {
      if (statusChip === "to-do" && item.status !== "to-do") return false
      if (statusChip === "in-progress" && item.status !== "in-progress") return false
    }

    if (q) {
      const hay = [
        item.title,
        item.description,
        item.contentType,
        item.channel,
        item.campaign?.title,
        item.theme?.title,
        item.owner?.name,
        item.reviewer?.name,
        ...(item.linkedItems?.map((l) => l.title) ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      if (!hay.includes(q)) return false
    }

    return true
  })
}

export function sortThingsToDoItems(items: ThingsToDoItem[], sortBy: ThingsToDoSort): ThingsToDoItem[] {
  const copy = [...items]
  copy.sort((a, b) => {
    if (sortBy === "priority") {
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    }
    if (sortBy === "status") {
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    }
    const da = parseDue(a.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER
    const db = parseDue(b.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER
    return da - db
  })
  return copy
}

export function computeThingsToDoStats(items: ThingsToDoItem[], now = new Date()): ThingsToDoStats {
  let overdue = 0
  let dueToday = 0
  let dueThisWeek = 0
  let waiting = 0
  let completed = 0

  for (const item of items) {
    const g = assignRowGroup(item, now)
    if (g === "overdue") overdue++
    else if (g === "due-today") dueToday++
    else if (g === "due-this-week") dueThisWeek++
    else if (g === "waiting") waiting++
    else if (g === "completed") completed++
  }

  return { overdue, dueToday, dueThisWeek, waiting, completed }
}

export function groupItemsByDueSection(
  items: ThingsToDoItem[],
  now = new Date()
): ThingsToDoRowGroupSection[] {
  const buckets = new Map<ThingsToDoRowGroup, ThingsToDoItem[]>()
  for (const key of ROW_GROUP_ORDER) {
    buckets.set(key, [])
  }
  for (const item of items) {
    const g = assignRowGroup(item, now)
    buckets.get(g)!.push(item)
  }
  return ROW_GROUP_ORDER.map((key) => {
    const groupItems = buckets.get(key) ?? []
    return {
      key,
      label: getRowGroupLabel(key),
      count: groupItems.length,
      items: groupItems,
    }
  }).filter((s) => s.items.length > 0)
}

function groupItemsByStatus(items: ThingsToDoItem[]): ThingsToDoRowGroupSection[] {
  const order = THINGS_TO_DO_STATUSES.map((s) => s.value)
  const buckets = new Map<string, ThingsToDoItem[]>()
  for (const item of items) {
    const k = item.status
    buckets.set(k, [...(buckets.get(k) ?? []), item])
  }
  return order
    .filter((status) => buckets.has(status))
    .map((status) => {
      const groupItems = buckets.get(status) ?? []
      return {
        key: status,
        label: getStatusLabel(status),
        count: groupItems.length,
        items: groupItems,
      }
    })
}

function groupItemsByCampaign(items: ThingsToDoItem[]): ThingsToDoRowGroupSection[] {
  const map = new Map<string, ThingsToDoItem[]>()
  for (const item of items) {
    const id = item.campaign?.id ?? "__none__"
    map.set(id, [...(map.get(id) ?? []), item])
  }
  const sections: ThingsToDoRowGroupSection[] = []
  for (const [id, groupItems] of map) {
    const label =
      id === "__none__" ? "No campaign" : groupItems[0]?.campaign?.title ?? "Campaign"
    sections.push({
      key: id,
      label,
      count: groupItems.length,
      items: groupItems,
    })
  }
  return sections.sort((a, b) => {
    if (a.key === "__none__") return 1
    if (b.key === "__none__") return -1
    return a.label.localeCompare(b.label)
  })
}

function groupItemsByPriority(items: ThingsToDoItem[]): ThingsToDoRowGroupSection[] {
  const order = THINGS_TO_DO_PRIORITIES.map((p) => p.value)
  const buckets = new Map<ThingsToDoPriority, ThingsToDoItem[]>()
  for (const item of items) {
    buckets.set(item.priority, [...(buckets.get(item.priority) ?? []), item])
  }
  return order
    .filter((p) => buckets.has(p))
    .map((priority) => {
      const groupItems = buckets.get(priority) ?? []
      return {
        key: priority,
        label: getPriorityLabel(priority),
        count: groupItems.length,
        items: groupItems,
      }
    })
}

export function groupThingsToDoItems(
  items: ThingsToDoItem[],
  grouping: ThingsToDoGrouping,
  now = new Date()
): ThingsToDoRowGroupSection[] {
  switch (grouping) {
    case "status":
      return groupItemsByStatus(items)
    case "campaign":
      return groupItemsByCampaign(items)
    case "priority":
      return groupItemsByPriority(items)
    case "due-date":
    default:
      return groupItemsByDueSection(items, now)
  }
}

export function collectFilterOptions(items: ThingsToDoItem[]) {
  const owners = new Map<string, ThingsToDoPerson>()
  const reviewers = new Map<string, ThingsToDoPerson>()
  const campaigns = new Map<string, string>()
  const contentTypes = new Set<string>()
  const channels = new Set<string>()

  for (const item of items) {
    if (item.owner) owners.set(item.owner.id, item.owner)
    if (item.reviewer) reviewers.set(item.reviewer.id, item.reviewer)
    if (item.campaign) campaigns.set(item.campaign.id, item.campaign.title)
    if (item.contentType) contentTypes.add(item.contentType)
    if (item.channel) channels.add(item.channel)
  }

  return {
    owners: Array.from(owners.values()).sort((a, b) => a.name.localeCompare(b.name)),
    reviewers: Array.from(reviewers.values()).sort((a, b) => a.name.localeCompare(b.name)),
    campaigns: Array.from(campaigns.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title)),
    contentTypes: Array.from(contentTypes).sort(),
    channels: Array.from(channels).sort(),
  }
}

export const EMPTY_THINGS_TO_DO_FILTERS: ThingsToDoFilters = {
  types: [],
  statuses: [],
  priorities: [],
  owners: [],
  reviewers: [],
  campaigns: [],
  linkedTypes: [],
  contentTypes: [],
  channels: [],
  dueDatePreset: undefined,
}

export const THINGS_TO_DO_MOCK_ITEMS: ThingsToDoItem[] = [
  {
    id: "ttd-1",
    title: "ARC newsletter approval",
    description:
      "Final review of ARC 2026 newsletter content, links and imagery before send to broker list.",
    type: "review",
    status: "needs-review",
    priority: "high",
    owner: OWNER_SOPHIE,
    reviewer: OWNER_ALEX,
    dueDate: "2025-05-20",
    campaign: { id: "c-arc", title: "ARC 2026" },
    theme: { id: "t-racing", title: "Racing Logistics" },
    contentType: "Email",
    channel: "Email",
    linkedItems: [
      { id: "li-1", type: "newsletter", title: "ARC 2026 Newsletter" },
      { id: "li-2", type: "campaign", title: "ARC 2026" },
    ],
    checklist: [
      { id: "cl-1", label: "Content reviewed", completed: true },
      { id: "cl-2", label: "Links checked", completed: true },
      { id: "cl-3", label: "Images confirmed", completed: false },
    ],
    commentsCount: 3,
  },
  {
    id: "ttd-2",
    title: "Monaco Yacht Show page copy",
    type: "task",
    status: "in-progress",
    priority: "medium",
    owner: OWNER_JAMES,
    dueDate: "2025-05-22",
    campaign: { id: "c-monaco", title: "Monaco Yacht Show" },
    contentType: "Website page",
    channel: "Website",
    linkedItems: [{ id: "li-3", type: "website-page", title: "Monaco Yacht Show 2025" }],
  },
  {
    id: "ttd-3",
    title: "Sustainability article image",
    type: "blocker",
    status: "changes-requested",
    priority: "high",
    owner: OWNER_EMMA,
    reviewer: OWNER_ALEX,
    dueDate: "2025-05-19",
    theme: { id: "t-sus", title: "Sustainability" },
    contentType: "Blog",
    channel: "Website",
    linkedItems: [{ id: "li-4", type: "content", title: "Sustainability article draft" }],
    commentsCount: 1,
  },
  {
    id: "ttd-4",
    title: "Southampton Boat Show posts",
    type: "task",
    status: "to-do",
    priority: "medium",
    owner: OWNER_SOPHIE,
    dueDate: "2025-05-22",
    campaign: { id: "c-sbs", title: "Southampton Boat Show" },
    contentType: "Social media",
    channel: "LinkedIn",
    linkedItems: [{ id: "li-5", type: "content", title: "SBS social pack" }],
  },
  {
    id: "ttd-5",
    title: "NYYC sponsorship graphics",
    type: "approval",
    status: "waiting",
    priority: "high",
    owner: OWNER_EMMA,
    reviewer: OWNER_SOPHIE,
    dueDate: "2025-05-24",
    contentType: "Graphics",
    channel: "Internal",
    linkedItems: [{ id: "li-6", type: "media", title: "NYYC sponsorship deck" }],
  },
  {
    id: "ttd-6",
    title: "Forwarding explainer post",
    type: "update",
    status: "in-progress",
    priority: "low",
    owner: OWNER_JAMES,
    dueDate: "2025-05-23",
    theme: { id: "t-fwd", title: "Forwarding" },
    contentType: "Social media",
    channel: "LinkedIn",
  },
  {
    id: "ttd-7",
    title: "Website home page hero",
    type: "task",
    status: "to-do",
    priority: "high",
    owner: OWNER_ALEX,
    dueDate: "2025-05-22",
    contentType: "Website page",
    channel: "Website",
    linkedItems: [{ id: "li-7", type: "website-page", title: "Home page" }],
  },
  {
    id: "ttd-8",
    title: "Fort Lauderdale campaign email",
    type: "task",
    status: "in-progress",
    priority: "medium",
    owner: OWNER_SOPHIE,
    dueDate: "2025-05-26",
    campaign: { id: "c-ftl", title: "Fort Lauderdale" },
    contentType: "Email",
    channel: "Email",
    linkedItems: [{ id: "li-8", type: "campaign", title: "Fort Lauderdale" }],
  },
  {
    id: "ttd-9",
    title: "Reviews campaign case study",
    type: "review",
    status: "needs-review",
    priority: "medium",
    owner: OWNER_JAMES,
    reviewer: OWNER_ALEX,
    dueDate: "2025-05-25",
    contentType: "Case study",
    channel: "Website",
  },
  {
    id: "ttd-10",
    title: "Monaco show video edit",
    type: "task",
    status: "waiting",
    priority: "medium",
    owner: OWNER_EMMA,
    dueDate: "2025-05-27",
    campaign: { id: "c-monaco", title: "Monaco Yacht Show" },
    contentType: "Video",
    channel: "Instagram",
    linkedItems: [{ id: "li-9", type: "media", title: "Monaco show reel" }],
  },
  {
    id: "ttd-11",
    title: "ARC event landing page",
    type: "update",
    status: "in-progress",
    priority: "high",
    owner: OWNER_ALEX,
    dueDate: "2025-05-28",
    campaign: { id: "c-arc", title: "ARC 2026" },
    contentType: "Website page",
    channel: "Website",
    linkedItems: [
      { id: "li-10", type: "event", title: "ARC 2026" },
      { id: "li-11", type: "website-page", title: "ARC landing page" },
    ],
  },
  {
    id: "ttd-12",
    title: "Sailing schedule newsletter",
    type: "approval",
    status: "waiting",
    priority: "medium",
    owner: OWNER_SOPHIE,
    reviewer: OWNER_ALEX,
    dueDate: "2025-05-29",
    contentType: "Newsletter",
    channel: "Email",
    linkedItems: [{ id: "li-12", type: "newsletter", title: "Sailing schedule Q2" }],
  },
  {
    id: "ttd-13",
    title: "Broker briefing deck",
    type: "review",
    status: "waiting",
    priority: "high",
    owner: OWNER_JAMES,
    reviewer: OWNER_SOPHIE,
    dueDate: "2025-05-30",
    contentType: "Presentation",
    channel: "Internal",
    linkedItems: [{ id: "li-13", type: "media", title: "Broker briefing deck" }],
  },
  {
    id: "ttd-14",
    title: "Partnership announcement post",
    type: "follow-up",
    status: "to-do",
    priority: "low",
    owner: OWNER_EMMA,
    dueDate: "2025-06-02",
    contentType: "Social media",
    channel: "LinkedIn",
  },
  {
    id: "ttd-15",
    title: "Press release draft",
    type: "task",
    status: "to-do",
    priority: "medium",
    owner: OWNER_ALEX,
    dueDate: "2025-06-03",
    contentType: "Press release",
    channel: "PR",
  },
  {
    id: "ttd-16",
    title: "ARC 2026 hero image",
    type: "approval",
    status: "approved",
    priority: "medium",
    owner: OWNER_EMMA,
    reviewer: OWNER_SOPHIE,
    dueDate: "2025-05-15",
    campaign: { id: "c-arc", title: "ARC 2026" },
    contentType: "Image",
    channel: "Website",
    linkedItems: [{ id: "li-14", type: "media", title: "ARC hero image" }],
    checklist: [
      { id: "cl-4", label: "Brand guidelines met", completed: true },
      { id: "cl-5", label: "Resolution approved", completed: true },
    ],
  },
  {
    id: "ttd-17",
    title: "Event invite design",
    type: "idea",
    status: "done",
    priority: "low",
    owner: OWNER_SOPHIE,
    dueDate: "2025-05-10",
    contentType: "Design",
    channel: "Email",
    linkedItems: [{ id: "li-15", type: "event", title: "Summer client event" }],
  },
]

export function getThingsToDoMockItems(): ThingsToDoItem[] {
  return THINGS_TO_DO_MOCK_ITEMS
}
