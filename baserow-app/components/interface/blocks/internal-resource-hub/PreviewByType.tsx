"use client"

import {
  Archive,
  File,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Presentation,
  Video,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { MockResource, ResourceFileType } from "./types"
import { getFileTypeBadgeClasses } from "./types"

interface PreviewByTypeProps {
  resource: MockResource
  className?: string
  large?: boolean
}

function fileTypeIcon(fileType: ResourceFileType, large?: boolean) {
  const size = large ? "h-10 w-10" : "h-7 w-7"
  switch (fileType) {
    case "PDF":
    case "DOCX":
      return <FileText className={size} />
    case "PPTX":
      return <Presentation className={size} />
    case "MP4":
      return <Video className={size} />
    case "ZIP":
      return <Archive className={size} />
    case "LINK":
      return <LinkIcon className={size} />
    case "PNG":
    case "JPG":
    case "SVG":
      return <ImageIcon className={size} />
    default:
      return <File className={size} />
  }
}

function DocumentTile({
  resource,
  className,
  large,
}: {
  resource: MockResource
  className?: string
  large?: boolean
}) {
  const badge = getFileTypeBadgeClasses(resource.fileType)
  const headerTone =
    resource.fileType === "PDF"
      ? "bg-[#c0292f]"
      : resource.fileType === "PPTX"
        ? "bg-[#b5651d]"
        : resource.fileType === "MP4"
          ? "bg-indigo-600"
          : resource.fileType === "DOCX"
            ? "bg-[#3d4d63]"
            : resource.fileType === "PNG" || resource.fileType === "SVG" || resource.fileType === "XLSX"
              ? "bg-[#1b7a52]"
              : resource.fileType === "JPG"
                ? "bg-[#0a6bb0]"
                : "bg-[#005b8f]"

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-[10px] border border-[#e2e6ea] bg-white shadow-sm",
        className
      )}
    >
      <div className={cn("flex items-center justify-center px-3 py-2 text-white", headerTone)}>
        <span className="text-[10px] font-bold uppercase tracking-wide">{resource.fileType}</span>
      </div>
      <div
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-2 px-3 text-[#1f2a44]",
          large ? "py-8" : "py-4"
        )}
      >
        <span className={cn("rounded-lg p-2", badge)}>{fileTypeIcon(resource.fileType, large)}</span>
        <p
          className={cn(
            "line-clamp-2 text-center font-medium leading-snug text-[#1f2a44]",
            large ? "text-sm" : "text-xs"
          )}
        >
          {resource.title}
        </p>
      </div>
    </div>
  )
}

export default function PreviewByType({
  resource,
  className,
  large = false,
}: PreviewByTypeProps) {
  const { title, thumbnailUrl } = resource

  if (thumbnailUrl) {
    return (
      <img
        src={thumbnailUrl}
        alt={title}
        className={cn("h-full w-full object-cover", className)}
      />
    )
  }

  return <DocumentTile resource={resource} className={className} large={large} />
}
