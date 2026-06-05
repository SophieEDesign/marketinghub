import type { LucideIcon } from "lucide-react"
import {
  Folder,
  Image,
  FileText,
  Layout,
  File,
  Video,
  Presentation,
} from "lucide-react"

export type ResourceCategory =
  | "logos"
  | "brand-guidelines"
  | "images"
  | "templates"
  | "documents"
  | "videos"
  | "presentations"

export type CategoryFilter = ResourceCategory | "all"

export type ResourceFileType =
  | "PNG"
  | "JPG"
  | "PDF"
  | "DOCX"
  | "PPTX"
  | "XLSX"
  | "MP4"
  | "SVG"
  | "ZIP"
  | "LINK"

export interface ResourceAttachmentVariant {
  key: string
  url: string
  name?: string
  fileType: ResourceFileType
  thumbnailUrl?: string
}

export interface MockResource {
  id: string
  title: string
  category: ResourceCategory
  fileType: ResourceFileType
  url?: string
  referenceUrl?: string
  editLink?: string
  thumbnailUrl?: string
  description?: string
  fileSize?: string
  dimensions?: string
  addedAt?: string
  updatedAt?: string
  usage?: string
  tags?: string[]
  isInternalOnly?: boolean
  isFeatured?: boolean
  variantGroup?: string
  /** Multiple files on the same record — drives the in-hub attachment thumbnail strip. */
  attachmentVariants?: ResourceAttachmentVariant[]
  owner?: string
}

export interface HubCategoryOption {
  id: CategoryFilter
  label: string
  icon: LucideIcon
}

export const HUB_CATEGORY_OPTIONS: HubCategoryOption[] = [
  { id: "all", label: "All Resources", icon: Folder },
  { id: "logos", label: "Logos", icon: Image },
  { id: "brand-guidelines", label: "Brand Guidelines", icon: FileText },
  { id: "images", label: "Images", icon: Image },
  { id: "templates", label: "Templates", icon: Layout },
  { id: "documents", label: "Documents", icon: File },
  { id: "videos", label: "Videos", icon: Video },
  { id: "presentations", label: "Presentations", icon: Presentation },
]

export function getFileTypeBadgeClasses(fileType: ResourceFileType): string {
  switch (fileType) {
    case "PNG":
    case "SVG":
      return "bg-emerald-100 text-emerald-700"
    case "JPG":
      return "bg-blue-100 text-blue-700"
    case "PDF":
      return "bg-rose-100 text-rose-700"
    case "DOCX":
      return "bg-slate-100 text-slate-700"
    case "XLSX":
      return "bg-emerald-100 text-emerald-800"
    case "PPTX":
      return "bg-orange-100 text-orange-700"
    case "MP4":
      return "bg-violet-100 text-violet-700"
    case "ZIP":
      return "bg-amber-100 text-amber-700"
    case "LINK":
      return "bg-sky-100 text-sky-700"
    default:
      return "bg-muted text-muted-foreground"
  }
}

export function categoryLabel(category: ResourceCategory): string {
  const opt = HUB_CATEGORY_OPTIONS.find((o) => o.id === category)
  return opt?.label ?? category
}
