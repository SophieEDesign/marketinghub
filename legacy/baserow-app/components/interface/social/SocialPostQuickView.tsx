"use client"

/** @deprecated Unused runtime path — social posts open in RecordPanel. Retained for reference/tests. */

import { ExternalLink, ImageIcon, X } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import PanelShell from "@/components/interface/primitives/PanelShell"
import { PlatformIcon } from "@/components/interface/social/PlatformIcon"
import { SocialStatusPill } from "@/components/interface/social/SocialStatusPill"
import {
  externalLinkLabel,
  formatSocialDateTime,
  type SocialCalendarItem,
  type SocialPlatform,
} from "@/lib/marketing/social-media-calendar"

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  twitter: "X",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  other: "Post",
}

export function SocialPostQuickView({
  item,
  onClose,
  onEdit,
  showMediaPreview = true,
  showApprovalStatus = true,
  showPlatformIcons = true,
}: {
  item: SocialCalendarItem | null
  onClose: () => void
  /** Switches the same record drawer into edit mode (no second drawer). */
  onEdit: () => void
  showMediaPreview?: boolean
  showApprovalStatus?: boolean
  showPlatformIcons?: boolean
}) {
  if (!item) return null

  const primaryPlatform = item.platforms[0]
  const platformLabel =
    item.platforms.length > 0
      ? item.platforms.map((p) => PLATFORM_LABELS[p] ?? p).join(", ")
      : item.contentType ?? "Post"

  return (
    <PanelShell
      variant="elevated"
      className="flex w-full max-w-[380px] shrink-0 flex-col border border-[#e4e7ec] bg-white shadow-[0_8px_24px_rgba(31,42,68,0.12)] max-h-[min(72vh,640px)]"
      bodyClassName="flex flex-col gap-0 overflow-hidden p-0"
      actions={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[#6b7280] hover:text-[#2c3340]"
          onClick={onClose}
          aria-label="Close preview"
        >
          <X className="h-4 w-4" />
        </Button>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex items-start gap-3">
          {showPlatformIcons && primaryPlatform ? (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef1f4]">
              <PlatformIcon platform={primaryPlatform} size="lg" />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#2c3340]">{platformLabel}</p>
            <p className="mt-0.5 text-xs text-[#9aa1ab]">{item.contentType ?? "Social post"}</p>
          </div>
        </div>

        {showMediaPreview ? (
          <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl bg-[#eef1f4]">
            {item.thumbnailUrl ? (
              <Image
                src={item.thumbnailUrl}
                alt=""
                fill
                unoptimized
                className="absolute inset-0 object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-1 text-[#c7ccd4]">
                <ImageIcon className="h-10 w-10" aria-hidden />
                <span className="text-xs text-[#9aa1ab]">No media attached</span>
              </div>
            )}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {showApprovalStatus ? (
            <SocialStatusPill
              normalizedStatus={item.normalizedStatus}
              label={item.statusLabel}
            />
          ) : null}
          <span className="text-xs text-[#9aa1ab]">{formatSocialDateTime(item)}</span>
        </div>

        {item.caption ? (
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#9aa1ab]">
              Caption
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#2c3340]">
              {item.caption}
            </p>
          </div>
        ) : (
          <p className="text-sm italic text-[#9aa1ab]">{item.title}</p>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
          {item.themeLabel ? (
            <>
              <dt className="text-[#9aa1ab]">Theme</dt>
              <dd className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.accentColor }}
                  aria-hidden
                />
                <span className="truncate text-[#2c3340]">{item.themeLabel}</span>
              </dd>
            </>
          ) : null}
          {item.campaignLabel ? (
            <>
              <dt className="text-[#9aa1ab]">Campaign</dt>
              <dd className="truncate text-[#2c3340]">{item.campaignLabel}</dd>
            </>
          ) : null}
          {item.assignee ? (
            <>
              <dt className="text-[#9aa1ab]">Owner</dt>
              <dd className="truncate text-[#2c3340]">{item.assignee}</dd>
            </>
          ) : null}
        </dl>

        {item.approvalNotes ? (
          <div className="rounded-lg bg-[#f7f9fb] px-3 py-2.5">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#9aa1ab]">
              Approval notes
            </p>
            <p className="whitespace-pre-wrap text-xs text-[#2c3340]">{item.approvalNotes}</p>
          </div>
        ) : null}

        {showMediaPreview && item.mediaUrls.length > 1 ? (
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#9aa1ab]">
              Media
            </p>
            <div className="flex flex-wrap gap-1.5">
              {item.mediaUrls.slice(0, 6).map((url, i) => (
                <div
                  key={url + i}
                  className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-[#eef1f4]"
                >
                  <Image src={url} alt="" fill unoptimized className="object-cover" />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-[#e4e7ec] p-4">
        {item.postUrl ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-2 border-[#e4e7ec] text-[#2c3340]"
            asChild
          >
            <a href={item.postUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              {externalLinkLabel(item.postUrl)}
            </a>
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          className="w-full bg-[#005b8f] text-white hover:bg-[#004a75]"
          onClick={onEdit}
        >
          Edit post
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
      className="fixed inset-0 md:left-sidebar z-30 bg-black/20 xl:hidden"
      onClick={onClose}
      aria-hidden
    />
  )
}
