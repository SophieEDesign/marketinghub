"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PartnerKind, Sponsorship, SponsorshipStatus } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, matchesSearch } from "@/components/ui/FilterBar";
import { ContactOwnerSelect } from "@/components/ui/ContactOwnerSelect";
import { useHubView } from "@/lib/hub-view";
import { format, parseISO, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { RichTextView } from "@/components/ui/RichTextView";
import { plainTextFromHtml } from "@/lib/sanitize";
import { RelatedTasksPanel } from "@/components/tasks/RelatedTasksPanel";
import { TimelineChart } from "@/components/ui/TimelineChart";

const STATUSES: { id: SponsorshipStatus; label: string }[] = [
  { id: "prospect", label: "Prospect" },
  { id: "negotiating", label: "Negotiating" },
  { id: "confirmed", label: "Confirmed" },
  { id: "active", label: "Active" },
  { id: "complete", label: "Complete" },
  { id: "declined", label: "Declined" },
];

const STATUS_COLOR: Record<SponsorshipStatus, string> = {
  prospect: "#94a3b8",
  negotiating: "#c47b3a",
  confirmed: "#5b6ee1",
  active: "#3d8b5c",
  complete: "#64748b",
  declined: "#b91c1c",
};

const VIEWS = [
  { id: "list", label: "List" },
  { id: "kanban", label: "Kanban" },
  { id: "timeline", label: "Timeline" },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

const emptyForm = {
  partner: "",
  package_name: "",
  starts_at: "",
  ends_at: "",
  value: "",
  status: "prospect" as SponsorshipStatus,
  deliverables: "",
  owner: "",
  onedrive_url: "",
  notes: "",
};

type EditForm = typeof emptyForm;

function toEditForm(item: Sponsorship): EditForm {
  return {
    partner: item.partner,
    package_name: item.package_name,
    starts_at: item.starts_at ?? "",
    ends_at: item.ends_at ?? "",
    value: item.value,
    status: item.status,
    deliverables: item.deliverables,
    owner: item.owner,
    onedrive_url: item.onedrive_url,
    notes: item.notes,
  };
}

function statusLabel(status: SponsorshipStatus) {
  return STATUSES.find((s) => s.id === status)?.label ?? status;
}

function partnerKind(item: Sponsorship): PartnerKind {
  return item.kind === "membership" ? "membership" : "sponsorship";
}

export function SponsorshipsClient({
  initial,
  kind = "all",
  hideHeader = false,
}: {
  initial: Sponsorship[];
  /** Filter to one partner type, or show all */
  kind?: PartnerKind | "all";
  hideHeader?: boolean;
}) {
  const { view: hubView } = useHubView();
  const isAdminView = hubView === "admin";

  const [items, setItems] = useState(initial);
  const [view, setView] = useState<ViewId>("list");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState<Sponsorship | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  const createKind: PartnerKind =
    kind === "membership" ? "membership" : "sponsorship";
  const isMembership = kind === "membership";
  const showKindPicker = kind === "all" && isAdminView;
  const [formKind, setFormKind] = useState<PartnerKind>("membership");
  const activeCreateKind: PartnerKind = !isAdminView
    ? "membership"
    : showKindPicker
      ? formKind
      : createKind;
  /** Members can add memberships; sponsorships are admin-only. */
  const canCreate =
    isAdminView || kind === "membership" || kind === "all";
  const canManageItem = (item: Sponsorship) =>
    isAdminView || partnerKind(item) === "membership";
  const noun =
    !isAdminView || kind === "membership"
      ? "membership"
      : kind === "all"
        ? "partner"
        : "sponsorship";
  const nounTitle =
    kind === "all"
      ? "All partners"
      : isMembership
        ? "Memberships"
        : "Sponsorships";
  const packageLabel =
    activeCreateKind === "membership" ? "Tier / package" : "Package";
  const nameLabel =
    activeCreateKind === "membership" ? "Organisation" : "Partner";

  useEffect(() => {
    if (!isAdminView) setFormKind("membership");
  }, [isAdminView]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/sponsorships");
    const data = await res.json();
    setItems(data.sponsorships ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selected) return;
    const next = items.find((i) => i.id === selected.id) ?? null;
    setSelected(next);
    // Only re-sync when the list or selected id changes, not on every selected object update.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selected intentionally omitted
  }, [items, selected?.id]);

  const scoped = useMemo(() => {
    if (kind === "all") return items;
    return items.filter((i) => partnerKind(i) === kind);
  }, [items, kind]);

  const filtered = useMemo(() => {
    return scoped.filter((item) => {
      if (
        !matchesSearch(search, [
          item.partner,
          item.package_name,
          item.value,
          item.owner,
          plainTextFromHtml(item.deliverables),
          plainTextFromHtml(item.notes),
          item.status,
          partnerKind(item),
        ])
      ) {
        return false;
      }
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      return true;
    });
  }, [scoped, search, statusFilter]);

  const dated = useMemo(
    () =>
      filtered
        .filter((i) => i.starts_at)
        .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at))),
    [filtered]
  );

  const timelineItems = useMemo(() => {
    return dated.map((item) => {
      const start = parseISO(item.starts_at!);
      const end = item.ends_at
        ? parseISO(item.ends_at)
        : addDays(start, 30);
      return {
        id: item.id,
        label: item.partner,
        subtitle: [
          statusLabel(item.status),
          item.package_name,
          item.value,
        ]
          .filter(Boolean)
          .join(" · "),
        start,
        end: end.getTime() >= start.getTime() ? end : start,
        color: STATUS_COLOR[item.status],
      };
    });
  }, [dated]);

  const undatedCount = useMemo(
    () => filtered.filter((i) => !i.starts_at).length,
    [filtered]
  );

  async function create() {
    if (!canCreate) return;
    await fetch("/api/sponsorships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        kind: activeCreateKind,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
      }),
    });
    setShowForm(false);
    setForm(emptyForm);
    await refresh();
  }

  function openEdit(item: Sponsorship) {
    if (!canManageItem(item)) return;
    setEditingId(item.id);
    setEdit(toEditForm(item));
  }

  function closeEdit() {
    setEditingId(null);
    setEdit(null);
  }

  async function saveEdit() {
    if (!editingId || !edit) return;
    const current = items.find((i) => i.id === editingId);
    if (!current || !canManageItem(current)) return;
    setSaving(true);
    try {
      await fetch("/api/sponsorships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: editingId,
          patch: {
            ...edit,
            partner: edit.partner.trim() || "Untitled partner",
            starts_at: edit.starts_at || null,
            ends_at: edit.ends_at || null,
          },
        }),
      });
      closeEdit();
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: SponsorshipStatus) {
    const item = items.find((i) => i.id === id);
    if (!item || !canManageItem(item)) return;
    await fetch("/api/sponsorships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, patch: { status } }),
    });
    if (editingId === id && edit) setEdit({ ...edit, status });
    await refresh();
  }

  async function remove(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item || !canManageItem(item)) return;
    if (!window.confirm(`Delete this ${noun}?`)) return;
    await fetch("/api/sponsorships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    if (editingId === id) closeEdit();
    if (selected?.id === id) setSelected(null);
    await refresh();
  }

  const editingItem = editingId
    ? items.find((i) => i.id === editingId) ?? null
    : null;

  function formatDateLabel(value: string | null) {
    if (!value) return "—";
    try {
      return format(parseISO(value), "d MMM yyyy");
    } catch {
      return value;
    }
  }

  function CardActions({ item }: { item: Sponsorship }) {
    const manageable = canManageItem(item);
    return (
      <div
        className="mt-3 flex flex-wrap items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {manageable ? (
          <>
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
                void setStatus(item.id, e.target.value as SponsorshipStatus)
              }
              aria-label="Change status"
            >
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </>
        ) : null}
        {item.onedrive_url ? (
          <a
            href={item.onedrive_url.startsWith("http") ? item.onedrive_url : undefined}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost px-2.5 py-1.5 text-xs"
            onClick={(e) => {
              if (!item.onedrive_url.startsWith("http")) e.preventDefault();
            }}
          >
            Docs
          </a>
        ) : null}
      </div>
    );
  }

  const addButton =
    canCreate && (isAdminView || kind !== "sponsorship") ? (
      <button
        type="button"
        className="btn-primary"
        onClick={() => {
          if (!isAdminView) setFormKind("membership");
          setShowForm(true);
        }}
      >
        Add {isAdminView && kind === "all" ? "partner" : noun}
      </button>
    ) : null;

  return (
    <div>
      {hideHeader ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-brand">{nounTitle}</h2>
          {addButton}
        </div>
      ) : (
        <PageHeader
          title={nounTitle}
          description={
            isMembership
              ? "Industry associations and memberships — renewals, fees, and benefits."
              : "Sponsorship partners, packages, deliverables, and docs."
          }
          actions={addButton}
        />
      )}

      <div
        className="mb-5 inline-flex flex-wrap gap-1 rounded-2xl border border-border bg-white p-1"
        role="tablist"
        aria-label={`${nounTitle} views`}
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
        searchPlaceholder={`Search ${nameLabel.toLowerCase()}, ${packageLabel.toLowerCase()}, notes…`}
        resultCount={filtered.length}
        totalCount={scoped.length}
        selects={[
          {
            id: "status",
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "all", label: "All statuses" },
              ...STATUSES.map((s) => ({ value: s.id, label: s.label })),
            ],
          },
        ]}
      />

      {showForm && canCreate ? (
        <div className="surface-card mb-6 grid gap-3 p-5 md:grid-cols-2">
          {showKindPicker ? (
            <div className="md:col-span-2">
              <label className="label">Type</label>
              <select
                className="field"
                value={formKind}
                onChange={(e) =>
                  setFormKind(e.target.value as PartnerKind)
                }
              >
                <option value="sponsorship">Sponsorship</option>
                <option value="membership">Membership</option>
              </select>
            </div>
          ) : !isAdminView ? (
            <div className="md:col-span-2 rounded-xl border border-border bg-sand/40 px-3 py-2 text-xs text-muted">
              Adding a <span className="font-medium text-foreground">membership</span>
              . Sponsorships are managed in Admin view.
            </div>
          ) : null}
          {(
            [
              ["partner", nameLabel],
              ["package_name", packageLabel],
              [
                "value",
                activeCreateKind === "membership" ? "Fee / value" : "Value",
              ],
              ["onedrive_url", "Docs / OneDrive URL"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                className="field"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
          <div>
            <label className="label">Owner</label>
            <ContactOwnerSelect
              value={form.owner}
              onChange={(owner) => setForm({ ...form, owner })}
            />
          </div>
          <div>
            <label className="label">Starts</label>
            <input
              className="field"
              type="date"
              value={form.starts_at}
              onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Ends</label>
            <input
              className="field"
              type="date"
              value={form.ends_at}
              onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="field"
              value={form.status}
              onChange={(e) =>
                setForm({
                  ...form,
                  status: e.target.value as SponsorshipStatus,
                })
              }
            >
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Deliverables</label>
            <RichTextEditor
              value={form.deliverables}
              onChange={(deliverables) => setForm({ ...form, deliverables })}
              placeholder="Deliverables…"
              minHeight="70px"
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Notes</label>
            <RichTextEditor
              value={form.notes}
              onChange={(notes) => setForm({ ...form, notes })}
              placeholder="Notes…"
              minHeight="70px"
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
          {view === "list" ? (
            <div className="space-y-3">
              {filtered.map((item) => (
                <article
                  key={item.id}
                  className={cn(
                    "surface-card cursor-pointer p-5 transition hover:border-brand/30 hover:shadow-md",
                    selected?.id === item.id && "ring-2 ring-brand/30"
                  )}
                  onClick={() => setSelected(item)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-xl text-brand">
                        {item.partner}
                      </h2>
                      <p className="text-sm text-muted">
                        {item.package_name || "No package"} ·{" "}
                        {item.value || "—"} · {statusLabel(item.status)}
                      </p>
                    </div>
                  </div>
                  {plainTextFromHtml(item.deliverables) ? (
                    <div className="mt-3 text-sm">
                      <RichTextView html={item.deliverables} />
                    </div>
                  ) : null}
                  {plainTextFromHtml(item.notes) ? (
                    <RichTextView
                      html={item.notes}
                      plain
                      clampLines={3}
                      className="mt-2 text-xs text-muted"
                    />
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                    {item.starts_at ? <span>From {item.starts_at}</span> : null}
                    {item.ends_at ? <span>To {item.ends_at}</span> : null}
                    {item.owner ? <span>Owner: {item.owner}</span> : null}
                  </div>
                  <CardActions item={item} />
                </article>
              ))}
              {filtered.length === 0 ? (
                <p className="text-sm text-muted">
                  No partners match your filters.
                </p>
              ) : null}
            </div>
          ) : null}

          {view === "kanban" ? (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {STATUSES.map((col) => {
                const colItems = filtered.filter((i) => i.status === col.id);
                return (
                  <div
                    key={col.id}
                    className="surface-card flex w-72 shrink-0 flex-col p-3"
                  >
                    <div className="mb-3 flex items-center justify-between px-1">
                      <h2 className="text-sm font-semibold text-brand">
                        {col.label}
                      </h2>
                      <span className="text-xs text-muted">{colItems.length}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {colItems.map((item) => (
                        <article
                          key={item.id}
                          className={cn(
                            "cursor-pointer rounded-xl border border-border bg-sand/60 p-3 transition hover:border-brand/30 hover:shadow-sm",
                            selected?.id === item.id && "ring-2 ring-brand/30"
                          )}
                          onClick={() => setSelected(item)}
                        >
                          <p className="text-sm font-medium">{item.partner}</p>
                          <p className="mt-1 text-xs text-muted">
                            {item.package_name || "No package"}
                            {item.value ? ` · ${item.value}` : ""}
                          </p>
                          <CardActions item={item} />
                        </article>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {view === "timeline" ? (
            <TimelineChart
              items={timelineItems}
              onSelect={(id) => {
                const item = filtered.find((i) => i.id === id);
                if (item) setSelected(item);
              }}
              emptyMessage="Add start dates to see a timeline — or use List / Kanban."
              footer={
                undatedCount > 0 ? (
                  <p className="mt-4 text-xs text-muted">
                    {undatedCount} partner(s) have no start date and are hidden
                    here — switch to List or Kanban to edit them.
                  </p>
                ) : null
              }
            />
          ) : null}
      </div>

      {selected && !edit ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/25 md:left-sidebar"
            onClick={() => setSelected(null)}
            aria-hidden
          />
          <aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-white shadow-soft"
            role="dialog"
            aria-modal="true"
            aria-label={`${selected.partner} details`}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-brand">
                Partner details
              </h2>
              <button
                type="button"
                className="btn-ghost px-2.5 py-1.5 text-xs"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                <div>
                  <h3 className="font-display text-2xl text-brand">
                    {selected.partner}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white"
                      style={{ background: STATUS_COLOR[selected.status] }}
                    >
                      {statusLabel(selected.status)}
                    </span>
                    <span className="rounded-full bg-sand px-2.5 py-0.5 text-[11px] font-medium text-muted">
                      {partnerKind(selected) === "membership"
                        ? "Membership"
                        : "Sponsorship"}
                    </span>
                  </div>
                </div>

                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="label !mb-0.5">
                      {partnerKind(selected) === "membership"
                        ? "Tier / package"
                        : "Package"}
                    </dt>
                    <dd>{selected.package_name || "—"}</dd>
                  </div>
                  <div>
                    <dt className="label !mb-0.5">
                      {partnerKind(selected) === "membership"
                        ? "Fee / value"
                        : "Value"}
                    </dt>
                    <dd>{selected.value || "—"}</dd>
                  </div>
                  <div>
                    <dt className="label !mb-0.5">Starts</dt>
                    <dd>{formatDateLabel(selected.starts_at)}</dd>
                  </div>
                  <div>
                    <dt className="label !mb-0.5">Ends</dt>
                    <dd>{formatDateLabel(selected.ends_at)}</dd>
                  </div>
                  <div>
                    <dt className="label !mb-0.5">Owner</dt>
                    <dd>{selected.owner || "—"}</dd>
                  </div>
                  <div>
                    <dt className="label !mb-0.5">Deliverables</dt>
                    <dd>
                      <RichTextView html={selected.deliverables} />
                    </dd>
                  </div>
                  <div>
                    <dt className="label !mb-0.5">Notes</dt>
                    <dd>
                      <RichTextView html={selected.notes} />
                    </dd>
                  </div>
                  {selected.onedrive_url ? (
                    <div>
                      <dt className="label !mb-0.5">Docs</dt>
                      <dd>
                        {selected.onedrive_url.startsWith("http") ? (
                          <a
                            href={selected.onedrive_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand underline-offset-2 hover:underline"
                          >
                            Open docs
                          </a>
                        ) : (
                          selected.onedrive_url
                        )}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <RelatedTasksPanel
                  className="mt-4"
                  relatedType="sponsorship"
                  relatedId={selected.id}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
              {canManageItem(selected) ? (
                <>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => openEdit(selected)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-ghost text-[var(--danger)]"
                    onClick={() => void remove(selected.id)}
                  >
                    Delete
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>
          </aside>
        </>
      ) : null}

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
            aria-label={`Edit ${noun}`}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-brand">
                Edit {noun}
              </h2>
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
                {(
                  [
                    ["partner", nameLabel],
                    ["package_name", packageLabel],
                    ["value", isMembership ? "Fee / value" : "Value"],
                    ["onedrive_url", "Docs / OneDrive URL"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className="label">{label}</label>
                    <input
                      className="field"
                      value={edit[key]}
                      onChange={(e) =>
                        setEdit({ ...edit, [key]: e.target.value })
                      }
                    />
                  </div>
                ))}
                <div>
                  <label className="label">Owner</label>
                  <ContactOwnerSelect
                    value={edit.owner}
                    onChange={(owner) => setEdit({ ...edit, owner })}
                  />
                </div>
                <div>
                  <label className="label">Starts</label>
                  <input
                    className="field"
                    type="date"
                    value={edit.starts_at}
                    onChange={(e) =>
                      setEdit({ ...edit, starts_at: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="label">Ends</label>
                  <input
                    className="field"
                    type="date"
                    value={edit.ends_at}
                    onChange={(e) =>
                      setEdit({ ...edit, ends_at: e.target.value })
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
                        status: e.target.value as SponsorshipStatus,
                      })
                    }
                  >
                    {STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Deliverables</label>
                  <RichTextEditor
                    value={edit.deliverables}
                    onChange={(deliverables) =>
                      setEdit({ ...edit, deliverables })
                    }
                    placeholder="Deliverables…"
                    minHeight="70px"
                  />
                </div>
                <div>
                  <label className="label">Notes</label>
                  <RichTextEditor
                    value={edit.notes}
                    onChange={(notes) => setEdit({ ...edit, notes })}
                    placeholder="Notes…"
                    minHeight="90px"
                  />
                </div>
                <RelatedTasksPanel
                  relatedType="sponsorship"
                  relatedId={editingId}
                />
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
