/**
 * Map Content table rows → Things To Do block items.
 */

import { format } from "date-fns"
import { formatDisplayValue } from "@/lib/marketing/field-utils"
import type { ContentPlanningFieldMap } from "@/lib/marketing/content-planning"
import type {
  ThingsToDoItem,
  ThingsToDoItemType,
  ThingsToDoLinkedItem,
  ThingsToDoPriority,
  ThingsToDoStatus,
} from "@/lib/marketing/things-to-do"

const TASK_TYPE_PATTERN = /^task$/i
const REVIEW_STATUS_PATTERN = /review|awaiting|pending approval/i
const ACTIONABLE_STATUS_PATTERN = /to\s*do|todo|in\s*progress|waiting|changes/i

function extractLinkedId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (value && typeof value === "object" && "id" in (value as object)) {
    return String((value as { id: string }).id)
  }
  if (Array.isArray(value) && value.length > 0) return extractLinkedId(value[0])
  return null
}

function toIsoDate(value: unknown): string | undefined {
  if (value == null || value === "") return undefined
  const d = value instanceof Date ? value : new Date(String(value))
  if (isNaN(d.getTime())) return undefined
  return format(d, "yyyy-MM-dd")
}

function mapStatus(status: string | null): ThingsToDoStatus {
  if (!status) return "to-do"
  const s = status.trim().toLowerCase()
  if (/done|complete|published/i.test(s)) return "done"
  if (/schedul|planned|queued|ready/i.test(s)) return "scheduled"
  if (/approv/i.test(s)) return "approved"
  if (/changes/i.test(s)) return "changes-requested"
  if (/review|awaiting/i.test(s)) return "needs-review"
  if (/waiting|hold/i.test(s)) return "waiting"
  if (/progress|wip/i.test(s)) return "in-progress"
  return "to-do"
}

function mapPriority(priority: string | null): ThingsToDoPriority {
  if (!priority) return "medium"
  const s = priority.trim().toLowerCase()
  if (/urgent|critical/i.test(s)) return "urgent"
  if (/high/i.test(s)) return "high"
  if (/low/i.test(s)) return "low"
  return "medium"
}

function mapItemType(contentType: string | null, status: string | null): ThingsToDoItemType {
  if (status && REVIEW_STATUS_PATTERN.test(status)) return "review"
  if (contentType && /approv/i.test(contentType)) return "approval"
  if (contentType && TASK_TYPE_PATTERN.test(contentType)) return "task"
  if (status && /block/i.test(status)) return "blocker"
  return "task"
}

function personFromId(
  id: string | null,
  profileLabelById: Map<string, string>
): ThingsToDoItem["owner"] {
  if (!id) return undefined
  const name = profileLabelById.get(id) ?? id.slice(0, 8)
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  return { id, name, initials: initials || "?" }
}

export function isThingsToDoContentRow(
  row: Record<string, unknown>,
  fields: ContentPlanningFieldMap
): boolean {
  const typeRaw = fields.contentType ? formatDisplayValue(row[fields.contentType]) : null
  const statusRaw = fields.contentStatus ? formatDisplayValue(row[fields.contentStatus]) : null
  if (typeRaw && TASK_TYPE_PATTERN.test(typeRaw)) return true
  if (statusRaw && (REVIEW_STATUS_PATTERN.test(statusRaw) || ACTIONABLE_STATUS_PATTERN.test(statusRaw))) {
    return true
  }
  if (fields.contentDueDate && row[fields.contentDueDate]) return true
  return false
}

export function buildThingsToDoItems(params: {
  contentRows: Record<string, unknown>[]
  fields: ContentPlanningFieldMap
  profileLabelById: Map<string, string>
  campaignLabelById: Map<string, string>
  themeLabelById: Map<string, string>
  contentTableId: string
  contentSupabaseTable: string
}): ThingsToDoItem[] {
  const {
    contentRows,
    fields,
    profileLabelById,
    campaignLabelById,
    themeLabelById,
    contentTableId,
    contentSupabaseTable,
  } = params

  const items: ThingsToDoItem[] = []

  for (const row of contentRows) {
    if (!isThingsToDoContentRow(row, fields)) continue

    const id = String(row.id)
    const title = formatDisplayValue(row[fields.contentName])
    if (!title?.trim()) continue

    const contentType = fields.contentType ? formatDisplayValue(row[fields.contentType]) : null
    const statusRaw = fields.contentStatus ? formatDisplayValue(row[fields.contentStatus]) : null
    const priorityRaw = formatDisplayValue(row.priority) ?? null

    const ownerId = fields.contentOwner ? extractLinkedId(row[fields.contentOwner]) : null
    const reviewerId = formatDisplayValue(row.approved_by)
      ? extractLinkedId(row.post_originator_approve ?? row.approved_by)
      : null

    const themeId = fields.contentTheme ? extractLinkedId(row[fields.contentTheme]) : null
    const campaignId = fields.contentCampaign ? extractLinkedId(row[fields.contentCampaign]) : null

    const dueDate =
      (fields.contentDueDate ? toIsoDate(row[fields.contentDueDate]) : undefined) ??
      (fields.contentDate ? toIsoDate(row[fields.contentDate]) : undefined)

    const linkedItems: ThingsToDoLinkedItem[] = [
      {
        id,
        type: contentType && /event/i.test(contentType) ? "event" : "content",
        title,
        tableName: "Content",
      },
    ]

    const channels = formatDisplayValue(row.channels)

    items.push({
      id,
      title,
      description: formatDisplayValue(row.notes_detail) ?? formatDisplayValue(row.description) ?? undefined,
      type: mapItemType(contentType, statusRaw),
      status: mapStatus(statusRaw),
      priority: mapPriority(priorityRaw),
      owner: personFromId(ownerId, profileLabelById),
      reviewer: personFromId(reviewerId, profileLabelById),
      dueDate,
      contentType: contentType ?? undefined,
      channel: channels ?? undefined,
      campaign: campaignId
        ? { id: campaignId, title: campaignLabelById.get(campaignId) ?? "Campaign" }
        : undefined,
      theme: themeId
        ? { id: themeId, title: themeLabelById.get(themeId) ?? "Theme" }
        : undefined,
      linkedItems,
      recordTableId: contentTableId,
      recordSupabaseTable: contentSupabaseTable,
    })
  }

  return items
}
