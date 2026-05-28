"use client"

import { ImageIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import PanelShell from "@/components/interface/primitives/PanelShell"
import { PlatformIconRow } from "@/components/interface/social/PlatformIcon"
import { SocialStatusPill } from "@/components/interface/social/SocialStatusPill"
import {
  formatSocialDateTime,
  type SocialCalendarItem,
} from "@/lib/marketing/social-media-calendar"

export function SocialPostQuickView({
  item,
  onClose,
  onEdit,
  onOpenFullRecord,
  showMediaPreview = true,
  showApprovalStatus = true,
  showPlatformIcons = true,
}: {
  item: SocialCalendarItem | null
  onClose: () => void
  onEdit: () => void
  onOpenFullRecord: () => void
  showMediaPreview?: boolean
  showApprovalStatus?: boolean
  showPlatformIcons?: boolean
}) {
  if (!item) return null

  const platformLabel =
    item.platforms.length > 0
      ? item.platforms.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(", ")
      : item.contentType ?? "Post"

  return (
    <PanelShell
      variant="elevated"
      className="w-full max-w-[360px] shrink-0 flex flex-col max-h-[min(72vh,640px)] border border-border/40 shadow-md"
      bodyClassName="flex flex-col gap-0 p-0 overflow-hidden"
      actions={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
          aria-label="Close preview"
        >
          <X className="h-4 w-4" />
        </Button>
      }
    >
      <div className="flex flex-col gap-3 p-3 overflow-y-auto min-h-0 flex-1">
        {showApprovalStatus ? (
          <SocialStatusPill
            normalizedStatus={item.normalizedStatus}
            label={item.statusLabel}
          />
        ) : null}

        <div>
          <p className="text-sm font-semibold text-foreground">{platformLabel}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatSocialDateTime(item)}</p>
          {showPlatformIcons ? (
            <div className="mt-1.5">
              <PlatformIconRow platforms={item.platforms} size="md" />
            </div>
          ) : null}
        </div>

        {showMediaPreview ? (
          <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden bg-muted/40 flex items-center justify-center">
            {item.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.thumbnailUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted-foreground/60">
                <ImageIcon className="h-10 w-10" aria-hidden />
                <span className="text-xs">No media attached</span>
              </div>
            )}
          </div>
        ) : null}

        {item.caption ? (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
              Caption
            </p>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {item.caption}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">{item.title}</p>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
          {item.themeLabel ? (
            <>
              <dt className="text-muted-foreground">Theme</dt>
              <dd className="flex items-center gap-1.5 min-w-0">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.accentColor }}
                  aria-hidden
                />
                <span className="truncate">{item.themeLabel}</span>
              </dd>
            </>
          ) : null}
          {item.campaignLabel ? (
            <>
              <dt className="text-muted-foreground">Campaign</dt>
              <dd className="truncate">{item.campaignLabel}</dd>
            </>
          ) : null}
          {item.assignee ? (
            <>
              <dt className="text-muted-foreground">Owner</dt>
              <dd className="truncate">{item.assignee}</dd>
            </>
          ) : null}
        </dl>

        {item.approvalNotes ? (
          <div className="rounded-md bg-muted/30 px-2.5 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
              Approval notes
            </p>
            <p className="text-xs text-foreground whitespace-pre-wrap">{item.approvalNotes}</p>
          </div>
        ) : null}

        {showMediaPreview && item.mediaUrls.length > 1 ? (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
              Media
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {item.mediaUrls.slice(0, 6).map((url, i) => (
                <div
                  key={url + i}
                  className="h-12 w-12 rounded overflow-hidden bg-muted/40 shrink-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 p-3 border-t border-border/30 shrink-0">
        <Button type="button" size="sm" className="w-full" onClick={onEdit}>
          Edit post
        </Button>
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={onOpenFullRecord}>
          Open full record
        </Button>
      </div>
    </PanelShell>
  )
}

export function SocialPostQuickViewMobileBackdrop({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 md:left-sidebar bg-black/20 z-30 xl:hidden"
      onClick={onClose}
      aria-hidden
    />
  )
}
