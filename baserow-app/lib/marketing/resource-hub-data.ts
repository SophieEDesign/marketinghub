/**
 * Map Media Links Resources table → Internal Resource Hub cards.
 */

import { format } from "date-fns"
import { formatDisplayValue } from "@/lib/marketing/field-utils"
import type {
  MockResource,
  ResourceCategory,
  ResourceFileType,
} from "@/components/interface/blocks/internal-resource-hub/types"

export interface MediaFieldMap {
  name: string
  notes: string | null
  status: string | null
  documentLink: string | null
  assignee: string | null
  updatedAt: string | null
}

export function resolveMediaFields(
  fields: Array<{ name: string }>
): MediaFieldMap {
  const pick = (patterns: RegExp[], fallback: string | null = null) => {
    for (const p of patterns) {
      const hit = fields.find((f) => p.test(f.name))
      if (hit) return hit.name
    }
    return fallback
  }
  return {
    name: pick([/^name$/i], "name")!,
    notes: pick([/^notes$/i], null),
    status: pick([/^status$/i], null),
    documentLink: pick([/document_link/i, /link/i, /url/i], "document_link"),
    assignee: pick([/assignee/i, /owned_by/i, /owner/i], null),
    updatedAt: pick([/^updated_at$/i], "updated_at"),
  }
}

function fileTypeFromUrl(url: string | null): ResourceFileType {
  if (!url) return "PDF"
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? ""
  switch (ext) {
    case "png":
      return "PNG"
    case "jpg":
    case "jpeg":
      return "JPG"
    case "svg":
      return "SVG"
    case "docx":
    case "doc":
      return "DOCX"
    case "pptx":
    case "ppt":
      return "PPTX"
    case "xlsx":
    case "xls":
      return "XLSX"
    case "mp4":
    case "mov":
      return "MP4"
    case "zip":
      return "ZIP"
    default:
      return "PDF"
  }
}

function categoryFromRow(
  status: string | null,
  fileType: ResourceFileType
): ResourceCategory {
  const s = (status ?? "").toLowerCase()
  if (/logo/i.test(s)) return "logos"
  if (/brand|guideline/i.test(s)) return "brand-guidelines"
  if (/template/i.test(s)) return "templates"
  if (/video/i.test(s)) return "videos"
  if (fileType === "PPTX") return "presentations"
  if (fileType === "PNG" || fileType === "JPG" || fileType === "SVG") return "images"
  return "documents"
}

export function buildResourceHubItems(
  rows: Record<string, unknown>[],
  fields: MediaFieldMap,
  mediaTableId: string
): MockResource[] {
  return rows
    .map((row) => {
      const title = formatDisplayValue(row[fields.name])
      if (!title?.trim()) return null
      const url = fields.documentLink ? formatDisplayValue(row[fields.documentLink]) : null
      const fileType = fileTypeFromUrl(url)
      const status = fields.status ? formatDisplayValue(row[fields.status]) : null
      const updatedRaw = fields.updatedAt ? row[fields.updatedAt] : row.updated_at
      let updatedAt: string | undefined
      if (updatedRaw) {
        const d = new Date(String(updatedRaw))
        if (!isNaN(d.getTime())) updatedAt = format(d, "d MMM yyyy")
      }

      return {
        id: String(row.id),
        title,
        category: categoryFromRow(status, fileType),
        fileType,
        url: url ?? undefined,
        description: fields.notes ? formatDisplayValue(row[fields.notes]) ?? undefined : undefined,
        updatedAt,
        owner: fields.assignee ? formatDisplayValue(row[fields.assignee]) ?? undefined : undefined,
        isInternalOnly: true,
        tags: status ? [status] : undefined,
        usage: `table:${mediaTableId}`,
      } satisfies MockResource
    })
    .filter((r): r is MockResource => r != null)
}
