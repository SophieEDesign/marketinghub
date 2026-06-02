"use client"

import {
  Download,
  ExternalLink,
  Link,
  Star,
  MoreHorizontal,
  FileText,
  Image,
  Calendar,
  User,
  Tag,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  categoryLabel,
  getFileTypeBadgeClasses,
  type MockResource,
} from "./types"

interface DetailPanelProps {
  resource: MockResource | null
  isFavourite: boolean
  isEditing?: boolean
  onToggleFavourite: () => void
  onDownload: () => void
  onViewFull: () => void
  onCopyLink: () => void
  onEditDetails?: () => void
  className?: string
}

function MetaRow({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ElementType
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/90">{label}</p>
        <p className={cn("font-medium text-foreground/90 break-words", valueClassName)}>{value}</p>
      </div>
    </div>
  )
}

export default function DetailPanel({
  resource,
  isFavourite,
  isEditing,
  onToggleFavourite,
  onDownload,
  onViewFull,
  onCopyLink,
  onEditDetails,
  className,
}: DetailPanelProps) {
  const referenceHost = resource?.referenceUrl
    ? (() => {
        try {
          return new URL(resource.referenceUrl).hostname.replace(/^www\./, "")
        } catch {
          return null
        }
      })()
    : null

  const usageLabel = resource?.usage?.match(/^table:[0-9a-f-]{36}$/i)
    ? "Linked media table"
    : resource?.usage

  if (!resource) {
    return (
      <aside
        className={cn(
          "flex w-full shrink-0 flex-col items-center justify-center border-t border-border/60 bg-muted/5 p-6 text-center md:w-[300px] md:border-l md:border-t-0",
          className
        )}
      >
        <p className="text-sm text-muted-foreground">
          Select a resource to view details
        </p>
      </aside>
    )
  }

  return (
    <aside
      className={cn(
        "flex w-full shrink-0 flex-col border-t border-border/60 bg-background md:w-[300px] md:border-l md:border-t-0",
        className
      )}
    >
      <div className="border-b border-border/60 px-4 py-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
              getFileTypeBadgeClasses(resource.fileType)
            )}
          >
            {resource.fileType}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggleFavourite}
              aria-label={isFavourite ? "Remove favourite" : "Add favourite"}
            >
              <Star
                className={cn(
                  "h-4 w-4",
                  isFavourite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
                )}
              />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isEditing ? (
                  <>
                    <DropdownMenuItem disabled>Rename (coming soon)</DropdownMenuItem>
                    <DropdownMenuItem disabled>Move category (coming soon)</DropdownMenuItem>
                    <DropdownMenuItem disabled className="text-destructive">
                      Delete (coming soon)
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem disabled>More actions</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-[#1e3a5f] break-words">{resource.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{categoryLabel(resource.category)}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {resource.description ?? "No description provided."}
          </p>
        </div>

        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
          <MetaRow icon={FileText} label="File type" value={resource.fileType} />
          {resource.referenceUrl && (
            <div className="flex items-start gap-2.5 text-sm">
              <Link className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/90">
                  Reference link
                </p>
                <a
                  href={resource.referenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 hover:underline"
                >
                  {referenceHost ?? "Open source"}
                </a>
                <p className="mt-0.5 break-all text-xs text-muted-foreground/90">{resource.referenceUrl}</p>
              </div>
            </div>
          )}
          {resource.dimensions && (
            <MetaRow icon={Image} label="Dimensions" value={resource.dimensions} />
          )}
          {resource.fileSize && (
            <MetaRow icon={FileText} label="File size" value={resource.fileSize} />
          )}
          {resource.addedAt && (
            <MetaRow icon={Calendar} label="Added" value={resource.addedAt} />
          )}
          {resource.updatedAt && (
            <MetaRow icon={Calendar} label="Updated" value={resource.updatedAt} />
          )}
          {resource.usage && (
            <MetaRow
              icon={FileText}
              label="Usage"
              value={usageLabel ?? resource.usage}
            />
          )}
          {resource.owner && (
            <MetaRow icon={User} label="Uploaded by" value={resource.owner} />
          )}
          {resource.tags && resource.tags.length > 0 && (
            <div className="flex items-start gap-2.5 text-sm">
              <Tag className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground/90">
                  Tags
                </p>
                <div className="flex flex-wrap gap-1">
                  {resource.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-md border border-border/60 bg-background px-2 py-0.5 text-xs text-foreground/80"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 space-y-2 border-t border-border/60 p-4">
        <Button type="button" className="w-full gap-2" onClick={onDownload}>
          <Download className="h-4 w-4" />
          {resource.fileType === "LINK" ? "Open link" : "Download"}
        </Button>
        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2 border-border/60 px-2"
            onClick={onViewFull}
          >
            <ExternalLink className="h-4 w-4" />
            <span className="sr-only md:not-sr-only">{resource.fileType === "LINK" ? "Open tab" : "Full size"}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2 border-border/60 px-2"
            onClick={onCopyLink}
          >
            <Link className="h-4 w-4" />
            <span className="sr-only md:not-sr-only">Copy link</span>
          </Button>
          {onEditDetails ? (
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-border/60 px-2"
              onClick={onEditDetails}
            >
              Manage
            </Button>
          ) : (
            <div />
          )}
        </div>
      </div>
    </aside>
  )
}
