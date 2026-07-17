/**
 * Map Content, Campaigns, and event-type Content rows → Upcoming Summary sections.
 */

import { format, isBefore, startOfDay } from "date-fns"
import { formatDisplayValue, pickFieldName } from "@/lib/marketing/field-utils"
import {
  buildContentItems,
  resolveContentPlanningFields,
  type ContentPlanningFieldMap,
} from "@/lib/marketing/content-planning"
import { isEventContentRecord } from "@/lib/marketing/events"
import type {
  ApprovalItem,
  BlockerItem,
  BlockerReason,
  CampaignItem,
  DeadlineItem,
  DeadlinePriority,
  DeadlineStatus,
  EventItem,
  PublishedItem,
} from "@/lib/interface/upcoming-summary-mock-data"
import type { FieldOptions } from "@/types/fields"

type FieldRow = { name: string; type?: string; options?: FieldOptions }

const EVENT_TYPE_PATTERN = /^event|commercial event|sponsorship event/i
const COMPLETED_STATUS = /published|complete|completed|done|live|posted/i
const APPROVAL_STATUS = /awaiting approval|pending approval|needs review|in review|review/i
const SCHEDULED_STATUS = /schedul|planned|ready/i
const APPROVED_STATUS = /approv/i

function toIsoDate(value: unknown): string | null {
  if (value == null || value === "") return null
  const d = value instanceof Date ? value : new Date(String(value))
  if (isNaN(d.getTime())) return null
  return format(d, "yyyy-MM-dd")
}

function extractLinkedIds(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()]
  if (value && typeof value === "object" && "id" in (value as object)) {
    return [String((value as { id: string }).id)]
  }
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (typeof v === "string") return v.trim()
        if (v && typeof v === "object" && "id" in v) return String((v as { id: string }).id)
        return null
      })
      .filter(Boolean) as string[]
  }
  return []
}

function ownerInitials(name: string | null | undefined): string | undefined {
  if (!name?.trim()) return undefined
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function channelKey(contentType: string | null): string {
  if (!contentType) return "file"
  const s = contentType.toLowerCase()
  if (/email|newsletter|mail/i.test(s)) return "mail"
  if (/linkedin/i.test(s)) return "linkedin"
  if (/social|instagram|facebook|twitter|tiktok/i.test(s)) return "message"
  if (/website|web page|landing/i.test(s)) return "globe"
  return "file"
}

function mapDeadlineStatus(
  status: string | null,
  dueIso: string,
  today: Date
): DeadlineStatus {
  const due = startOfDay(new Date(`${dueIso}T12:00:00`))
  if (isBefore(due, today) && (!status || !COMPLETED_STATUS.test(status))) {
    return "overdue"
  }
  if (!status) return "to-do"
  const s = status.trim().toLowerCase()
  if (/await|review|pending/i.test(s)) return "awaiting-approval"
  if (/approv/i.test(s)) return "approved"
  if (/schedul|planned|ready/i.test(s)) return "scheduled"
  if (/progress|wip/i.test(s)) return "in-progress"
  if (/publish|complete|done/i.test(s)) return "approved"
  return "to-do"
}

function mapPriority(raw: string | null): DeadlinePriority | undefined {
  if (!raw) return undefined
  const s = raw.toLowerCase()
  if (/urgent|critical|high/i.test(s)) return "high"
  if (/low/i.test(s)) return "low"
  if (/medium/i.test(s)) return "medium"
  return undefined
}

function rowPassesGuards(row: Record<string, unknown>, fields: ContentPlanningFieldMap): boolean {
  if (fields.isArchived) {
    const v = row[fields.isArchived]
    if (v === true || v === "true" || v === 1) return false
  }
  if (fields.deletedAt && row[fields.deletedAt]) return false
  if (row.deleted_at) return false
  return true
}

function contentLinkedToCampaign(
  row: Record<string, unknown>,
  fields: ContentPlanningFieldMap,
  campaignId: string
): boolean {
  if (!fields.contentCampaign) return false
  return extractLinkedIds(row[fields.contentCampaign]).includes(campaignId)
}

function countContentByCampaign(
  contentRows: Record<string, unknown>[],
  fields: ContentPlanningFieldMap,
  campaignId: string
): { planned: number; scheduled: number; approved: number } {
  let planned = 0
  let scheduled = 0
  let approved = 0
  for (const row of contentRows) {
    if (!contentLinkedToCampaign(row, fields, campaignId)) continue
    const status = fields.contentStatus ? formatDisplayValue(row[fields.contentStatus]) : null
    if (!status || COMPLETED_STATUS.test(status)) continue
    planned += 1
    if (status && SCHEDULED_STATUS.test(status)) scheduled += 1
    if (status && APPROVED_STATUS.test(status)) approved += 1
  }
  return { planned, scheduled, approved }
}

export interface UpcomingSummaryBuiltData {
  deadlines: DeadlineItem[]
  campaigns: CampaignItem[]
  events: EventItem[]
  approval: ApprovalItem[]
  blockers: BlockerItem[]
  published: PublishedItem[]
}

export function buildUpcomingSummaryData(params: {
  contentRows: Record<string, unknown>[]
  campaignRows: Record<string, unknown>[]
  fields: ContentPlanningFieldMap
  contentFields: FieldRow[]
  campaignFieldRows: FieldRow[]
  themeLabelById: Map<string, string>
  profileLabelById: Map<string, string>
  contentTableId: string
  contentSupabaseTable: string
  campaignsTableId: string
  campaignsSupabaseTable: string
  priorityField?: string | null
}): UpcomingSummaryBuiltData {
  const {
    contentRows,
    campaignRows,
    fields,
    contentFields,
    campaignFieldRows,
    themeLabelById,
    profileLabelById,
    contentTableId,
    contentSupabaseTable,
    campaignsTableId,
    campaignsSupabaseTable,
    priorityField: priorityFieldParam,
  } = params

  const today = startOfDay(new Date())
  const priorityField =
    priorityFieldParam ?? pickFieldName(contentFields, [/priority/i], null)
  const imagesField =
    contentFields.find((f) => /^images$/i.test(f.name))?.name ?? "images"
  const notesField =
    contentFields.find((f) => /notes|brief|description/i.test(f.name))?.name ?? null
  const campaignStartField = pickFieldName(
    campaignFieldRows,
    [/start/i, /launch/i, /date/i],
    null
  )

  const planningItems = buildContentItems({
    contentRows,
    fields,
    contentFields,
    themeLabelById,
    themeColorById: new Map(),
  })
  const planningById = new Map(planningItems.map((p) => [p.id, p]))

  const deadlines: DeadlineItem[] = []
  const approval: ApprovalItem[] = []
  const blockers: BlockerItem[] = []
  const published: PublishedItem[] = []
  const blockerIds = new Set<string>()

  for (const row of contentRows) {
    if (!rowPassesGuards(row, fields)) continue

    const id = String(row.id)
    const planning = planningById.get(id)
    const title =
      planning?.title ?? formatDisplayValue(row[fields.contentName]) ?? ""
    if (!title.trim()) continue

    const contentType =
      planning?.contentType ??
      (fields.contentType ? formatDisplayValue(row[fields.contentType]) : null)
    if (contentType && EVENT_TYPE_PATTERN.test(contentType)) continue

    const status =
      planning?.status ??
      (fields.contentStatus ? formatDisplayValue(row[fields.contentStatus]) : null)

    const themeLabel =
      planning?.themeLabel ??
      (fields.contentTheme
        ? themeLabelById.get(String(row[fields.contentTheme] ?? "")) ??
          formatDisplayValue(row[fields.contentTheme])
        : null)

    const ownerId = fields.contentOwner ? row[fields.contentOwner] : null
    const ownerName =
      typeof ownerId === "string"
        ? profileLabelById.get(ownerId) ?? undefined
        : formatDisplayValue(ownerId) || undefined

    const recordRef = {
      recordTableId: contentTableId,
      recordSupabaseTable: contentSupabaseTable,
    }

    const dueIso =
      (planning?.dueDate ? format(planning.dueDate, "yyyy-MM-dd") : null) ??
      (fields.contentDueDate ? toIsoDate(row[fields.contentDueDate]) : null)

    const publishIso =
      (planning?.date ? format(planning.date, "yyyy-MM-dd") : null) ??
      (fields.contentDate ? toIsoDate(row[fields.contentDate]) : null)

    if (status && COMPLETED_STATUS.test(status) && publishIso) {
      published.push({
        id,
        title,
        publishedDate: publishIso,
        channel: contentType ?? undefined,
        theme: themeLabel ?? undefined,
        ...recordRef,
      })
      continue
    }

    if (status && APPROVAL_STATUS.test(status)) {
      approval.push({
        id,
        title,
        contentType: contentType ?? undefined,
        ownerInitials: ownerInitials(ownerName),
        status: status ?? "Awaiting approval",
        ...recordRef,
      })
      continue
    }

    if (dueIso && (!status || !COMPLETED_STATUS.test(status))) {
      deadlines.push({
        id,
        title,
        owner: ownerName,
        dueDate: dueIso,
        status: mapDeadlineStatus(status, dueIso, today),
        theme: themeLabel ?? undefined,
        priority: priorityField ? mapPriority(formatDisplayValue(row[priorityField])) : undefined,
        channel: channelKey(contentType),
        ...recordRef,
      })
    }

    const blockerReason = detectBlocker(row, fields, imagesField, notesField, publishIso, dueIso)
    if (blockerReason && !blockerIds.has(id)) {
      blockerIds.add(id)
      blockers.push({
        id,
        title,
        reason: blockerReason,
        relatedContent: blockerDetail(blockerReason),
        ...recordRef,
      })
    }
  }

  deadlines.sort((a, b) => {
    if (a.status === "overdue" && b.status !== "overdue") return -1
    if (b.status === "overdue" && a.status !== "overdue") return 1
    return a.dueDate.localeCompare(b.dueDate)
  })

  published.sort((a, b) => b.publishedDate.localeCompare(a.publishedDate))

  const campaigns: CampaignItem[] = []
  for (const row of campaignRows) {
    const id = String(row.id)
    const title = formatDisplayValue(row[fields.campaignName]) || "Campaign"
    const status = fields.campaignStatus
      ? formatDisplayValue(row[fields.campaignStatus])
      : undefined
    const startDate = campaignStartField ? toIsoDate(row[campaignStartField]) ?? undefined : undefined
    const themeId = fields.campaignTheme ? row[fields.campaignTheme] : null
    const theme =
      themeId && typeof themeId === "string"
        ? themeLabelById.get(themeId)
        : formatDisplayValue(themeId) || undefined

    const counts = countContentByCampaign(contentRows, fields, id)

    campaigns.push({
      id,
      title,
      startDate,
      plannedCount: counts.planned,
      scheduledCount: counts.scheduled,
      approvedCount: counts.approved,
      status: status ?? undefined,
      theme,
      recordTableId: campaignsTableId,
      recordSupabaseTable: campaignsSupabaseTable,
    })
  }

  campaigns.sort((a, b) => a.title.localeCompare(b.title))

  const dateToField =
    contentFields.find((f) => /^date_to$/i.test(f.name))?.name ?? "date_to"
  const locationField = pickFieldName(contentFields, [/location/i, /venue/i], null)
  const statusField = fields.contentStatus

  const events: EventItem[] = []
  for (const row of contentRows) {
    if (!rowPassesGuards(row, fields)) continue
    if (!isEventContentRecord(row, fields.contentType)) continue

    const id = String(row.id)
    const planning = planningById.get(id)
    const title =
      planning?.title ?? formatDisplayValue(row[fields.contentName]) ?? "Event"
    const startIso =
      (planning?.date ? format(planning.date, "yyyy-MM-dd") : null) ??
      (fields.contentDate ? toIsoDate(row[fields.contentDate]) : null) ??
      (fields.contentDueDate ? toIsoDate(row[fields.contentDueDate]) : null)
    if (!startIso) continue

    const endIso = toIsoDate(row[dateToField]) ?? undefined
    const status = statusField ? formatDisplayValue(row[statusField]) : null
    const location = locationField ? formatDisplayValue(row[locationField]) : null

    events.push({
      id,
      title,
      startDate: startIso,
      endDate: endIso,
      location: location ?? undefined,
      status: status ?? undefined,
      recordTableId: contentTableId,
      recordSupabaseTable: contentSupabaseTable,
    })
  }
  events.sort((a, b) => a.startDate.localeCompare(b.startDate))

  return { deadlines, campaigns, events, approval, blockers, published }
}

function detectBlocker(
  row: Record<string, unknown>,
  fields: ContentPlanningFieldMap,
  imagesField: string,
  notesField: string | null,
  publishIso: string | null,
  dueIso: string | null
): BlockerReason | null {
  const status = fields.contentStatus ? formatDisplayValue(row[fields.contentStatus]) : null
  if (status && COMPLETED_STATUS.test(status)) return null

  const inFlight =
    !status ||
    /progress|review|await|schedul|plan|wip|to\s*do/i.test(status)
  if (!inFlight) return null

  const startIso = fields.contentDate ? toIsoDate(row[fields.contentDate]) : null
  if (!publishIso && !dueIso && !startIso) {
    return "date-not-set"
  }

  const images = row[imagesField]
  if (
    images == null ||
    images === "" ||
    (Array.isArray(images) && images.length === 0)
  ) {
    return "missing-image"
  }

  const notes = notesField ? formatDisplayValue(row[notesField]) : null
  if (!notes?.trim() && /progress|review|await|schedul/i.test(status ?? "")) {
    return "missing-brief"
  }

  const name = fields.contentName ? formatDisplayValue(row[fields.contentName]) : null
  if (!name || name.trim().length < 3) return "missing-copy"

  return null
}

function blockerDetail(reason: BlockerReason): string {
  switch (reason) {
    case "date-not-set":
      return "Publish or due date not set"
    case "missing-brief":
      return "Brief or notes missing"
    case "missing-image":
      return "No image attached"
    case "missing-copy":
      return "Title or copy incomplete"
    case "needs-approval":
      return "Needs approval"
    default:
      return reason
  }
}

/** Exported for tests */
export function isUpcomingSummaryEventRow(
  row: Record<string, unknown>,
  contentTypeField: string | null
): boolean {
  return isEventContentRecord(row, contentTypeField)
}
