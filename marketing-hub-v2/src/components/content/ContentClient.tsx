"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDays,
  differenceInCalendarDays,
  format,
  max as maxDate,
  min as minDate,
  parseISO,
  startOfDay,
} from "date-fns";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import type { ContentItem, ContentStatus } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { FullCalendarStyles } from "@/components/ui/FullCalendarStyles";
import { FilterBar, matchesSearch } from "@/components/ui/FilterBar";
import { cn } from "@/lib/utils";
import { isSocialContentItem } from "@/lib/data/normalize";
import {
  ContentCalendarCard,
  HUB_CALENDAR_CSS,
} from "@/components/content/ContentCalendarCard";
import { AssetUploadField } from "@/components/content/AssetUploadField";

const COLUMNS: { id: ContentStatus; label: string }[] = [
  { id: "idea", label: "Idea" },
  { id: "draft", label: "Draft" },
  { id: "review", label: "Review" },
  { id: "scheduled", label: "Scheduled" },
  { id: "published", label: "Published" },
];

const VIEWS = [
  { id: "calendar", label: "Calendar" },
  { id: "kanban", label: "Kanban" },
  { id: "timeline", label: "Timeline" },
  { id: "gantt", label: "Gantt" },
] as const;

type ContentView = (typeof VIEWS)[number]["id"];

const STATUS_COLOR: Record<ContentStatus, string> = {
  idea: "#94a3b8",
  draft: "#2a8f9e",
  review: "#c47b3a",
  scheduled: "#5b6ee1",
  published: "#3d8b5c",
};

const emptyForm = {
  title: "",
  channel: "LinkedIn",
  content_type: "Social",
  due_date: "",
  notes: "",
  planable_url: "",
  asset_url: "",
};

type EditForm = {
  title: string;
  channel: string;
  content_type: string;
  due_date: string;
  notes: string;
  planable_url: string;
  asset_url: string;
  status: ContentStatus;
};

function toEditForm(item: ContentItem): EditForm {
  return {
    title: item.title,
    channel: item.channel,
    content_type: item.content_type || "Social",
    due_date: item.due_date ?? "",
    notes: item.notes,
    planable_url: item.planable_url,
    asset_url: item.asset_url,
    status: item.status,
  };
}

function statusLabel(status: ContentStatus) {
  return COLUMNS.find((c) => c.id === status)?.label ?? status;
}

function parseDue(item: ContentItem): Date | null {
  if (!item.due_date) return null;
  try {
    return parseISO(item.due_date.slice(0, 10));
  } catch {
    return null;
  }
}

/** Upcoming = today or later, or no date (still in the pipeline). */
function matchesDateWindow(
  item: ContentItem,
  window: "upcoming" | "past" | "all" | "undated"
): boolean {
  if (window === "all") return true;
  const due = parseDue(item);
  if (window === "undated") return !due;
  if (!due) return window === "upcoming";
  const today = startOfDay(new Date()).getTime();
  const t = startOfDay(due).getTime();
  if (window === "upcoming") return t >= today;
  if (window === "past") return t < today;
  return true;
}

export function ContentClient({
  initial,
  hideHeader = false,
  scope = "all",
}: {
  initial: ContentItem[];
  hideHeader?: boolean;
  /** When "content", hide social posts; when "social", only social. */
  scope?: "all" | "content" | "social";
}) {
  const [items, setItems] = useState(initial);
  const [view, setView] = useState<ContentView>("calendar");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [datedOnly, setDatedOnly] = useState<"upcoming" | "past" | "all" | "undated">(
    "upcoming"
  );

  const refresh = useCallback(async () => {
    const res = await fetch("/api/content");
    const data = await res.json();
    setItems(data.content ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const scopedItems = useMemo(() => {
    if (scope === "social") return items.filter(isSocialContentItem);
    if (scope === "content") return items.filter((i) => !isSocialContentItem(i));
    return items;
  }, [items, scope]);

  const channels = useMemo(() => {
    const set = new Set(
      scopedItems.map((i) => i.channel.trim()).filter(Boolean)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [scopedItems]);

  const contentTypes = useMemo(() => {
    const set = new Set(
      scopedItems.map((i) => (i.content_type || "").trim()).filter(Boolean)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [scopedItems]);

  const filtered = useMemo(() => {
    return scopedItems.filter((item) => {
      if (
        !matchesSearch(search, [
          item.title,
          item.channel,
          item.content_type,
          item.notes,
          item.status,
        ])
      ) {
        return false;
      }
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (channelFilter !== "all" && item.channel !== channelFilter) return false;
      if (typeFilter !== "all" && item.content_type !== typeFilter) return false;
      return true;
    });
  }, [
    scopedItems,
    search,
    statusFilter,
    channelFilter,
    typeFilter,
  ]);

  /** Lists / Kanban / Timeline / Gantt — future-focused unless date filter opened up. */
  const listItems = useMemo(
    () => filtered.filter((item) => matchesDateWindow(item, datedOnly)),
    [filtered, datedOnly]
  );

  /** Calendar keeps historic posts so past months still populate. */
  const calendarItems = useMemo(
    () =>
      filtered.filter((item) => {
        if (!item.due_date) return false;
        if (datedOnly === "all" || datedOnly === "upcoming") return true;
        return matchesDateWindow(item, datedOnly);
      }),
    [filtered, datedOnly]
  );

  const editingItem = editingId
    ? items.find((i) => i.id === editingId) ?? null
    : null;

  const calendarEvents = useMemo(
    () =>
      calendarItems.map((i) => {
        // Date-only start avoids UTC midnight showing as "1a" (1am) in BST.
        const start = i.due_date!.slice(0, 10);
        return {
          id: i.id,
          title: i.title,
          start,
          allDay: true,
          extendedProps: { itemId: i.id },
        };
      }),
    [calendarItems]
  );

  const calendarItemById = useMemo(() => {
    const map = new Map<string, ContentItem>();
    for (const i of calendarItems) map.set(i.id, i);
    return map;
  }, [calendarItems]);

  const timelineEntries = useMemo(() => {
    const dated = listItems
      .map((item) => ({ item, due: parseDue(item) }))
      .filter((x): x is { item: ContentItem; due: Date } => !!x.due)
      .sort((a, b) => a.due.getTime() - b.due.getTime());

    const undated = listItems.filter((i) => !i.due_date);
    return { dated, undated };
  }, [listItems]);

  const gantt = useMemo(() => {
    const dated = listItems
      .map((item) => {
        const due = parseDue(item);
        if (!due) return null;
        const created = item.created_at
          ? parseISO(item.created_at.slice(0, 10))
          : addDays(due, -7);
        const start =
          created.getTime() <= due.getTime() ? created : addDays(due, -7);
        return { item, start, end: due };
      })
      .filter(
        (x): x is { item: ContentItem; start: Date; end: Date } => x !== null
      )
      .sort((a, b) => a.end.getTime() - b.end.getTime());

    if (dated.length === 0) {
      return {
        rows: [],
        rangeStart: new Date(),
        rangeEnd: addDays(new Date(), 28),
        days: 28,
      };
    }

    const rangeStart = addDays(minDate(dated.map((d) => d.start)), -2);
    const rangeEnd = addDays(maxDate(dated.map((d) => d.end)), 7);
    const days = Math.max(
      14,
      differenceInCalendarDays(rangeEnd, rangeStart) || 14
    );

    const rows = dated.map(({ item, start, end }) => {
      const left = (differenceInCalendarDays(start, rangeStart) / days) * 100;
      const width = Math.max(
        1.5,
        (differenceInCalendarDays(end, start) / days) * 100
      );
      return { item, left, width, start, end };
    });

    return { rows, rangeStart, rangeEnd, days };
  }, [listItems]);

  async function create() {
    await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        due_date: form.due_date || null,
        status: "idea",
      }),
    });
    setShowForm(false);
    setForm(emptyForm);
    await refresh();
  }

  function openEdit(item: ContentItem) {
    setEditingId(item.id);
    setEdit(toEditForm(item));
  }

  function closeEdit() {
    setEditingId(null);
    setEdit(null);
  }

  async function saveEdit() {
    if (!editingId || !edit) return;
    setSaving(true);
    try {
      await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: editingId,
          patch: {
            title: edit.title.trim() || "Untitled post",
            channel: edit.channel.trim() || "Social",
            content_type: edit.content_type.trim() || "Social",
            due_date: edit.due_date || null,
            notes: edit.notes,
            planable_url: edit.planable_url,
            asset_url: edit.asset_url,
            status: edit.status,
          },
        }),
      });
      closeEdit();
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function move(id: string, status: ContentStatus) {
    await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, patch: { status } }),
    });
    if (editingId === id && edit) {
      setEdit({ ...edit, status });
    }
    await refresh();
  }

  async function reschedule(id: string, dueDate: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, due_date: dueDate } : i))
    );
    if (editingId === id && edit) {
      setEdit({ ...edit, due_date: dueDate });
    }
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

  async function remove(id: string) {
    if (!window.confirm("Delete this content piece?")) return;
    await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    if (editingId === id) closeEdit();
    await refresh();
  }

  function CardSummary({ item }: { item: ContentItem }) {
    return (
      <>
        <p className="text-sm font-medium">{item.title}</p>
        <p className="mt-1 text-xs text-muted">
          {item.content_type ? `${item.content_type} · ` : ""}
          {item.channel}
          {item.due_date ? ` · due ${item.due_date}` : ""}
        </p>
        {item.notes ? (
          <p className="mt-2 line-clamp-2 text-xs text-foreground/70">{item.notes}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-secondary px-2.5 py-1.5 text-xs"
            onClick={() => openEdit(item)}
          >
            Edit
          </button>
          <select
            className="field !w-auto py-1.5 text-xs"
            value={item.status}
            onChange={(e) =>
              void move(item.id, e.target.value as ContentStatus)
            }
            aria-label="Move to status"
          >
            {COLUMNS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </>
    );
  }

  return (
    <div>
      <FullCalendarStyles />
      <style>{HUB_CALENDAR_CSS}</style>
      {hideHeader ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-brand">
            {scope === "all"
              ? "Content & Social"
              : scope === "content"
                ? "Content planner"
                : "Content"}
          </h2>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowForm(true)}
          >
            Add piece
          </button>
        </div>
      ) : (
        <PageHeader
          title="Content planner"
          description="Switch between Kanban, calendar, timeline, or Gantt. Synced data comes from Social Posts."
          actions={
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowForm(true)}
            >
              Add piece
            </button>
          }
        />
      )}

      <div
        className="mb-5 inline-flex flex-wrap gap-1 rounded-2xl border border-border bg-white p-1"
        role="tablist"
        aria-label="Content views"
      >
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            className={cn(
              "rounded-xl px-3.5 py-2 text-sm font-medium transition",
              view === v.id
                ? "bg-brand text-white shadow-sm"
                : "text-muted hover:bg-sand hover:text-foreground"
            )}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search title, channel, notes…"
        resultCount={view === "calendar" ? calendarItems.length : listItems.length}
        totalCount={scopedItems.length}
        selects={[
          {
            id: "status",
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "all", label: "All statuses" },
              ...COLUMNS.map((c) => ({ value: c.id, label: c.label })),
            ],
          },
          {
            id: "type",
            label: "Type",
            value: typeFilter,
            onChange: setTypeFilter,
            options: [
              { value: "all", label: "All types" },
              ...contentTypes.map((t) => ({ value: t, label: t })),
            ],
          },
          {
            id: "channel",
            label: "Channel",
            value: channelFilter,
            onChange: setChannelFilter,
            options: [
              { value: "all", label: "All channels" },
              ...channels.map((c) => ({ value: c, label: c })),
            ],
          },
          {
            id: "dated",
            label: "When",
            value: datedOnly,
            onChange: (v) =>
              setDatedOnly(v as "upcoming" | "past" | "all" | "undated"),
            options: [
              { value: "upcoming", label: "Upcoming (default)" },
              { value: "past", label: "Past only" },
              { value: "all", label: "All dates" },
              { value: "undated", label: "No due date" },
            ],
          },
        ]}
      />

      {showForm ? (
        <div className="surface-card mb-6 grid gap-3 p-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label">Title</label>
            <input
              className="field"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Content type</label>
            <select
              className="field"
              value={form.content_type}
              onChange={(e) =>
                setForm({ ...form, content_type: e.target.value })
              }
            >
              <option value="Social">Social</option>
              <option value="Editorial">Editorial</option>
              <option value="Newsletter">Newsletter</option>
              <option value="Sponsorship">Sponsorship</option>
              <option value="PR">PR</option>
            </select>
          </div>
          <div>
            <label className="label">Channel</label>
            <input
              className="field"
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Due date</label>
            <input
              className="field"
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Notes</label>
            <textarea
              className="field min-h-[70px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <AssetUploadField
              value={form.asset_url}
              onChange={(asset_url) => setForm({ ...form, asset_url })}
            />
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={() => void create()}>
              Save
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div>
          {view === "kanban" ? (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {COLUMNS.map((col) => {
                const colItems = listItems.filter((i) => i.status === col.id);
                return (
                  <div
                    key={col.id}
                    className="surface-card flex w-80 shrink-0 flex-col p-3"
                  >
                    <div className="mb-3 flex items-center justify-between px-1">
                      <h2 className="text-sm font-semibold text-brand">{col.label}</h2>
                      <span className="text-xs text-muted">{colItems.length}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {colItems.map((item) => (
                        <article
                          key={item.id}
                          className="rounded-xl border border-border bg-sand/60 p-3"
                        >
                          <CardSummary item={item} />
                        </article>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {view === "calendar" ? (
            <div className="hub-fc surface-card overflow-hidden p-3 md:p-4">
              <p className="mb-3 text-xs text-muted">
                {scope === "all"
                  ? "Content and Social on one calendar. Drag cards to reschedule, or click to edit."
                  : "Drag cards to reschedule, or click to edit."}
              </p>
              <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin, listPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "dayGridMonth,listWeek",
                }}
                height="auto"
                firstDay={1}
                dayMaxEvents={3}
                moreLinkClick="popover"
                editable
                eventStartEditable
                eventDurationEditable={false}
                events={calendarEvents}
                eventClassNames="!border-0 !bg-transparent cursor-grab active:cursor-grabbing"
                eventClick={(info) => {
                  info.jsEvent.preventDefault();
                  const item = items.find((i) => i.id === info.event.id);
                  if (item) openEdit(item);
                }}
                eventDrop={(info) => {
                  const id = String(
                    info.event.extendedProps.itemId ?? info.event.id
                  );
                  const next = info.event.startStr.slice(0, 10);
                  if (!next) {
                    info.revert();
                    return;
                  }
                  void reschedule(id, next).catch(() => info.revert());
                }}
                eventContent={(arg) => {
                  const id = String(
                    arg.event.extendedProps.itemId ?? arg.event.id
                  );
                  const item = calendarItemById.get(id);
                  if (!item) {
                    return (
                      <span className="truncate text-[10px] text-slate-600">
                        {arg.event.title}
                      </span>
                    );
                  }
                  return <ContentCalendarCard item={item} compact />;
                }}
              />
              {calendarEvents.length === 0 ? (
                <p className="mt-4 text-sm text-muted">
                  No dated pieces yet — add a due date when editing.
                </p>
              ) : null}
            </div>
          ) : null}

          {view === "timeline" ? (
            <div className="surface-card p-4 md:p-6">
              {timelineEntries.dated.length > 0 ? (
                <ol className="relative ml-2 space-y-0 md:ml-3">
                  {/* Continuous spine */}
                  <span
                    className="absolute bottom-2 left-[2.65rem] top-2 w-px bg-border md:left-[3.15rem]"
                    aria-hidden
                  />
                  {timelineEntries.dated.map(({ item, due }, index) => {
                    const prev = timelineEntries.dated[index - 1];
                    const showMonth =
                      !prev ||
                      format(prev.due, "yyyy-MM") !== format(due, "yyyy-MM");
                    const isPast = due.getTime() < startOfDay(new Date()).getTime();
                    return (
                      <li key={item.id}>
                        {showMonth ? (
                          <div className="relative z-10 mb-3 mt-2 first:mt-0">
                            <span className="inline-flex rounded-full bg-brand px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                              {format(due, "MMMM yyyy")}
                            </span>
                          </div>
                        ) : null}
                        <div className="relative grid grid-cols-[3.25rem_1.25rem_1fr] items-start gap-2 pb-5 md:grid-cols-[4rem_1.5rem_1fr] md:gap-3">
                          <button
                            type="button"
                            className="pt-1 text-right"
                            onClick={() => openEdit(item)}
                          >
                            <span className="block font-display text-xl leading-none text-brand md:text-2xl">
                              {format(due, "d")}
                            </span>
                            <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted">
                              {format(due, "EEE")}
                            </span>
                          </button>
                          <div className="relative flex justify-center pt-2">
                            <span
                              className={cn(
                                "relative z-10 h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm ring-2",
                                isPast ? "ring-slate-300" : "ring-brand/30"
                              )}
                              style={{ background: STATUS_COLOR[item.status] }}
                              aria-hidden
                            />
                          </div>
                          <button
                            type="button"
                            className={cn(
                              "rounded-xl border border-border bg-white p-3 text-left shadow-sm transition hover:border-brand/30 hover:shadow-md",
                              isPast && "opacity-75"
                            )}
                            onClick={() => openEdit(item)}
                          >
                            <div className="mb-1.5 flex flex-wrap items-center gap-2">
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                                style={{ background: STATUS_COLOR[item.status] }}
                              >
                                {statusLabel(item.status)}
                              </span>
                              <span className="text-xs text-muted">
                                {item.channel}
                                {item.content_type
                                  ? ` · ${item.content_type}`
                                  : ""}
                              </span>
                            </div>
                            <p className="font-medium text-foreground">
                              {item.title}
                            </p>
                            {item.notes ? (
                              <p className="mt-1 line-clamp-2 text-xs text-muted">
                                {item.notes}
                              </p>
                            ) : null}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="text-sm text-muted">
                  No dated pieces in this filter. Add due dates, or set When to
                  All dates / Past.
                </p>
              )}

              {timelineEntries.undated.length > 0 ? (
                <section className="mt-8 border-t border-border pt-6">
                  <h2 className="mb-3 text-sm font-semibold text-brand">
                    No due date
                  </h2>
                  <div className="grid gap-2 md:grid-cols-2">
                    {timelineEntries.undated.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="rounded-xl border border-border bg-sand/60 p-3 text-left hover:border-brand/30"
                        onClick={() => openEdit(item)}
                      >
                        <CardSummary item={item} />
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          {view === "gantt" ? (
            <div className="surface-card overflow-x-auto p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted">
                  Bars run from created/start toward the due date. Click a bar to
                  edit.
                </p>
                <p className="text-xs text-muted">
                  {format(gantt.rangeStart, "d MMM")} –{" "}
                  {format(gantt.rangeEnd, "d MMM yyyy")}
                </p>
              </div>

              {gantt.rows.length === 0 ? (
                <p className="text-sm text-muted">
                  Add due dates to see pieces on the Gantt chart.
                </p>
              ) : (
                <div className="min-w-[720px]">
                  <div className="mb-2 grid grid-cols-[200px_1fr] gap-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    <div>Piece</div>
                    <div className="relative h-6">
                      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                        <span
                          key={t}
                          className="absolute top-0 -translate-x-1/2"
                          style={{ left: `${t * 100}%` }}
                        >
                          {format(
                            addDays(gantt.rangeStart, Math.round(gantt.days * t)),
                            "d MMM"
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {gantt.rows.map(({ item, left, width, end }) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-[200px_1fr] items-center gap-3"
                      >
                        <button
                          type="button"
                          className="truncate text-left text-sm font-medium hover:text-brand"
                          onClick={() => openEdit(item)}
                          title={item.title}
                        >
                          {item.title}
                        </button>
                        <div className="relative h-9 rounded-lg bg-sand/80">
                          <button
                            type="button"
                            className="absolute top-1.5 h-6 rounded-md px-2 text-left text-[11px] font-medium text-white shadow-sm transition hover:opacity-90"
                            style={{
                              left: `${Math.min(98, Math.max(0, left))}%`,
                              width: `${Math.min(100 - left, width)}%`,
                              minWidth: "4.5rem",
                              background: STATUS_COLOR[item.status],
                            }}
                            onClick={() => openEdit(item)}
                            title={`${item.title} · due ${format(end, "d MMM")}`}
                          >
                            <span className="block truncate">
                              {statusLabel(item.status)} · {format(end, "d MMM")}
                            </span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {listItems.some((i) => !i.due_date) ? (
                    <p className="mt-4 text-xs text-muted">
                      {listItems.filter((i) => !i.due_date).length} piece(s) have no
                      due date and are hidden here — switch to Kanban or Timeline
                      to edit them.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
      </div>

      {edit && editingItem ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/25 md:left-sidebar"
            onClick={closeEdit}
            aria-hidden
          />
          <aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-white shadow-soft"
            role="dialog"
            aria-modal="true"
            aria-label="Edit content piece"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-brand">Edit piece</h2>
              <button
                type="button"
                className="btn-ghost px-2.5 py-1.5 text-xs"
                onClick={closeEdit}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid gap-2">
                <div>
                  <label className="label">Title</label>
                  <input
                    className="field"
                    value={edit.title}
                    onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Content type</label>
                  <select
                    className="field"
                    value={edit.content_type}
                    onChange={(e) =>
                      setEdit({ ...edit, content_type: e.target.value })
                    }
                  >
                    <option value="Social">Social</option>
                    <option value="Editorial">Editorial</option>
                    <option value="Newsletter">Newsletter</option>
                    <option value="Sponsorship">Sponsorship</option>
                    <option value="PR">PR</option>
                  </select>
                </div>
                <div>
                  <label className="label">Channel</label>
                  <input
                    className="field"
                    value={edit.channel}
                    onChange={(e) =>
                      setEdit({ ...edit, channel: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="label">Due date</label>
                  <input
                    className="field"
                    type="date"
                    value={edit.due_date}
                    onChange={(e) =>
                      setEdit({ ...edit, due_date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select
                    className="field"
                    value={edit.status}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        status: e.target.value as ContentStatus,
                      })
                    }
                  >
                    {COLUMNS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Notes</label>
                  <textarea
                    className="field min-h-[70px]"
                    value={edit.notes}
                    onChange={(e) =>
                      setEdit({ ...edit, notes: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="label">Planable URL</label>
                  <input
                    className="field"
                    value={edit.planable_url}
                    onChange={(e) =>
                      setEdit({ ...edit, planable_url: e.target.value })
                    }
                  />
                </div>
                <div>
                  <AssetUploadField
                    value={edit.asset_url}
                    onChange={(asset_url) => setEdit({ ...edit, asset_url })}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={() => void saveEdit()}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={saving}
                onClick={closeEdit}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-ghost text-[var(--danger)]"
                disabled={saving}
                onClick={() => void remove(editingItem.id)}
              >
                Delete
              </button>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
