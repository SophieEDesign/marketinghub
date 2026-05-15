"use client"

import {
  Archive,
  File,
  FileImage,
  FileText,
  Folder,
  MoreVertical,
  Presentation,
  Table2,
  Video,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { StaffHubAsset } from "@/lib/marketing/internal-staff-hub"
import type { DriveFileKind } from "@/lib/marketing/drive-link"
import { cn } from "@/lib/utils"

interface AssetCardProps {
  asset: StaffHubAsset
  variant?: "grid" | "carousel" | "list"
  onPreview: (asset: StaffHubAsset) => void
  onOpen?: (asset: StaffHubAsset) => void
}

const KIND_ICONS: Record<DriveFileKind, typeof File> = {
  pdf: FileText,
  image: FileImage,
  video: Video,
  presentation: Presentation,
  document: FileText,
  spreadsheet: Table2,
  folder: Folder,
  file: File,
}

const PREVIEW_GRADIENTS = [
  "from-violet-100/80 via-violet-50/40 to-background",
  "from-blue-100/80 via-blue-50/40 to-background",
  "from-emerald-100/80 via-emerald-50/40 to-background",
  "from-amber-100/80 via-amber-50/40 to-background",
  "from-rose-100/80 via-rose-50/40 to-background",
]

function previewGradientIndex(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i)) % PREVIEW_GRADIENTS.length
  return h
}

function SourceBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-background/90 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-medium text-foreground/80 shadow-sm border border-border/40">
      <span className="h-3.5 w-3.5 rounded-sm bg-[#4285F4] flex items-center justify-center text-[8px] text-white font-bold">
        G
      </span>
      {label}
    </span>
  )
}

export default function AssetCard({
  asset,
  variant = "grid",
  onPreview,
  onOpen,
}: AssetCardProps) {
  const kind: DriveFileKind = asset.link?.fileKind ?? "file"
  const Icon = KIND_ICONS[kind] ?? File
  const sourceLabel = asset.link?.providerLabel ?? asset.type ?? "Resource"
  const gradient = PREVIEW_GRADIENTS[previewGradientIndex(asset.id)]
  const isList = variant === "list"
  const isCarousel = variant === "carousel"

  const handleOpen = () => {
    if (asset.link?.openUrl) {
      window.open(asset.link.openUrl, "_blank", "noopener,noreferrer")
      onOpen?.(asset)
    } else {
      onPreview(asset)
    }
  }

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-card-lg border border-border/45 bg-card shadow-card",
        "transition-all duration-200 hover:shadow-card-hover hover:border-border/70",
        isList && "flex-row sm:flex-col",
        isCarousel && "w-[220px] shrink-0 sm:w-[240px]"
      )}
    >
      <button
        type="button"
        onClick={() => onPreview(asset)}
        className={cn(
          "relative block w-full overflow-hidden text-left bg-muted/30",
          isList ? "w-28 sm:w-full shrink-0 aspect-square" : "aspect-[4/3]"
        )}
      >
        {asset.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.previewUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = "none"
            }}
          />
        ) : (
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br p-4",
              gradient
            )}
          >
            <Icon className="h-10 w-10 text-foreground/25 mb-2" strokeWidth={1.25} />
            <span className="text-[10px] font-medium text-foreground/40 uppercase tracking-wider text-center line-clamp-2 max-w-full px-2">
              {asset.title.split(" ").slice(0, 2).join(" ")}
            </span>
          </div>
        )}
        <PreviewOverlay />
        <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2">
          <SourceBadge label={sourceLabel} />
          {kind === "presentation" || kind === "video" ? (
            <span className="rounded-full bg-background/90 p-1 shadow-sm border border-border/40">
              {kind === "video" ? (
                <Video className="h-3.5 w-3.5 text-foreground/70" />
              ) : (
                <Presentation className="h-3.5 w-3.5 text-foreground/70" />
              )}
            </span>
          ) : null}
        </div>
      </button>

      <div className={cn("flex flex-col flex-1 min-w-0 p-3", isList && "justify-center py-2.5 sm:p-3")}>
        <div className="flex items-start gap-1 min-w-0">
          <button type="button" onClick={() => onPreview(asset)} className="flex-1 min-w-0 text-left">
            <h3 className="text-sm font-medium text-foreground leading-snug line-clamp-2 group-hover:text-accent-link transition-colors">
              {asset.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {asset.type ?? asset.link?.fileKindLabel ?? sourceLabel}
            </p>
          </button>
          <AssetCardMenu asset={asset} onPreview={onPreview} onOpen={handleOpen} />
        </div>

        {asset.tags.length > 0 && !isCarousel ? (
          <TagRow tags={asset.tags} />
        ) : null}

        {(asset.updatedLabel || asset.owner) && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground"
              title={asset.owner ?? undefined}
            >
              {asset.ownerInitials}
            </span>
            <span className="text-[11px] text-muted-foreground truncate">
              {asset.updatedLabel ? `Updated ${asset.updatedLabel}` : asset.owner}
            </span>
          </div>
        )}
      </div>
    </article>
  )
}

function PreviewOverlay() {
  return (
    <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
  )
}

function TagRow({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {tags.slice(0, 2).map((tag) => (
        <Badge key={tag} variant="secondary" className="h-5 px-1.5 text-[10px] font-normal bg-muted/50">
          {tag}
        </Badge>
      ))}
    </div>
  )
}

function AssetCardMenu({
  asset,
  onPreview,
  onOpen,
}: {
  asset: StaffHubAsset
  onPreview: (a: StaffHubAsset) => void
  onOpen: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground transition-opacity"
          aria-label="Asset actions"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => onPreview(asset)}>Preview</DropdownMenuItem>
        {asset.link?.openUrl ? (
          <DropdownMenuItem onClick={onOpen}>Open in Drive</DropdownMenuItem>
        ) : null}
        {asset.link?.openUrl && asset.link.fileKind !== "folder" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href={asset.link.openUrl} target="_blank" rel="noopener noreferrer">
                Download
              </a>
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-muted-foreground">
          <Archive className="h-3.5 w-3.5 mr-2 opacity-50" />
          Pin (soon)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
