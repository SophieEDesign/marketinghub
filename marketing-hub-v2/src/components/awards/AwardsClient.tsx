"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import type { AwardEntry, AwardStatus } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, matchesSearch } from "@/components/ui/FilterBar";
import { ContactOwnerSelect } from "@/components/ui/ContactOwnerSelect";
import { useHubView } from "@/lib/hub-view";
import { cn } from "@/lib/utils";

const STATUSES: { id: AwardStatus; label: string }[] = [
  { id: "watching", label: "Watching" },
  { id: "entering", label: "Entering" },
  { id: "submitted", label: "Submitted" },
  { id: "shortlisted", label: "Shortlisted" },
  { id: "won", label: "Won" },
  { id: "not_won", label: "Not won" },
];

const emptyForm = {
  title: "",
  organisation: "",
  category: "",
  year: String(new Date().getFullYear()),
  status: "watching" as AwardStatus,
  ceremony_at: "",
  owner: "",
  notes: "",
};

type EditForm = typeof emptyForm;

function toEditForm(item: AwardEntry): EditForm {
  return {
    title: item.title,
    organisation: item.organisation,
    category: item.category,
    year: String(item.year),
    status: item.status,
    ceremony_at: item.ceremony_at ?? "",
    owner: item.owner,
    notes: item.notes,
  };
}

function statusTone(status: AwardStatus) {
  if (status === "won") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (status === "shortlisted") return "bg-amber-50 text-amber-900 border-amber-200";
  if (status === "submitted" || status === "entering") {
    return "bg-sky-50 text-sky-800 border-sky-200";
  }
  if (status === "not_won") return "bg-slate-100 text-slate-600 border-slate-200";
  return "bg-sand text-muted border-border";
}

export function AwardsClient({ initial }: { initial: AwardEntry[] }) {
  const { view } = useHubView();
  const isAdmin = view === "admin";

  const [items, setItems] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/awards");
    const data = await res.json();
    setItems(data.awards ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const years = useMemo(() => {
    const set = new Set(items.map((i) => String(i.year)));
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (
        !matchesSearch(search, [
          item.title,
          item.organisation,
          item.category,
          item.owner,
          item.notes,
        ])
      ) {
        return false;
      }
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (yearFilter !== "all" && String(item.year) !== yearFilter) return false;
      return true;
    });
  }, [items, search, statusFilter, yearFilter]);

  async function create() {
    if (!isAdmin) return;
    await fetch("/api/awards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        year: Number(form.year) || new Date().getFullYear(),
        ceremony_at: form.ceremony_at || null,
      }),
    });
    setShowForm(false);
    setForm(emptyForm);
    await refresh();
  }

  function openEdit(item: AwardEntry) {
    if (!isAdmin) return;
    setEditingId(item.id);
    setEdit(toEditForm(item));
  }

  function closeEdit() {
    setEditingId(null);
    setEdit(null);
  }

  async function saveEdit() {
    if (!isAdmin || !editingId || !edit) return;
    setSaving(true);
    try {
      await fetch("/api/awards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: editingId,
          patch: {
            title: edit.title.trim() || "Untitled award",
            organisation: edit.organisation,
            category: edit.category,
            year: Number(edit.year) || new Date().getFullYear(),
            status: edit.status,
            ceremony_at: edit.ceremony_at || null,
            owner: edit.owner,
            notes: edit.notes,
          },
        }),
      });
      closeEdit();
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!isAdmin) return;
    if (!window.confirm("Remove this award entry?")) return;
    await fetch("/api/awards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    if (editingId === id) closeEdit();
    await refresh();
  }

  return (
    <div>
      <PageHeader
        title="Awards"
        description="Track industry awards we’re watching, entering, or have won — sits alongside Sponsorships."
        actions={
          isAdmin ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowForm(true)}
            >
              Add award
            </button>
          ) : null
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search awards, organisers, categories…"
        resultCount={filtered.length}
        totalCount={items.length}
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
          {
            id: "year",
            label: "Year",
            value: yearFilter,
            onChange: setYearFilter,
            options: [
              { value: "all", label: "All years" },
              ...years.map((y) => ({ value: y, label: y })),
            ],
          },
        ]}
      />

      {isAdmin && showForm ? (
        <div className="surface-card mb-6 grid gap-3 p-5 md:grid-cols-2">
          <AwardFields form={form} onChange={setForm} />
          <div className="md:col-span-2 flex gap-2">
            <button type="button" className="btn-primary" onClick={() => void create()}>
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

      <ul className="space-y-3">
        {filtered.map((item) => (
          <li key={item.id} className="surface-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium text-brand">{item.title}</h2>
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      statusTone(item.status)
                    )}
                  >
                    {STATUSES.find((s) => s.id === item.status)?.label ??
                      item.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {[item.organisation, item.category, String(item.year)]
                    .filter(Boolean)
                    .join(" · ")}
                  {item.ceremony_at
                    ? ` · ceremony ${format(parseISO(item.ceremony_at), "d MMM yyyy")}`
                    : ""}
                  {item.owner ? ` · ${item.owner}` : ""}
                </p>
                {item.notes ? (
                  <p className="mt-2 line-clamp-2 text-sm text-foreground/80">
                    {item.notes}
                  </p>
                ) : null}
                {item.event_id ? (
                  <a
                    href="/app/events"
                    className="mt-2 inline-block text-xs font-medium text-brand underline-offset-2 hover:underline"
                  >
                    Linked from Events
                  </a>
                ) : null}
              </div>
              {isAdmin ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openEdit(item)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-ghost text-[var(--danger)]"
                    onClick={() => void remove(item.id)}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
        {filtered.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
            No awards match your filters.
            {isAdmin ? " Add one, or sync Events that include award ceremonies." : ""}
          </li>
        ) : null}
      </ul>

      {isAdmin && edit && editingId ? (
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
            aria-label="Edit award"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-brand">Edit award</h2>
              <button
                type="button"
                className="btn-ghost px-2.5 py-1.5 text-xs"
                onClick={closeEdit}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <AwardFields form={edit} onChange={setEdit} />
            </div>
            <div className="flex gap-2 border-t border-border px-4 py-3">
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={() => void saveEdit()}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button type="button" className="btn-secondary" onClick={closeEdit}>
                Cancel
              </button>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}

function AwardFields({
  form,
  onChange,
}: {
  form: EditForm;
  onChange: (next: EditForm) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <label className="label">Award name</label>
        <input
          className="field"
          value={form.title}
          onChange={(e) => onChange({ ...form, title: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Organisation</label>
        <input
          className="field"
          value={form.organisation}
          onChange={(e) => onChange({ ...form, organisation: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Category</label>
        <input
          className="field"
          value={form.category}
          onChange={(e) => onChange({ ...form, category: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Year</label>
        <input
          className="field"
          type="number"
          value={form.year}
          onChange={(e) => onChange({ ...form, year: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Status</label>
        <select
          className="field"
          value={form.status}
          onChange={(e) =>
            onChange({ ...form, status: e.target.value as AwardStatus })
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
        <label className="label">Ceremony date</label>
        <input
          className="field"
          type="date"
          value={form.ceremony_at}
          onChange={(e) => onChange({ ...form, ceremony_at: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Owner</label>
        <ContactOwnerSelect
          value={form.owner}
          onChange={(owner) => onChange({ ...form, owner })}
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
