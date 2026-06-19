"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Calendar,
  Download,
  ExternalLink,
  FileText,
  Link,
  Maximize2,
  MoreHorizontal,
  Scale,
  Star,
  Tag,
  User,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import PreviewByType from "./PreviewByType"
import {
  categoryLabel,
  getFileTypeBadgeClasses,
  type MockResource,
} from "./types"

interface DetailPanelProps {
  resource: MockResource | null
  variants?: MockResource[]
  selectedId?: string | null
  isFavourite: boolean
  isEditing?: boolean
  onToggleFavourite: () => void
  onDownload: () => void
  onViewFull: () => void
  onCopyLink: () => void
  onEditDetails?: () => void
  onSelectVariant?: (id: string) => void
  onClose?: () => void
  className?: string
}

function SectionHeading({ children }: { children: string }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/90">
      {children}
    </p>
  )
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
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={cn("font-medium text-foreground/90 break-words", valueClassName)}>{value}</p>
      </div>
    </div>
  )
}

function HeaderBadge({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-semibold",
        className
      )}
    >
      {children}
    </span>
  )
}

function buildActivityEntries(resource: MockResource): { title: string; meta: string }[] {
  const entries: { title: string; meta: string }[] = []
  if (resource.updatedAt) {
    const meta = [resource.updatedAt, resource.owner].filter(Boolean).join(" · ")
    entries.push({ title: "Asset updated", meta })
  } else if (resource.addedAt) {
    const meta = [resource.addedAt, resource.owner].filter(Boolean).join(" · ")
    entries.push({ title: "Asset added", meta })
  }
  if (resource.tags && resource.tags.length > 0) {
    entries.push({
      title: `Tags: ${resource.tags.join(", ")}`,
      meta: resource.updatedAt ?? resource.addedAt ?? "",
    })
  }
  if (resource.description?.trim()) {
    entries.push({
      title: "Description updated",
      meta: resource.updatedAt ?? resource.owner ?? "",
    })
  }
  return entries.filter((e) => e.meta || e.title)
}

export default function DetailPanel({
  resource,
  variants = [],
  selectedId,
  isFavourite,
  isEditing,
  onToggleFavourite,
  onDownload,
  onViewFull,
  onCopyLink,
  onEditDetails,
  onSelectVariant,
  onClose,
  className,
}: DetailPanelProps) {
  const [activeTab, setActiveTab] = useState("details")

  useEffect(() => {
    if (!resource || !onClose) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [resource, onClose])

  const displayVariants = useMemo(() => {
    if (!resource) return []
    return variants.length > 0 ? variants : [resource]
  }, [resource, variants])

  const versionRows = useMemo(() => {
    if (!resource) return []
    const ordered = [
      resource,
      ...displayVariants.filter((v) => v.id !== resource.id),
    ]
    return ordered.map((v, index) => ({
      id: v.id,
      label:
        index === 0
          ? `v${ordered.length} — current`
          : `v${ordered.length - index}`,
      date: v.updatedAt ?? v.addedAt ?? "",
      isCurrent: index === 0,
      url: v.url,
    }))
  }, [resource, displayVariants])

  useEffect(() => {
    setActiveTab("details")
  }, [resource?.id])

  const activityEntries = useMemo(
    () => (resource ? buildActivityEntries(resource) : []),
    [resource]
  )

  const usageLabel =
    resource?.usage?.match(/^table:[0-9a-f-]{36}$/i) ? "Linked in Marketing Hub" : resource?.usage

  if (!resource) {
    return null
  }

  const hubLabel = categoryLabel(resource.category)
  const updatedLine = [resource.updatedAt, resource.owner].filter(Boolean).join(" · ")

  return (
    <aside
      className={cn(
        "flex w-full max-w-[392px] shrink-0 flex-col border-[#e4e7ec] bg-white shadow-[-12px_0_40px_rgba(15,28,43,0.22)]",
        className
      )}
    >
      <div className="h-[3px] shrink-0 bg-gradient-to-r from-[#c4a574] to-[#b08d52]" />
      <div className="shrink-0 border-b border-[#eef1f4] px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold leading-snug text-[#1f2a44] break-words">
              {resource.title}
            </h3>
            <p className="mt-0.5 text-xs text-[#9aa1ab]">{hubLabel}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <HeaderBadge className={getFileTypeBadgeClasses(resource.fileType)}>
                {resource.fileType}
              </HeaderBadge>
              <HeaderBadge className="bg-[#005b8f]/10 text-[#005b8f]">{hubLabel}</HeaderBadge>
              {resource.updatedAt ? (
                <HeaderBadge className="bg-muted text-muted-foreground">
                  Updated {resource.updatedAt}
                </HeaderBadge>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
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
            {onClose ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClose}
                aria-label="Close detail panel"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEditDetails ? (
                  <DropdownMenuItem onClick={onEditDetails}>Manage asset</DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={onCopyLink}>Copy link</DropdownMenuItem>
                <DropdownMenuItem onClick={onViewFull}>
                  {resource.fileType === "LINK" ? "Open in new tab" : "View full size"}
                </DropdownMenuItem>
                {isEditing ? (
                  <>
                    <DropdownMenuItem disabled>Rename (coming soon)</DropdownMenuItem>
                    <DropdownMenuItem disabled>Move category (coming soon)</DropdownMenuItem>
                    <DropdownMenuItem disabled className="text-destructive">
                      Delete (coming soon)
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border/60 px-4">
          <TabsList className="h-9 w-full justify-start gap-0 rounded-none border-0 bg-transparent p-0">
            <TabsTrigger
              value="details"
              className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs data-[state=active]:border-[#005b8f] data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Details
            </TabsTrigger>
            <TabsTrigger
              value="versions"
              className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs data-[state=active]:border-[#005b8f] data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Versions
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs data-[state=active]:border-[#005b8f] data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Activity
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <TabsContent value="details" className="mt-0 space-y-4 px-4 py-4 focus-visible:outline-none">
            <div className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/15">
              <div className="absolute right-2 bottom-2 z-10">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[10px] shadow-sm"
                  onClick={onViewFull}
                >
                  <Maximize2 className="h-3 w-3" />
                  Full screen
                </Button>
              </div>
              <div className="aspect-[4/3] w-full min-h-[120px]">
                <PreviewByType resource={resource} className="h-full w-full" />
              </div>
            </div>

            {displayVariants.length > 1 && onSelectVariant ? (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {displayVariants.slice(0, 4).map((v) => {
                  const selected = v.id === (selectedId ?? resource.id)
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onSelectVariant(v.id)}
                      className={cn(
                        "relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                        selected ? "border-[#005b8f]" : "border-[#e4e7ec] hover:border-[#005b8f]/40"
                      )}
                    >
                      <PreviewByType resource={v} className="h-full w-full" />
                    </button>
                  )
                })}
              </div>
            ) : null}

            <div className="space-y-3">
              <SectionHeading>File info</SectionHeading>
              <div className="space-y-2.5 rounded-xl border border-border/60 bg-muted/15 p-3">
                <MetaRow icon={FileText} label="File type" value={resource.fileType} />
                {resource.fileSize ? (
                  <MetaRow icon={Scale} label="File size" value={resource.fileSize} />
                ) : null}
                {resource.dimensions ? (
                  <MetaRow icon={FileText} label="Dimensions" value={resource.dimensions} />
                ) : null}
                {updatedLine ? (
                  <MetaRow icon={Calendar} label="Updated" value={updatedLine} />
                ) : null}
                {resource.owner && !updatedLine.includes(resource.owner) ? (
                  <MetaRow icon={User} label="Uploaded by" value={resource.owner} />
                ) : null}
                {usageLabel ? <MetaRow icon={FileText} label="Usage" value={usageLabel} /> : null}
                {resource.tags && resource.tags.length > 0 ? (
                  <div className="flex items-start gap-2.5 text-sm">
                    <Tag className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-muted-foreground">Tags</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {resource.tags.map((t, i) => (
                          <span
                            key={t}
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              i === 0
                                ? "bg-[#005b8f]/10 text-[#005b8f]"
                                : "bg-[#eceef1] text-[#1f2a44]/80"
                            )}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {resource.description ? (
              <div className="space-y-2">
                <SectionHeading>Description</SectionHeading>
                <p className="text-sm leading-relaxed text-muted-foreground">{resource.description}</p>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="versions" className="mt-0 px-4 py-4 focus-visible:outline-none">
            <SectionHeading>Versions</SectionHeading>
            <ul className="mt-2 divide-y divide-border/60 rounded-xl border border-border/60 bg-muted/10">
              {versionRows.map((row) => (
                <li key={row.id} className="flex items-center gap-2 px-3 py-2.5 text-sm">
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      row.isCurrent ? "bg-teal-500" : "bg-muted-foreground/40"
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground/90">{row.label}</p>
                    {row.date ? (
                      <p className="text-xs text-muted-foreground">{row.date}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    disabled={!row.url}
                    onClick={() => {
                      if (row.url) window.open(row.url, "_blank", "noopener,noreferrer")
                    }}
                    aria-label={`Download ${row.label}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
            {onEditDetails ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Open{" "}
                <button
                  type="button"
                  className="font-medium text-[#005b8f] hover:underline"
                  onClick={onEditDetails}
                >
                  Manage asset
                </button>{" "}
                for full version history and edits.
              </p>
            ) : null}
          </TabsContent>

          <TabsContent value="activity" className="mt-0 px-4 py-4 focus-visible:outline-none">
            <SectionHeading>Activity</SectionHeading>
            {activityEntries.length > 0 ? (
              <ul className="mt-2 space-y-3">
                {activityEntries.map((entry, i) => (
                  <li key={`${entry.title}-${i}`} className="flex gap-2 text-sm">
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/35"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground/90">{entry.title}</p>
                      {entry.meta ? (
                        <p className="text-xs text-muted-foreground">{entry.meta}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No activity recorded yet.</p>
            )}
            {onEditDetails ? (
              <p className="mt-4 text-xs text-muted-foreground">
                Comments and detailed history are available in{" "}
                <button
                  type="button"
                  className="font-medium text-[#005b8f] hover:underline"
                  onClick={onEditDetails}
                >
                  Manage asset
                </button>
                .
              </p>
            ) : null}
          </TabsContent>
        </div>
      </Tabs>

      <div className="shrink-0 space-y-2 border-t border-[#e4e7ec] p-4">
        <Button
          type="button"
          className="min-h-11 w-full gap-2 bg-[#c4a574] text-[#1f2a44] hover:bg-[#b08d52]"
          onClick={onViewFull}
        >
          <ExternalLink className="h-4 w-4" />
          {resource.source ? `Open in ${resource.source}` : resource.fileType === "LINK" ? "Open link" : "Open file"}
        </Button>
        <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 gap-2 border-[#e4e7ec]"
            onClick={onDownload}
          >
            <Download className="h-4 w-4 shrink-0" />
            Download
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 gap-2 border-[#e4e7ec]"
            onClick={onCopyLink}
          >
            <Link className="h-4 w-4 shrink-0" />
            Copy link
          </Button>
        </div>
        {onEditDetails ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full border-[#005b8f]/20 text-[#005b8f]"
            onClick={onEditDetails}
          >
            Manage asset
          </Button>
        ) : null}
      </div>
    </aside>
  )
}
