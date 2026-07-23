"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO, startOfDay } from "date-fns";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Check, ExternalLink, ImageIcon, Send } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FullCalendarStyles } from "@/components/ui/FullCalendarStyles";
import { FilterBar, matchesSearch } from "@/components/ui/FilterBar";
import { cn } from "@/lib/utils";
import type { ContentItem } from "@/lib/types";
import { isSocialContentItem, primaryCanvaUrl, primaryImageUrl } from "@/lib/data/normalize";
import {
  PLATFORM_META,
  isCanvaUrl,
  isImageUrl,
  platformKey,
} from "@/lib/social/platforms";
import { HUB_CALENDAR_CSS } from "@/components/content/ContentCalendarCard";
import { CanvaPreviewTile } from "@/components/content/CanvaPreviewTile";
import { SocialMonthlyPlan } from "@/components/social/SocialMonthlyPlan";

type SocialPost = {
  id: string;
  text: string;
  status: string;
  scheduledAt: string | null;
  url: string | null;
  platform: string;
  platforms: string[];
  mediaUrl: string | null;
  source: "planable" | "hub";
};

function normalizePlatform(raw: string | null | undefined): string {
  const key = platformKey(raw ?? "");
  return PLATFORM_META[key].label;
}

function normalizeStatus(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("publish")) return "Published";
  if (s.includes("approv")) return "Approved";
  if (s.includes("schedul")) return "Scheduled";
  if (s.includes("review")) return "Review";
  if (s.includes("draft")) return "Draft";
  if (s.includes("idea")) return "Idea";
  if (!raw.trim()) return "Draft";
  return raw.trim().replace(/^\w/, (c) => c.toUpperCase());
}

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (s.includes("publish") || s.includes("approv")) {
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }
  if (s.includes("schedul")) {
    return "bg-sky-50 text-sky-800 border-sky-200";
  }
  if (s.includes("review")) {
    return "bg-amber-50 text-amber-900 border-amber-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function stripHtml(input: string) {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function PlatformBadge({ name }: { name: string }) {
  const meta = PLATFORM_META[platformKey(name)];
  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] text-[8px] font-bold leading-none"
      style={{ backgroundColor: meta.bg, color: meta.fg }}
      title={meta.label}
    >
      {meta.short}
    </span>
  );
}

function PostCard({
  post,
  compact = false,
}: {
  post: SocialPost;
  compact?: boolean;
}) {
  const platforms = post.platforms.length
    ? post.platforms
    : [post.platform];
  const shown = platforms.slice(0, 2);
  const extra = platforms.length - shown.length;
  const hasMedia = isImageUrl(post.mediaUrl);
  const hasCanva = !hasMedia && isCanvaUrl(post.mediaUrl);
  const time =
    post.scheduledAt && !Number.isNaN(parseISO(post.scheduledAt).getTime())
      ? format(parseISO(post.scheduledAt), "HH:mm")
      : null;
  const showTime = time && time !== "09:00" && time !== "00:00";

  return (
    <div
      className={cn(
        "hub-cal-card flex w-full flex-col overflow-hidden rounded-lg border border-slate-200/90 bg-white text-left shadow-sm",
        compact ? "gap-1 p-1.5" : "gap-1.5 p-2"
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-0.5">
          {shown.map((p) => (
            <PlatformBadge key={p} name={p} />
          ))}
          {extra > 0 ? (
            <span className="text-[9px] font-medium text-slate-500">
              +{extra}
            </span>
          ) : null}
        </div>
        {showTime ? (
          <span className="inline-flex shrink-0 items-center gap-0.5 text-[9px] tabular-nums text-slate-500">
            <Send className="h-2.5 w-2.5" />
            {time}
          </span>
        ) : null}
      </div>

      {hasMedia ? (
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-md bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.mediaUrl!}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      ) : hasCanva ? (
        <CanvaPreviewTile url={post.mediaUrl!} compact />
      ) : (
        <div className="flex aspect-[16/10] w-full items-center justify-center rounded-md bg-gradient-to-br from-sky-50 to-slate-100 text-sky-200">
          <ImageIcon className="h-5 w-5" />
        </div>
      )}

      <p className="line-clamp-2 text-[10px] font-medium leading-snug text-slate-800">
        {post.text || "Untitled post"}
      </p>

      <div className="mt-auto flex items-center">
        <span
          className={cn(
            "inline-flex max-w-full items-center gap-0.5 truncate rounded-full border px-1.5 py-0.5 text-[9px] font-medium",
            statusTone(post.status)
          )}
        >
          {(post.status.toLowerCase().includes("approv") ||
            post.status.toLowerCase().includes("publish")) && (
            <Check className="h-2.5 w-2.5 shrink-0" />
          )}
          {post.status}
        </span>
      </div>
    </div>
  );
}

export function SocialClient({
  hideHeader = false,
  memberView = false,
}: {
  hideHeader?: boolean;
  /** Members: scheduled/published only, read-only calendar. */
  memberView?: boolean;
}) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [openUrl, setOpenUrl] = useState("https://app.planable.io");
  const [sourceLabel, setSourceLabel] = useState("Social Posts");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [dateWindow, setDateWindow] = useState<"upcoming" | "past" | "all">(
    "upcoming"
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [planableRes, contentRes] = await Promise.all([
        fetch("/api/planable/posts"),
        fetch("/api/content"),
      ]);
      const planable = await planableRes.json();
      const contentData = await contentRes.json();
      setOpenUrl(planable.openUrl ?? "https://app.planable.io");

      const fromHub: SocialPost[] = (
        (contentData.content ?? []) as ContentItem[]
      )
        .filter((c) => isSocialContentItem(c) && !!c.due_date)
        .map((c) => {
          const platforms = (Array.isArray(c.channel) ? c.channel : [c.channel])
            .filter(Boolean)
            .map((ch) => normalizePlatform(String(ch)));
          const unique = Array.from(new Set(platforms));
          const platform = unique[0] ?? "Social";
          const text = stripHtml(
            c.caption || c.title || c.notes || "Untitled post"
          );
          return {
            id: c.id,
            text,
            status: normalizeStatus(c.status),
            scheduledAt: c.due_date ? `${c.due_date}T09:00:00.000Z` : null,
            url: c.planable_url || null,
            platform,
            platforms: unique.length ? unique : [platform],
            mediaUrl:
              primaryImageUrl(c.asset_url) ||
              primaryCanvaUrl(c.asset_url) ||
              null,
            source: "hub" as const,
          };
        })
        .sort((a, b) =>
          String(a.scheduledAt ?? "").localeCompare(String(b.scheduledAt ?? ""))
        );

      const syncedHub = fromHub.filter((p) => {
        const raw = (contentData.content as ContentItem[]).find(
          (c) => c.id === p.id
        );
        return Boolean(raw?.planable_post_id);
      });

      // Hub-first: prefer synced (or any) Hub social rows; live Planable only as fallback.
      let nextPosts =
        fromHub.length > 0
          ? fromHub
          : ((planable.posts ?? []) as Array<{
              id: string;
              text: string;
              status: string;
              scheduledAt: string | null;
              url: string | null;
              pageName: string | null;
              mediaUrl?: string | null;
              platforms?: string[];
            }>).map((p) => {
              const platforms = (p.platforms?.length
                ? p.platforms
                : p.pageName
                  ? [p.pageName]
                  : ["Social"]
              ).map(normalizePlatform);
              return {
                id: `pl_${p.id}`,
                text: stripHtml(p.text),
                status: normalizeStatus(p.status),
                scheduledAt: p.scheduledAt,
                url: p.url,
                platform: platforms[0] ?? "Social",
                platforms,
                mediaUrl: p.mediaUrl ?? null,
                source: "planable" as const,
              };
            });

      if (memberView) {
        nextPosts = nextPosts.filter((p) => {
          const s = p.status.toLowerCase();
          return s === "scheduled" || s === "published";
        });
        setSourceLabel("Scheduled & published");
      } else if (fromHub.length > 0) {
        setSourceLabel(
          syncedHub.length > 0
            ? "Hub (synced with Planable)"
            : "Hub Social Posts"
        );
      } else {
        setSourceLabel(
          planable.configured ? "Planable (live)" : "Social Posts"
        );
      }

      setPosts(nextPosts);
      if (planable.error && !memberView) setError(planable.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load social posts");
      setPosts([]);
    }
    setLoading(false);
  }, [memberView]);

  async function syncFromPlanable() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/planable/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Planable sync failed");
      } else {
        setSourceLabel(
          `Synced · ${data.created ?? 0} new · ${data.updated ?? 0} updated`
        );
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Planable sync failed");
    }
    setSyncing(false);
  }

  useEffect(() => {
    void load();
  }, [load]);

  const statuses = useMemo(() => {
    const set = new Set(posts.map((p) => p.status).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [posts]);

  const platforms = useMemo(() => {
    const set = new Set(
      posts.flatMap((p) =>
        p.platforms.length ? p.platforms : [p.platform]
      ).filter(Boolean)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [posts]);

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (
        !matchesSearch(search, [p.text, p.status, p.platform, ...p.platforms])
      ) {
        return false;
      }
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (
        platformFilter !== "all" &&
        !(p.platforms.length ? p.platforms : [p.platform]).includes(
          platformFilter
        )
      ) {
        return false;
      }
      return true;
    });
  }, [posts, search, statusFilter, platformFilter]);

  const datedPosts = useMemo(
    () =>
      filtered
        .filter((p) => p.scheduledAt)
        .sort((a, b) =>
          String(a.scheduledAt).localeCompare(String(b.scheduledAt))
        ),
    [filtered]
  );

  /** Calendar always includes historic so past months stay populated. */
  const calendarPosts = datedPosts;

  /** List is future-focused unless When filter is changed. */
  const listPosts = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    return datedPosts.filter((p) => {
      if (!p.scheduledAt) return false;
      const t = startOfDay(parseISO(p.scheduledAt)).getTime();
      if (Number.isNaN(t)) return false;
      if (dateWindow === "all") return true;
      if (dateWindow === "past") return t < today;
      return t >= today;
    });
  }, [datedPosts, dateWindow]);

  const postById = useMemo(() => {
    const map = new Map<string, SocialPost>();
    for (const p of calendarPosts) map.set(p.id, p);
    return map;
  }, [calendarPosts]);

  const calendarEvents = useMemo(
    () =>
      calendarPosts.map((p) => {
        const iso = p.scheduledAt!;
        const utcHm = iso.includes("T")
          ? iso.slice(11, 16)
          : "00:00";
        const allDay = utcHm === "00:00" || utcHm === "09:00";
        return {
          id: p.id,
          title: p.text.slice(0, 40),
          start: allDay ? iso.slice(0, 10) : iso,
          allDay,
          editable:
            !memberView &&
            p.source === "hub" &&
            p.status.toLowerCase() !== "published",
          startEditable:
            !memberView &&
            p.source === "hub" &&
            p.status.toLowerCase() !== "published",
          durationEditable: false,
          extendedProps: { postId: p.id, source: p.source },
        };
      }),
    [calendarPosts, memberView]
  );

  async function rescheduleHubPost(id: string, dueDate: string) {
    if (memberView) return;
    const post = posts.find((p) => p.id === id);
    if (!post || post.source !== "hub") return;
    if (post.status.toLowerCase() === "published") return;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, scheduledAt: `${dueDate}T09:00:00.000Z` }
          : p
      )
    );
    await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        id,
        patch: { due_date: dueDate },
      }),
    });
  }

  const selected = selectedId
    ? posts.find((p) => p.id === selectedId) ?? null
    : null;

  return (
    <div>
      <FullCalendarStyles />
      <style>{HUB_CALENDAR_CSS}</style>

      {hideHeader ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-brand">
            Social Media Calendar
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {!memberView ? (
              <button
                type="button"
                className="btn-secondary"
                disabled={syncing || loading}
                onClick={() => void syncFromPlanable()}
              >
                {syncing ? "Syncing…" : "Sync from Planable"}
              </button>
            ) : null}
            <a
              href={openUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-primary"
            >
              Open Planable
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      ) : (
        <PageHeader
          title="Social Media Calendar"
          description={
            memberView
              ? "Scheduled and published posts across channels."
              : "Hub social drafts synced with Planable — approve and publish in Planable."
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {!memberView ? (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={syncing || loading}
                  onClick={() => void syncFromPlanable()}
                >
                  {syncing ? "Syncing…" : "Sync from Planable"}
                </button>
              ) : null}
              <a
                href={openUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-primary"
              >
                Open Planable
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          }
        />
      )}

      {!memberView ? <SocialMonthlyPlan /> : null}

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search posts, platform, status…"
        resultCount={listPosts.length}
        totalCount={posts.length}
        selects={[
          {
            id: "status",
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "all", label: "All statuses" },
              ...statuses.map((s) => ({ value: s, label: s })),
            ],
          },
          {
            id: "platform",
            label: "Platform",
            value: platformFilter,
            onChange: setPlatformFilter,
            options: [
              { value: "all", label: "All platforms" },
              ...platforms.map((p) => ({ value: p, label: p })),
            ],
          },
          {
            id: "when",
            label: "When",
            value: dateWindow,
            onChange: (v) =>
              setDateWindow(v as "upcoming" | "past" | "all"),
            options: [
              { value: "upcoming", label: "Upcoming (default)" },
              { value: "past", label: "Past only" },
              { value: "all", label: "All dates" },
            ],
          },
        ]}
      />

      {loading ? (
        <p className="text-sm text-muted">Loading social calendar…</p>
      ) : (
        <div className="space-y-6">
          <p className="text-xs text-muted">
            Showing data from {sourceLabel}
            {error ? ` · ${error}` : ""}
          </p>

          <div className="hub-fc surface-card overflow-hidden p-3 md:p-4">
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              height="auto"
              firstDay={1}
              events={calendarEvents}
              dayMaxEvents={3}
              moreLinkClick="popover"
              editable={!memberView}
              eventStartEditable={!memberView}
              eventDurationEditable={false}
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "",
              }}
              eventClick={(info) => {
                info.jsEvent.preventDefault();
                const id = String(
                  info.event.extendedProps.postId ?? info.event.id
                );
                setSelectedId(id);
              }}
              eventDrop={(info) => {
                const source = info.event.extendedProps.source;
                const id = String(
                  info.event.extendedProps.postId ?? info.event.id
                );
                const post = posts.find((p) => p.id === id);
                if (
                  source !== "hub" ||
                  post?.status.toLowerCase() === "published"
                ) {
                  info.revert();
                  return;
                }
                const next = info.event.startStr.slice(0, 10);
                if (!next) {
                  info.revert();
                  return;
                }
                void rescheduleHubPost(id, next).catch(() => info.revert());
              }}
              eventClassNames="!border-0 !bg-transparent cursor-grab active:cursor-grabbing"
              eventContent={(arg) => {
                const id = String(
                  arg.event.extendedProps.postId ?? arg.event.id
                );
                const post = postById.get(id);
                if (!post) {
                  return (
                    <span className="truncate text-[10px] text-slate-600">
                      {arg.event.title}
                    </span>
                  );
                }
                return <PostCard post={post} compact />;
              }}
            />
          </div>

          <div className="surface-card overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-brand">
                {dateWindow === "upcoming"
                  ? "Upcoming posts"
                  : dateWindow === "past"
                    ? "Past posts"
                    : "All dated posts"}
              </h2>
            </div>
            <ul className="divide-y divide-border">
              {listPosts.slice(0, 40).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={cn(
                      "grid w-full grid-cols-[4rem_1fr_auto] items-center gap-2 px-4 py-3 text-left transition hover:bg-sand/70 sm:grid-cols-[4.5rem_7rem_1fr_auto] sm:gap-3",
                      selectedId === p.id && "bg-accent-soft/60"
                    )}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <span className="text-sm text-muted">
                      {p.scheduledAt
                        ? format(parseISO(p.scheduledAt), "MMM d")
                        : "—"}
                    </span>
                    <span className="hidden w-fit rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800 sm:inline-flex">
                      {p.platform}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {p.text || "Untitled post"}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted sm:hidden">
                        {p.platform}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        statusTone(p.status)
                      )}
                    >
                      {p.status}
                    </span>
                  </button>
                </li>
              ))}
              {listPosts.length === 0 ? (
                <li className="px-4 py-8 text-sm text-muted">
                  No posts match this When filter.
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      )}

      {selected ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/25 md:left-sidebar"
            onClick={() => setSelectedId(null)}
            aria-hidden
          />
          <aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-white shadow-soft"
            role="dialog"
            aria-modal="true"
            aria-label="Social post detail"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-brand">Post detail</h2>
              <button
                type="button"
                className="btn-ghost px-2.5 py-1.5 text-xs"
                onClick={() => setSelectedId(null)}
              >
                Close
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {isImageUrl(selected.mediaUrl) ? (
                <div className="overflow-hidden rounded-lg border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selected.mediaUrl!}
                    alt=""
                    className="max-h-56 w-full object-cover"
                  />
                </div>
              ) : isCanvaUrl(selected.mediaUrl) ? (
                <div className="overflow-hidden rounded-lg border border-border">
                  <CanvaPreviewTile url={selected.mediaUrl!} compact={false} />
                </div>
              ) : null}
              <p className="whitespace-pre-wrap text-base font-medium leading-relaxed">
                {selected.text}
              </p>
              <div className="flex flex-wrap gap-2">
                {selected.platforms.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                  >
                    <PlatformBadge name={p} />
                    {p}
                  </span>
                ))}
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    statusTone(selected.status)
                  )}
                >
                  {(selected.status.toLowerCase().includes("approv") ||
                    selected.status.toLowerCase().includes("publish")) && (
                    <Check className="h-3 w-3" />
                  )}
                  {selected.status}
                </span>
              </div>
              <p className="text-sm text-muted">
                {selected.scheduledAt
                  ? format(
                      parseISO(selected.scheduledAt),
                      "EEEE d MMMM yyyy · HH:mm"
                    )
                  : "No schedule date"}
              </p>
              <p className="text-xs text-muted">
                Source:{" "}
                {selected.source === "planable" ? "Planable" : "Hub Content"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
              {selected.url ? (
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary"
                >
                  Open in Planable
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : (
                <a href="/app/content" className="btn-secondary">
                  Edit in Content planner
                </a>
              )}
              {isCanvaUrl(selected.mediaUrl) ? (
                <a
                  href={selected.mediaUrl!}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary"
                >
                  Open in Canva
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setSelectedId(null)}
              >
                Close
              </button>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
