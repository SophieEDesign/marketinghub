"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import type { HubTask, TaskStatus } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, matchesSearch } from "@/components/ui/FilterBar";
import { ContactOwnerSelect } from "@/components/ui/ContactOwnerSelect";
import { cn } from "@/lib/utils";
import {
  TASK_CATEGORIES,
  selectOptionsWithCurrent,
} from "@/lib/data/collections";

const STATUSES: { id: TaskStatus; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "doing", label: "Doing" },
  { id: "done", label: "Done" },
];

const emptyForm = {
  title: "",
  details: "",
  due_date: "",
  category: "Events",
  status: "todo" as TaskStatus,
  owner: "",
};

type EditForm = typeof emptyForm;

function toEditForm(item: HubTask): EditForm {
  return {
    title: item.title,
    details: item.details,
    due_date: item.due_date ?? "",
    category: item.category,
    status: item.status,
    owner: item.owner,
  };
}

function statusTone(status: TaskStatus) {
  if (status === "done") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (status === "doing") return "bg-sky-50 text-sky-800 border-sky-200";
  return "bg-amber-50 text-amber-900 border-amber-200";
}

function isOverdue(item: HubTask) {
  if (!item.due_date || item.status === "done") return false;
  try {
    return isBefore(parseISO(item.due_date), startOfDay(new Date()));
  } catch {
    return false;
  }
}

export function TasksClient({ initial }: { initial: HubTask[] }) {
  const [items, setItems] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [ownerFilter, setOwnerFilter] = useState("all");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/tasks");
    const data = await res.json();
    setItems(data.tasks ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const owners = useMemo(() => {
    const set = new Set(items.map((i) => i.owner.trim()).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (
        !matchesSearch(search, [
          item.title,
          item.details,
          item.category,
          item.owner,
          item.status,
        ])
      ) {
        return false;
      }
      if (statusFilter === "open" && item.status === "done") return false;
      if (
        statusFilter !== "all" &&
        statusFilter !== "open" &&
        item.status !== statusFilter
      ) {
        return false;
      }
      if (ownerFilter !== "all" && item.owner !== ownerFilter) return false;
      return true;
    });
  }, [items, search, statusFilter, ownerFilter]);

  async function create() {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        due_date: form.due_date || null,
      }),
    });
    setShowForm(false);
    setForm(emptyForm);
    await refresh();
  }

  async function saveEdit() {
    if (!editingId || !edit) return;
    setSaving(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: editingId,
          patch: {
            title: edit.title.trim() || "Untitled task",
            details: edit.details,
            due_date: edit.due_date || null,
            category: edit.category,
            status: edit.status,
            owner: edit.owner,
          },
        }),
      });
      setEditingId(null);
      setEdit(null);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: TaskStatus) {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, patch: { status } }),
    });
    await refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this task?")) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    if (editingId === id) {
      setEditingId(null);
      setEdit(null);
    }
    await refresh();
  }

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Marketing to-dos — keep it light. Status, owner, and due date."
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowForm(true)}
          >
            Add task
          </button>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search tasks…"
        resultCount={filtered.length}
        totalCount={items.length}
        selects={[
          {
            id: "status",
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "open", label: "Open (to do + doing)" },
              { value: "all", label: "All statuses" },
              ...STATUSES.map((s) => ({ value: s.id, label: s.label })),
            ],
          },
          {
            id: "owner",
            label: "Owner",
            value: ownerFilter,
            onChange: setOwnerFilter,
            options: [
              { value: "all", label: "All owners" },
              ...owners.map((o) => ({ value: o, label: o })),
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
            <label className="label">Due date</label>
            <input
              className="field"
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Category</label>
            <select
              className="field"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {TASK_CATEGORIES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Owner</label>
            <ContactOwnerSelect
              value={form.owner}
              onChange={(owner) => setForm({ ...form, owner })}
            />
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="field"
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as TaskStatus })
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
            <label className="label">Details</label>
            <textarea
              className="field min-h-[70px]"
              value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
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

      <ul className="surface-card divide-y divide-border">
        {filtered.map((item) => (
          <li key={item.id} className="flex flex-wrap items-start gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{item.title}</p>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    statusTone(item.status)
                  )}
                >
                  {STATUSES.find((s) => s.id === item.status)?.label ?? item.status}
                </span>
                {isOverdue(item) ? (
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800">
                    Overdue
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted">
                {[
                  item.category,
                  item.owner,
                  item.due_date
                    ? `Due ${format(parseISO(item.due_date), "d MMM yyyy")}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {item.details ? (
                <p className="mt-2 line-clamp-2 text-sm text-foreground/80">
                  {item.details}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="field !w-auto py-1.5 text-xs"
                value={item.status}
                onChange={(e) =>
                  void setStatus(item.id, e.target.value as TaskStatus)
                }
                aria-label="Change status"
              >
                {STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary px-2.5 py-1.5 text-xs"
                onClick={() => {
                  setEditingId(item.id);
                  setEdit(toEditForm(item));
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn-ghost px-2.5 py-1.5 text-xs text-[var(--danger)]"
                onClick={() => void remove(item.id)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {filtered.length === 0 ? (
          <li className="p-6 text-sm text-muted">No tasks match your filters.</li>
        ) : null}
      </ul>

      {edit && editingId ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/25 md:left-sidebar"
            onClick={() => {
              setEditingId(null);
              setEdit(null);
            }}
            aria-hidden
          />
          <aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-white shadow-soft"
            role="dialog"
            aria-modal="true"
            aria-label="Edit task"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-brand">Edit task</h2>
              <button
                type="button"
                className="btn-ghost px-2.5 py-1.5 text-xs"
                onClick={() => {
                  setEditingId(null);
                  setEdit(null);
                }}
              >
                Close
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              <div>
                <label className="label">Title</label>
                <input
                  className="field"
                  value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
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
                <label className="label">Category</label>
                <select
                  className="field"
                  value={edit.category}
                  onChange={(e) =>
                    setEdit({ ...edit, category: e.target.value })
                  }
                >
                  {selectOptionsWithCurrent(TASK_CATEGORIES, edit.category).map(
                    (o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div>
                <label className="label">Owner</label>
                <ContactOwnerSelect
                  value={edit.owner}
                  onChange={(owner) => setEdit({ ...edit, owner })}
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="field"
                  value={edit.status}
                  onChange={(e) =>
                    setEdit({ ...edit, status: e.target.value as TaskStatus })
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
                <label className="label">Details</label>
                <textarea
                  className="field min-h-[100px]"
                  value={edit.details}
                  onChange={(e) =>
                    setEdit({ ...edit, details: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex gap-2 border-t border-border p-4">
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
                onClick={() => {
                  setEditingId(null);
                  setEdit(null);
                }}
              >
                Cancel
              </button>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
