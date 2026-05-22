/**
 * Map Content table rows → Content Timeline block items.
 */

import { format } from "date-fns"
import {
  buildContentItems,
  resolveContentPlanningFields,
  type ContentPlanningFieldMap,
  type ContentPlanningItem,
} from "@/lib/marketing/content-planning"
import { formatDisplayValue } from "@/lib/marketing/field-utils"
import type {
  ContentTimelineChannel,
  ContentTimelineItem,
  ContentTimelineItemType,
  ContentTimelineStatus,
} from "@/lib/marketing/content-timeline"
import type { FieldOptions } from "@/types/fields"

type FieldRow = { name: string; type?: string; options?: FieldOptions }

const EVENT_TYPE_PATTERN = /^event|commercial event|sponsorship event/i

function toIsoDate(value: unknown): string | null {
  if (value == null || value === "") return null
  const d = value instanceof Date ? value : new Date(String(value))
  if (isNaN(d.getTime())) return null
  return format(d, "yyyy-MM-dd")
}

export function mapContentTypeToTimelineType(
  contentType: string | null
): ContentTimelineItemType {
  if (!contentType) return "campaign"
  const s = contentType.trim().toLowerCase()
  if (/social/i.test(s)) return "social"
  if (/website|web page/i.test(s)) return "website"
  if (/blog|editorial|thought leadership|content$/i.test(s)) return "blog"
  if (/newsletter/i.test(s)) return "newsletter"
  if (/campaign/i.test(s)) return "campaign"
  if (/event/i.test(s)) return "event"
  if (/case study/i.test(s)) return "case-study"
  if (/email/i.test(s)) return "email"
  if (/press/i.test(s)) return "press-release"
  if (/ad|paid/i.test(s)) return "ad"
  if (/task/i.test(s)) return "blog"
  return "campaign"
}

export function mapContentStatusToTimelineStatus(
  status: string | null
): ContentTimelineStatus {
  if (!status) return "planned"
  const s = status.trim().toLowerCase()
  if (/draft|idea|todo|to do/i.test(s)) return "draft"
  if (/review|awaiting|pending/i.test(s)) return "needs-review"
  if (/approv/i.test(s)) return "approved"
  if (/schedul|planned|ready/i.test(s)) return "scheduled"
  if (/publish|complete|done|live|posted/i.test(s)) return "published"
  if (/update|refresh/i.test(s)) return "needs-update"
  if (/progress|wip/i.test(s)) return "draft"
  return "planned"
}

function mapChannel(
  row: Record<string, unknown>,
  channelsField: string | null
): ContentTimelineChannel {
  const fromMulti = channelsField ? formatDisplayValue(row[channelsField]) : null
  if (fromMulti) {
    const first = fromMulti.split(",")[0]?.trim().toLowerCase() ?? ""
    if (first.includes("linkedin")) return "linkedin"
    if (first.includes("instagram")) return "instagram"
    if (first.includes("facebook")) return "facebook"
    if (first.includes("twitter") || first === "x") return "twitter"
    if (first.includes("email") || first.includes("mail")) return "email"
    if (first.includes("website") || first.includes("web")) return "website"
    if (first.includes("print")) return "print"
  }
  if (row.linkedin) return "linkedin"
  if (row.instagram) return "instagram"
  return "other"
}

function deriveAssetStatus(row: Record<string, unknown>, imagesField: string | null): string | undefined {
  const images = imagesField ? row[imagesField] : row.images
  if (images == null || images === "" || (Array.isArray(images) && images.length === 0)) {
    return "Missing assets"
  }
  return undefined
}

export function buildContentTimelineItems(params: {
  contentRows: Record<string, unknown>[]
  fields: ContentPlanningFieldMap
  contentFields: FieldRow[]
  planningItems: ContentPlanningItem[]
  campaignLabelById: Map<string, string>
  profileLabelById: Map<string, string>
  contentTableId: string
  contentSupabaseTable: string
  excludeEventTypes?: boolean
}): ContentTimelineItem[] {
  const {
    contentRows,
    fields,
    contentFields,
    planningItems,
    campaignLabelById,
    profileLabelById,
    contentTableId,
    contentSupabaseTable,
    excludeEventTypes = true,
  } = params

  const planningById = new Map(planningItems.map((p) => [p.id, p]))
  const imagesField =
    contentFields.find((f) => /^images$/i.test(f.name))?.name ?? "images"
  const divisionField =
    contentFields.find((f) => /primary_division|^division$/i.test(f.name))?.name ??
    fields.contentDivision
  const notesField =
    contentFields.find((f) => /notes_detail|^description$/i.test(f.name))?.name ?? null

  const items: ContentTimelineItem[] = []

  for (const row of contentRows) {
    const id = String(row.id)
    const planning = planningById.get(id)
    const title = planning?.title ?? formatDisplayValue(row[fields.contentName]) ?? ""
    if (!title.trim()) continue

    const contentType = planning?.contentType ?? formatDisplayValue(row[fields.contentType])
    if (excludeEventTypes && contentType && EVENT_TYPE_PATTERN.test(contentType)) {
      continue
    }

    const startIso =
      (planning?.date ? format(planning.date, "yyyy-MM-dd") : null) ??
      (fields.contentDate ? toIsoDate(row[fields.contentDate]) : null) ??
      (fields.contentDueDate ? toIsoDate(row[fields.contentDueDate]) : null)
    if (!startIso) continue

    const dateToField = contentFields.find((f) => /^date_to$/i.test(f.name))?.name ?? "date_to"
    const endFromRow = toIsoDate(row[dateToField])
    const dueIso = planning?.dueDate
      ? format(planning.dueDate, "yyyy-MM-dd")
      : fields.contentDueDate
        ? toIsoDate(row[fields.contentDueDate])
        : null

    let ownerLabel = planning?.assignee ?? null
    if (!ownerLabel && fields.contentOwner) {
      const raw = row[fields.contentOwner]
      const ownerId =
        typeof raw === "string"
          ? raw
          : raw && typeof raw === "object" && "id" in (raw as object)
            ? String((raw as { id: string }).id)
            : null
      ownerLabel = (ownerId && profileLabelById.get(ownerId)) || formatDisplayValue(raw)
    }

    const campaignIds = planning?.campaignIds ?? []
    const campaignLabel =
      campaignIds
        .map((cid) => campaignLabelById.get(cid))
        .filter(Boolean)
        .join(", ") || undefined

    const statusRaw = planning?.status ?? formatDisplayValue(row[fields.contentStatus])
    const themeLabel = planning?.themeLabel?.trim() || "Unassigned"
    const division =
      (divisionField ? formatDisplayValue(row[divisionField]) : null) ??
      planning?.division ??
      undefined

    items.push({
      id,
      title,
      theme: themeLabel,
      type: mapContentTypeToTimelineType(contentType),
      channel: mapChannel(row, "channels"),
      status: mapContentStatusToTimelineStatus(statusRaw),
      owner: ownerLabel ?? undefined,
      startDate: startIso,
      endDate: endFromRow ?? undefined,
      publishDate: dueIso ?? endFromRow ?? undefined,
      campaign: campaignLabel,
      division,
      brief: notesField ? formatDisplayValue(row[notesField]) ?? undefined : undefined,
      notes: formatDisplayValue(row.notes_detail) ?? undefined,
      assetStatus: deriveAssetStatus(row, imagesField),
      approvalStatus: /review|awaiting/i.test(statusRaw ?? "") ? statusRaw ?? undefined : undefined,
      colour: planning?.accentColor,
      recordTableId: contentTableId,
      recordSupabaseTable: contentSupabaseTable,
    })
  }

  return items
}

export { resolveContentPlanningFields, buildContentItems }
