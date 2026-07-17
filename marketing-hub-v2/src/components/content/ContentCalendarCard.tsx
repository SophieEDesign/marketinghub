"use client";

import { Check, FileText, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContentItem, ContentStatus } from "@/lib/types";
import {
  formatChannels,
  isSocialContentItem,
  parseChannels,
} from "@/lib/data/normalize";
import {
  PLATFORM_META,
  isImageUrl,
  platformKey,
} from "@/lib/social/platforms";
import { plainTextFromHtml } from "@/lib/sanitize";

const STATUS_LABEL: Record<ContentStatus, string> = {
  idea: "Idea",
  draft: "Draft",
  review: "Review",
  scheduled: "Scheduled",
  published: "Published",
};

function statusTone(status: ContentStatus) {
  switch (status) {
    case "published":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "scheduled":
      return "bg-sky-50 text-sky-800 border-sky-200";
    case "review":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "draft":
      return "bg-teal-50 text-teal-800 border-teal-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function PlatformDot({ channel }: { channel: string }) {
  const meta = PLATFORM_META[platformKey(channel)];
  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] text-[8px] font-bold leading-none"
      style={{ backgroundColor: meta.bg, color: meta.fg }}
      title={channel || meta.label}
    >
      {meta.short}
    </span>
  );
}

/** Planable-style card for Content & Social calendar cells. */
export function ContentCalendarCard({
  item,
  compact = true,
}: {
  item: ContentItem;
  compact?: boolean;
}) {
  const social = isSocialContentItem(item);
  const channels = parseChannels(item.channel);
  const hasMedia = isImageUrl(item.asset_url);
  const notesPreview = plainTextFromHtml(item.notes).slice(0, 120);
  const preview =
    item.title?.trim() || notesPreview || "Untitled";
  const shownChannels = channels.slice(0, 2);
  const extraChannels = channels.length - shownChannels.length;

  return (
    <div
      className={cn(
        "hub-cal-card flex w-full flex-col overflow-hidden rounded-lg border border-slate-200/90 bg-white text-left shadow-sm",
        compact ? "gap-1 p-1.5" : "gap-1.5 p-2"
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1">
          {social ? (
            <>
              {shownChannels.map((ch) => (
                <PlatformDot key={ch} channel={ch} />
              ))}
              {extraChannels > 0 ? (
                <span className="text-[9px] font-medium text-slate-400">
                  +{extraChannels}
                </span>
              ) : null}
            </>
          ) : (
            <span className="inline-flex h-4 items-center rounded bg-slate-700 px-1 text-[8px] font-bold uppercase tracking-wide text-white">
              {item.content_type?.slice(0, 3) || "Cnt"}
            </span>
          )}
          <span className="truncate text-[9px] font-medium text-slate-500">
            {formatChannels(channels) || (social ? "Social" : "Content")}
          </span>
        </div>
      </div>

      {hasMedia ? (
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-md bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.asset_url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div
          className={cn(
            "flex aspect-[16/10] w-full items-center justify-center rounded-md",
            social
              ? "bg-gradient-to-br from-sky-50 to-slate-100 text-sky-200"
              : "bg-gradient-to-br from-slate-100 to-sand text-slate-300"
          )}
        >
          {social ? (
            <ImageIcon className="h-5 w-5" />
          ) : (
            <FileText className="h-5 w-5" />
          )}
        </div>
      )}

      <p className="line-clamp-2 text-[10px] font-medium leading-snug text-slate-800">
        {preview}
      </p>

      <div className="mt-auto flex items-center">
        <span
          className={cn(
            "inline-flex max-w-full items-center gap-0.5 truncate rounded-full border px-1.5 py-0.5 text-[9px] font-medium",
            statusTone(item.status)
          )}
        >
          {item.status === "published" || item.status === "scheduled" ? (
            <Check className="h-2.5 w-2.5 shrink-0" />
          ) : null}
          {STATUS_LABEL[item.status] ?? item.status}
        </span>
      </div>
    </div>
  );
}

/** Shared FullCalendar day-grid CSS for card-style hubs. */
export const HUB_CALENDAR_CSS = `
  .hub-fc .fc-daygrid-day-frame { min-height: 150px; }
  .hub-fc .fc-daygrid-event {
    background: transparent !important;
    border: none !important;
    margin: 3px 4px !important;
  }
  .hub-fc .fc-daygrid-event-harness { margin-top: 2px; }
  .hub-fc .fc-event-main {
    padding: 0 !important;
    overflow: visible !important;
  }
  .hub-fc .fc-daygrid-day-number {
    font-size: 12px;
    color: #64748b;
    padding: 6px 8px;
  }
  .hub-fc .fc-day-today { background: #f8fafc !important; }
  .hub-fc .fc-day-today .fc-daygrid-day-number {
    background: #c43c3c;
    color: #fff;
    border-radius: 999px;
    width: 1.5rem;
    height: 1.5rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    margin: 4px 6px;
  }
  .hub-fc .fc-col-header-cell-cushion {
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .hub-fc .fc-scrollgrid,
  .hub-fc td,
  .hub-fc th { border-color: #e8ecf0 !important; }
  .hub-fc .fc-event { cursor: grab; }
  .hub-fc .fc-event:active { cursor: grabbing; }
`;
