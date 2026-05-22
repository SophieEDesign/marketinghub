"use client"

import type { ReactNode } from "react"
import {
  Copy,
  Edit3,
  ExternalLink,
  MoreHorizontal,
  Star,
  X,
} from "lucide-react"
import type { ContentTimelineItem } from "@/lib/marketing/content-timeline"
import {
  formatDisplayDate,
  getChannelLabel,
  getThemeStyles,
  getTypeLabel,
} from "@/lib/marketing/content-timeline"
import { Button } from "@/components/ui/button"
import { ContentTimelineStatusBadge } from "./ContentTimelineStatusBadge"

interface ContentTimelineDetailPanelProps {
  item: ContentTimelineItem
  onClose: () => void
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-xs">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 text-foreground">{children}</span>
    </div>
  )
}

export function ContentTimelineDetailPanel({ item, onClose }: ContentTimelineDetailPanelProps) {
  const theme = getThemeStyles(item.theme)
  const endDate = item.endDate ?? item.publishDate

  const handleOpenRecord = () => {
    // TODO: support opening the existing RecordEditor / RecordModal.
  }

  const handleEdit = () => {
    // TODO: support opening the existing RecordEditor / RecordModal.
  }

  const handleDuplicate = () => {
    // TODO: connect timeline items to the Content table.
  }

  const handleCopyLink = () => {
    // TODO: connect timeline items to the Content table.
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-t border-border/40 bg-background md:w-[320px] md:border-l md:border-t-0">
      <div className="flex items-start justify-between gap-2 border-b border-border/40 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {getTypeLabel(item.type)}
          </p>
          <h3 className="mt-1 text-sm font-semibold leading-snug text-foreground">{item.title}</h3>
          <div className="mt-2">
            <ContentTimelineStatusBadge status={item.status} />
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Favourite">
            <Star className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close panel">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        <MetaRow label="Theme">
          <span className="inline-flex items-center gap-1.5">
            <span className={cnDot(theme.dot)} aria-hidden />
            {item.theme}
          </span>
        </MetaRow>
        <MetaRow label="Content type">{getTypeLabel(item.type)}</MetaRow>
        <MetaRow label="Channel">{getChannelLabel(item.channel)}</MetaRow>
        {item.owner && <MetaRow label="Owner">{item.owner}</MetaRow>}
        <MetaRow label="Start date">{formatDisplayDate(item.startDate)}</MetaRow>
        {endDate && (
          <MetaRow label="End / publish">{formatDisplayDate(endDate)}</MetaRow>
        )}
        {item.campaign && (
          <MetaRow label="Related campaign">
            <button type="button" className="text-left text-blue-600 hover:underline">
              {item.campaign}
            </button>
          </MetaRow>
        )}
        {item.assetStatus && <MetaRow label="Asset status">{item.assetStatus}</MetaRow>}
        {item.approvalStatus && (
          <MetaRow label="Approval status">
            <span className="text-amber-700">{item.approvalStatus}</span>
          </MetaRow>
        )}
        {(item.brief || item.notes) && (
          <div className="mt-3 rounded-xl border border-border/40 bg-muted/20 p-3">
            <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">Brief / notes</p>
            <p className="text-xs leading-relaxed text-foreground">{item.brief || item.notes}</p>
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-border/40 p-4">
        <Button type="button" className="w-full gap-2" size="sm" onClick={handleOpenRecord}>
          <ExternalLink className="h-4 w-4" />
          Open record
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleEdit}>
            <Edit3 className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button type="button" variant="outline" size="sm" className="text-xs" onClick={handleDuplicate}>
            Duplicate
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleCopyLink}>
            <Copy className="h-3.5 w-3.5" />
            Copy link
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="More actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  )
}

function cnDot(dot: string) {
  return `inline-block h-2 w-2 rounded-full ${dot}`
}
