"use client"

import {
  File,
  FileText,
  Image as ImageIcon,
  Presentation,
  Video,
  Archive,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { MockResource } from "./types"
import { isImageType } from "./utils"

interface PreviewByTypeProps {
  resource: MockResource
  className?: string
  large?: boolean
}

function LogoPlaceholder({ large }: { large?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center font-bold tracking-tight text-[#1e3a5f]",
        large ? "text-5xl md:text-6xl" : "text-2xl"
      )}
    >
      {"P&M"}
    </div>
  )
}

export default function PreviewByType({
  resource,
  className,
  large = false,
}: PreviewByTypeProps) {
  const { fileType, title, thumbnailUrl } = resource
  const isLogo = resource.category === "logos" || title.toLowerCase().includes("logo")

  if (thumbnailUrl && isImageType(fileType)) {
    return (
      <img
        src={thumbnailUrl}
        alt={title}
        className={cn("max-h-full max-w-full object-contain", className)}
      />
    )
  }

  if (isImageType(fileType) || isLogo) {
    if (isLogo) {
      return (
        <div
          className={cn(
            "flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-white",
            className
          )}
        >
          <LogoPlaceholder large={large} />
        </div>
      )
    }
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-blue-50/80 via-slate-50 to-white text-muted-foreground",
          className
        )}
      >
        <ImageIcon className={cn(large ? "h-16 w-16" : "h-10 w-10", "opacity-40")} />
        {!large && <span className="text-xs font-medium">{fileType}</span>}
      </div>
    )
  }

  if (fileType === "PDF") {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-rose-50/60 to-white p-6",
          className
        )}
      >
        <div className="rounded-2xl border border-rose-100 bg-white p-6 shadow-sm">
          <FileText className={cn(large ? "h-20 w-20" : "h-12 w-12", "text-rose-500")} />
        </div>
        <span className="text-sm font-medium text-rose-700/80">PDF Document</span>
      </div>
    )
  }

  if (fileType === "PPTX") {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-orange-50/60 to-white",
          className
        )}
      >
        <Presentation className={cn(large ? "h-20 w-20" : "h-12 w-12", "text-orange-500")} />
        <span className="text-sm font-medium text-orange-700/80">Presentation</span>
      </div>
    )
  }

  if (fileType === "MP4") {
    return (
      <div
        className={cn(
          "relative flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-violet-100/50 to-slate-900/5",
          className
        )}
      >
        <Video className={cn(large ? "h-20 w-20" : "h-12 w-12", "text-violet-600")} />
        <span className="text-sm text-violet-700/80">Video preview</span>
      </div>
    )
  }

  if (fileType === "DOCX") {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-50 to-white",
          className
        )}
      >
        <FileText className={cn(large ? "h-16 w-16" : "h-10 w-10", "text-slate-500")} />
        <span className="text-sm text-muted-foreground">Document</span>
      </div>
    )
  }

  if (fileType === "ZIP") {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-amber-50/60 to-white",
          className
        )}
      >
        <Archive className={cn(large ? "h-16 w-16" : "h-10 w-10", "text-amber-600")} />
        <span className="text-sm text-amber-800/70">Archive</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground",
        className
      )}
    >
      <File className={cn(large ? "h-16 w-16" : "h-10 w-10")} />
      <span className="text-sm">{fileType}</span>
    </div>
  )
}
