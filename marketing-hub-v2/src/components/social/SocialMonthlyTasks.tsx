"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useHubView } from "@/lib/hub-view";
import {
  cloneMonthlyTasks,
  DEFAULT_SOCIAL_MONTHLY_TASKS,
  mergeMonthlyTasksWithDefaults,
  parseMonthlyTasks,
  SOCIAL_MONTHLY_TASKS_KEY,
  type SocialMonthlyTasksList,
} from "@/lib/social/monthly-tasks";
import { cn } from "@/lib/utils";

function TasksList({
  list,
  editing,
  onChange,
}: {
  list: SocialMonthlyTasksList;
  editing: boolean;
  onChange?: (next: SocialMonthlyTasksList) => void;
}) {
  const updateLabel = (index: number, value: string) => {
    if (!onChange) return;
    const next = cloneMonthlyTasks(list);
    next.items[index].label = value;
    onChange(next);
  };

  const updateNotes = (index: number, value: string) => {
    if (!onChange) return;
    const next = cloneMonthlyTasks(list);
    next.items[index].notes = value || undefined;
    onChange(next);
  };

  const removeItem = (index: number) => {
    if (!onChange || list.items.length <= 1) return;
    const next = cloneMonthlyTasks(list);
    next.items.splice(index, 1);
    onChange(next);
  };

  const addItem = () => {
    if (!onChange) return;
    const next = cloneMonthlyTasks(list);
    next.items.push({ label: "" });
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {list.items.map((item, index) => (
          <li
            key={`${item.label}-${index}`}
            className="rounded-lg border border-border/80 bg-white px-3 py-2.5"
          >
            {editing ? (
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => updateLabel(index, e.target.value)}
                    placeholder="Task name"
                    className="min-w-0 flex-1 rounded border border-border bg-white px-2 py-1.5 text-sm"
                    aria-label={`Task ${index + 1} name`}
                  />
                  <button
                    type="button"
                    className="btn-ghost shrink-0 p-1.5 text-muted hover:text-red-600"
                    onClick={() => removeItem(index)}
                    disabled={list.items.length <= 1}
                    aria-label={`Remove task ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <textarea
                  value={item.notes ?? ""}
                  onChange={(e) => updateNotes(index, e.target.value)}
                  placeholder="Optional notes (links, tools, deadline hint…)"
                  rows={2}
                  className="w-full resize-y rounded border border-border bg-white px-2 py-1.5 text-xs leading-snug text-muted-foreground"
                  aria-label={`Task ${index + 1} notes`}
                />
              </div>
            ) : (
              <div>
                <div className="text-sm font-medium text-brand">{item.label}</div>
                {item.notes?.trim() ? (
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">
                    {item.notes}
                  </p>
                ) : null}
              </div>
            )}
          </li>
        ))}
      </ul>
      {editing ? (
        <button
          type="button"
          className="btn-ghost inline-flex items-center gap-1.5 px-2 py-1.5 text-xs"
          onClick={addItem}
        >
          <Plus className="h-3.5 w-3.5" />
          Add task
        </button>
      ) : null}
    </div>
  );
}

export function SocialMonthlyTasks() {
  const { view } = useHubView();
  const canEdit = view === "admin";

  const [open, setOpen] = useState(true);
  const [list, setList] = useState(DEFAULT_SOCIAL_MONTHLY_TASKS);
  const [draft, setDraft] = useState(DEFAULT_SOCIAL_MONTHLY_TASKS);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/page-notes?key=${encodeURIComponent(SOCIAL_MONTHLY_TASKS_KEY)}`
        );
        if (!res.ok) throw new Error("Failed to load tasks");
        const data = (await res.json()) as {
          body?: string;
          tasks?: SocialMonthlyTasksList;
        };
        if (cancelled) return;
        const parsed = data.tasks ?? parseMonthlyTasks(data.body);
        const next = mergeMonthlyTasksWithDefaults(parsed);
        setList(next);
        setDraft(cloneMonthlyTasks(next));
      } catch {
        if (!cancelled) {
          setList(DEFAULT_SOCIAL_MONTHLY_TASKS);
          setDraft(cloneMonthlyTasks(DEFAULT_SOCIAL_MONTHLY_TASKS));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startEdit = useCallback(() => {
    setDraft(cloneMonthlyTasks(list));
    setError(null);
    setEditing(true);
    setOpen(true);
  }, [list]);

  const cancelEdit = useCallback(() => {
    setDraft(cloneMonthlyTasks(list));
    setError(null);
    setEditing(false);
  }, [list]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/page-notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: SOCIAL_MONTHLY_TASKS_KEY,
          tasks: draft,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || "Failed to save");
      }
      const data = (await res.json()) as { tasks?: SocialMonthlyTasksList };
      const next = data.tasks ?? draft;
      setList(next);
      setDraft(cloneMonthlyTasks(next));
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [draft]);

  return (
    <div className="surface-card mb-5 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted transition-transform",
              !open && "-rotate-90"
            )}
          />
          <span className="font-display text-sm text-brand">Monthly tasks</span>
          <span className="text-xs text-muted">Reference</span>
        </button>
        {canEdit && !editing ? (
          <button
            type="button"
            className="btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
            onClick={startEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="px-3 py-3 sm:px-4">
          {loading ? (
            <p className="px-1 text-sm text-muted">Loading…</p>
          ) : (
            <div className="space-y-3">
              <p className="px-1 text-xs text-muted-foreground">
                Recurring end-of-month reporting and admin checklist.
              </p>
              <TasksList
                list={editing ? draft : list}
                editing={editing}
                onChange={editing ? setDraft : undefined}
              />
              {editing ? (
                <>
                  {error ? (
                    <p className="text-sm text-red-600">{error}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={save}
                      disabled={saving}
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={cancelEdit}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
