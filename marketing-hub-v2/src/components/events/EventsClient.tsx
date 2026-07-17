"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import type { EventItem } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { FullCalendarStyles } from "@/components/ui/FullCalendarStyles";
import { FilterBar, matchesSearch } from "@/components/ui/FilterBar";
import { useHubView } from "@/lib/hub-view";
import {
  DIVISION_OPTIONS,
  divisionColor,
  normalizeDivision,
} from "@/lib/events/division-colors";
import {
  EVENT_TYPE_COLORS,
  eventTypeColor,
  normalizeEventTypeLabel,
} from "@/lib/events/event-type-colors";
import { EVENT_TYPES, selectOptionsWithCurrent } from "@/lib/data/collections";

const emptyForm = {
  title: "",
  starts_at: "",
  ends_at: "",
  location: "",
  event_type: "Event",
  division: "",
  notes: "",
  link_url: "",
};

type EventForm = typeof emptyForm;

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toEditForm(event: EventItem): EventForm {
  return {
    title: event.title,
    starts_at: toLocalInput(event.starts_at),
    ends_at: toLocalInput(event.ends_at),
    location: event.location,
    event_type: event.event_type || "Event",
    division: event.division || "",
    notes: event.notes,
    link_url: event.link_url,
  };
}

function hasValidStart(event: EventItem): boolean {
  if (!event.starts_at) return false;
  const t = new Date(event.starts_at).getTime();
  return !Number.isNaN(t);
}

/** Midnight / date-only ISO — avoid showing as "1a" in BST. */
function isDateOnlyIso(iso: string): boolean {
  if (!iso.includes("T")) return true;
  return iso.slice(11, 16) === "00:00";
}

function formatEventWhen(event: EventItem): string {
  if (!hasValidStart(event)) return "Date to be added";
  const startDate = format(new Date(event.starts_at!), "EEE d MMM yyyy");
  const dateOnly = isDateOnlyIso(event.starts_at!);
  let line = dateOnly
    ? startDate
    : `${startDate} · ${format(new Date(event.starts_at!), "HH:mm")}`;
  if (event.ends_at) {
    const end = new Date(event.ends_at);
    if (!Number.isNaN(end.getTime())) {
      const endDay = format(end, "EEE d MMM yyyy");
      if (endDay !== startDate) line += ` → ${endDay}`;
    }
  }
  return line;
}

function DivisionSwatch({
  division,
  compact = false,
}: {
  division: string;
  compact?: boolean;
}) {
  const color = divisionColor(division);
  const label = normalizeDivision(division) || "Unassigned";
  if (compact) {
    return (
      <span
        className="inline-flex max-w-full truncate rounded px-1 py-px text-[9px] font-semibold leading-tight text-white/95"
        style={{ backgroundColor: "rgba(0,0,0,0.28)" }}
        title={label}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
      style={{ backgroundColor: color.bg }}
    >
      {label}
    </span>
  );
}

function TypeSwatch({ eventType }: { eventType: string }) {
  const color = eventTypeColor(eventType);
  const label = normalizeEventTypeLabel(eventType);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
      style={{ backgroundColor: color.bg }}
    >
      {label}
    </span>
  );
}

function EventFields({
  form,
  onChange,
}: {
  form: EventForm;
  onChange: (next: EventForm) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <label className="label">Title</label>
        <input
          className="field"
          value={form.title}
          onChange={(e) => onChange({ ...form, title: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Starts (optional)</label>
        <input
          className="field"
          type="datetime-local"
          value={form.starts_at}
          onChange={(e) => onChange({ ...form, starts_at: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Ends</label>
        <input
          className="field"
          type="datetime-local"
          value={form.ends_at}
          onChange={(e) => onChange({ ...form, ends_at: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Location</label>
        <input
          className="field"
          value={form.location}
          onChange={(e) => onChange({ ...form, location: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Type</label>
        <select
          className="field"
          value={form.event_type}
          onChange={(e) => onChange({ ...form, event_type: e.target.value })}
        >
          {selectOptionsWithCurrent(EVENT_TYPES, form.event_type).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Division</label>
        <select
          className="field"
          value={form.division}
          onChange={(e) => onChange({ ...form, division: e.target.value })}
        >
          <option value="">Unassigned</option>
          {DIVISION_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="label">Link</label>
        <input
          className="field"
          value={form.link_url}
          onChange={(e) => onChange({ ...form, link_url: e.target.value })}
          placeholder="https://"
        />
      </div>
      <div className="md:col-span-2">
        <label className="label">Notes</label>
        <textarea
          className="field min-h-[80px]"
          value={form.notes}
          onChange={(e) => onChange({ ...form, notes: e.target.value })}
        />
      </div>
    </div>
  );
}

export function EventsClient({
  initialEvents,
}: {
  initialEvents: EventItem[];
}) {
  const { view } = useHubView();
  const canDelete = view === "admin";

  const [events, setEvents] = useState(initialEvents);
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EventForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [divisionFilter, setDivisionFilter] = useState("all");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/events");
    const data = await res.json();
    setEvents(data.events ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Keep selected in sync after refresh/edit
  useEffect(() => {
    if (!selected) return;
    const next = events.find((e) => e.id === selected.id) ?? null;
    setSelected(next);
  }, [events, selected?.id]);

  const eventTypes = useMemo(() => {
    const set = new Set(
      events.map((e) => e.event_type.trim()).filter(Boolean)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [events]);

  const divisions = useMemo(() => {
    const set = new Set(
      events.map((e) => normalizeDivision(e.division)).filter(Boolean)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (
        !matchesSearch(search, [
          e.title,
          e.location,
          e.event_type,
          e.division,
          e.notes,
        ])
      ) {
        return false;
      }
      if (typeFilter !== "all" && e.event_type !== typeFilter) return false;
      if (
        divisionFilter !== "all" &&
        normalizeDivision(e.division) !== divisionFilter
      ) {
        return false;
      }
      return true;
    });
  }, [events, search, typeFilter, divisionFilter]);

  const dated = useMemo(
    () => filtered.filter((e) => hasValidStart(e)),
    [filtered]
  );
  const undated = useMemo(
    () =>
      filtered
        .filter((e) => !hasValidStart(e))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [filtered]
  );

  const calendarEvents = useMemo(
    () =>
      dated.map((e) => {
        const color = eventTypeColor(e.event_type);
        const startIso = e.starts_at!;
        const allDay = isDateOnlyIso(startIso);
        let end: string | undefined;
        if (e.ends_at) {
          if (allDay || isDateOnlyIso(e.ends_at)) {
            end = format(
              addDays(parseISO(e.ends_at.slice(0, 10)), 1),
              "yyyy-MM-dd"
            );
          } else {
            end = e.ends_at;
          }
        }
        return {
          id: e.id,
          title: e.title,
          start: allDay ? startIso.slice(0, 10) : startIso,
          end,
          allDay,
          backgroundColor: color.bg,
          borderColor: color.border,
          textColor: color.text,
          extendedProps: {
            eventType: e.event_type,
            division: e.division,
          },
        };
      }),
    [dated]
  );

  const typeLegend = useMemo(() => {
    const fromData = new Set(
      events.map((e) => normalizeEventTypeLabel(e.event_type)).filter(Boolean)
    );
    const known = Object.keys(EVENT_TYPE_COLORS);
    const ordered = [
      ...known.filter((k) => fromData.has(k)),
      ...Array.from(fromData)
        .filter((k) => !known.includes(k))
        .sort(),
    ];
    return ordered.length ? ordered : known;
  }, [events]);

  async function createEvent() {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        starts_at: form.starts_at
          ? new Date(form.starts_at).toISOString()
          : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      }),
    });
    setShowForm(false);
    setForm(emptyForm);
    await refresh();
  }

  function openEdit(event: EventItem) {
    setEditingId(event.id);
    setEdit(toEditForm(event));
  }

  function closeEdit() {
    setEditingId(null);
    setEdit(null);
  }

  async function saveEdit() {
    if (!editingId || !edit) return;
    setSaving(true);
    try {
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: editingId,
          patch: {
            title: edit.title.trim() || "Untitled event",
            starts_at: edit.starts_at
              ? new Date(edit.starts_at).toISOString()
              : null,
            ends_at: edit.ends_at ? new Date(edit.ends_at).toISOString() : null,
            location: edit.location,
            event_type: edit.event_type || "Event",
            division: edit.division || "",
            notes: edit.notes,
            link_url: edit.link_url,
          },
        }),
      });
      closeEdit();
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function removeEvent(id: string) {
    if (!canDelete) return;
    if (!window.confirm("Delete this event?")) return;
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    if (editingId === id) closeEdit();
    setSelected(null);
    await refresh();
  }

  async function rescheduleEvent(
    id: string,
    startsAt: string,
    endsAt: string | null
  ) {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              starts_at: startsAt,
              ends_at: endsAt,
              updated_at: new Date().toISOString(),
            }
          : e
      )
    );
    setSelected((s) =>
      s && s.id === id ? { ...s, starts_at: startsAt, ends_at: endsAt } : s
    );
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        id,
        patch: { starts_at: startsAt, ends_at: endsAt },
      }),
    });
  }

  const editingEvent = editingId
    ? events.find((e) => e.id === editingId) ?? null
    : null;

  return (
    <div>
      <FullCalendarStyles />
      <PageHeader
        title="Events"
        description="Add and edit shows and meetings. Attendance lives in the event spreadsheet. Only admins can delete events."
        actions={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                setViewMode(viewMode === "calendar" ? "list" : "calendar")
              }
            >
              {viewMode === "calendar" ? "List view" : "Calendar view"}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowForm(true)}
            >
              Add event
            </button>
          </>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search events, location, notes…"
        resultCount={filtered.length}
        totalCount={events.length}
        selects={[
          {
            id: "type",
            label: "Type",
            value: typeFilter,
            onChange: setTypeFilter,
            options: [
              { value: "all", label: "All types" },
              ...eventTypes.map((t) => ({ value: t, label: t })),
            ],
          },
          {
            id: "division",
            label: "Division",
            value: divisionFilter,
            onChange: setDivisionFilter,
            options: [
              { value: "all", label: "All divisions" },
              ...divisions.map((d) => ({ value: d, label: d })),
            ],
          },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-muted">
        <span className="font-medium text-foreground">Type</span>
        {typeLegend.map((name) => {
          const color = eventTypeColor(name);
          return (
            <span key={name} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color.bg }}
                aria-hidden
              />
              {name}
            </span>
          );
        })}
      </div>

      {showForm ? (
        <div className="surface-card mb-6 p-5">
          <EventFields form={form} onChange={setForm} />
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void createEvent()}
            >
              Save
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="surface-card p-4">
          {viewMode === "calendar" ? (
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin, listPlugin]}
              initialView="dayGridMonth"
              height="auto"
              firstDay={1}
              editable
              eventStartEditable
              eventDurationEditable={false}
              events={calendarEvents}
              eventClick={(info) => {
                const found = events.find((e) => e.id === info.event.id);
                setSelected(found ?? null);
              }}
              eventDrop={(info) => {
                const id = info.event.id;
                const existing = events.find((e) => e.id === id);
                if (!existing?.starts_at) {
                  info.revert();
                  return;
                }
                const newStartDay = info.event.startStr.slice(0, 10);
                const oldStartDay = existing.starts_at.slice(0, 10);
                const dayDelta = differenceInCalendarDays(
                  parseISO(newStartDay),
                  parseISO(oldStartDay)
                );
                const dateOnly = isDateOnlyIso(existing.starts_at);
                const starts_at = dateOnly
                  ? `${newStartDay}T00:00:00.000Z`
                  : info.event.start
                    ? info.event.start.toISOString()
                    : existing.starts_at;
                let ends_at: string | null = existing.ends_at;
                if (existing.ends_at) {
                  if (isDateOnlyIso(existing.ends_at)) {
                    ends_at = `${format(
                      addDays(parseISO(existing.ends_at.slice(0, 10)), dayDelta),
                      "yyyy-MM-dd"
                    )}T00:00:00.000Z`;
                  } else {
                    ends_at = addDays(
                      new Date(existing.ends_at),
                      dayDelta
                    ).toISOString();
                  }
                }
                void rescheduleEvent(id, starts_at, ends_at).catch(() =>
                  info.revert()
                );
              }}
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,listMonth",
              }}
              eventClassNames="!border-0 cursor-grab active:cursor-grabbing"
              eventContent={(arg) => {
                const division = String(
                  arg.event.extendedProps.division ?? ""
                ).trim();
                return (
                  <div className="flex w-full min-w-0 flex-col gap-0.5 px-1 py-0.5">
                    <span className="truncate text-[11px] font-semibold leading-tight text-white">
                      {arg.event.title}
                    </span>
                    {division ? (
                      <DivisionSwatch division={division} compact />
                    ) : null}
                  </div>
                );
              }}
            />
          ) : (
            <ul className="divide-y divide-border">
              {dated.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className={`flex w-full items-start justify-between gap-3 py-3 text-left hover:bg-sand ${
                      selected?.id === e.id ? "bg-accent-soft/50" : ""
                    }`}
                    onClick={() => setSelected(e)}
                  >
                    <div>
                      <p className="font-medium">{e.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <TypeSwatch eventType={e.event_type} />
                        {e.division ? (
                          <DivisionSwatch division={e.division} />
                        ) : null}
                        {e.location ? <span>{e.location}</span> : null}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted">
                      {format(new Date(e.starts_at!), "d MMM yyyy")}
                    </span>
                  </button>
                </li>
              ))}
              {dated.length === 0 ? (
                <li className="py-6 text-sm text-muted">
                  No dated events match your filters.
                </li>
              ) : null}
            </ul>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <div className="surface-card p-5">
            {selected ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-xl text-brand">
                    {selected.title}
                  </h2>
                  <button
                    type="button"
                    className="btn-ghost shrink-0 px-2 py-1 text-xs"
                    onClick={() => setSelected(null)}
                  >
                    Clear
                  </button>
                </div>

                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="label !mb-0.5">When</dt>
                    <dd
                      className={
                        hasValidStart(selected)
                          ? "text-foreground"
                          : "font-medium text-amber-800"
                      }
                    >
                      {formatEventWhen(selected)}
                    </dd>
                  </div>
                  <div>
                    <dt className="label !mb-0.5">Type</dt>
                    <dd>
                      <TypeSwatch eventType={selected.event_type || "Event"} />
                    </dd>
                  </div>
                  <div>
                    <dt className="label !mb-0.5">Division</dt>
                    <dd>
                      {selected.division ? (
                        <DivisionSwatch division={selected.division} />
                      ) : (
                        <span className="text-muted">Unassigned</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="label !mb-0.5">Location</dt>
                    <dd>{selected.location || "—"}</dd>
                  </div>
                  {selected.link_url ? (
                    <div>
                      <dt className="label !mb-0.5">Link</dt>
                      <dd>
                        <a
                          href={selected.link_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand underline-offset-2 hover:underline"
                        >
                          Open link
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="label !mb-0.5">Notes</dt>
                    <dd className="whitespace-pre-wrap text-foreground/90">
                      {selected.notes || "—"}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openEdit(selected)}
                  >
                    {hasValidStart(selected) ? "Edit event" : "Add date"}
                  </button>
                  {canDelete ? (
                    <button
                      type="button"
                      className="btn-ghost text-[var(--danger)]"
                      onClick={() => void removeEvent(selected.id)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">
                Select an event on the calendar or from the list below to see
                details.
              </p>
            )}
          </div>

          <div className="surface-card flex max-h-[420px] flex-col overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold text-brand">
                Needs a date
              </h3>
              <p className="mt-0.5 text-xs text-muted">
                {undated.length} event{undated.length === 1 ? "" : "s"} not on
                the calendar
              </p>
            </div>
            <ul className="flex-1 divide-y divide-border overflow-y-auto">
              {undated.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className={`flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-sand ${
                      selected?.id === e.id ? "bg-accent-soft/50" : ""
                    }`}
                    onClick={() => setSelected(e)}
                  >
                    <span className="text-sm font-medium">{e.title}</span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <TypeSwatch eventType={e.event_type} />
                      {e.division ? (
                        <DivisionSwatch division={e.division} />
                      ) : null}
                      {e.location ? <span>{e.location}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
              {undated.length === 0 ? (
                <li className="px-4 py-6 text-sm text-muted">
                  All matching events have dates.
                </li>
              ) : null}
            </ul>
          </div>
        </aside>
      </div>

      {edit && editingEvent ? (
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
            aria-label="Edit event"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-brand">Edit event</h2>
              <button
                type="button"
                className="btn-ghost px-2.5 py-1.5 text-xs"
                onClick={closeEdit}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <EventFields form={edit} onChange={setEdit} />
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={() => void saveEdit()}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={closeEdit}
              >
                Cancel
              </button>
              {canDelete ? (
                <button
                  type="button"
                  className="btn-ghost text-[var(--danger)]"
                  disabled={saving}
                  onClick={() => void removeEvent(editingEvent.id)}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
