"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Pencil } from "lucide-react";
import { useHubView } from "@/lib/hub-view";
import {
  cloneMonthlyPlan,
  DEFAULT_SOCIAL_MONTHLY_PLAN,
  parseMonthlyPlan,
  SOCIAL_MONTHLY_PLAN_KEY,
  WEEK_LABELS,
  type SocialMonthlyPlanMatrix,
} from "@/lib/social/monthly-plan";
import { cn } from "@/lib/utils";

function PlanMatrixTable({
  plan,
  editing,
  onChange,
}: {
  plan: SocialMonthlyPlanMatrix;
  editing: boolean;
  onChange?: (next: SocialMonthlyPlanMatrix) => void;
}) {
  const updateCell = (
    rowIndex: number,
    weekIndex: 0 | 1 | 2 | 3,
    value: string
  ) => {
    if (!onChange) return;
    const next = cloneMonthlyPlan(plan);
    next.rows[rowIndex].weeks[weekIndex] = value;
    onChange(next);
  };

  const updateTheme = (rowIndex: number, value: string) => {
    if (!onChange) return;
    const next = cloneMonthlyPlan(plan);
    next.rows[rowIndex].theme = value;
    onChange(next);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-border bg-slate-50/80">
            <th className="sticky left-0 z-10 bg-slate-50/95 px-2.5 py-2 font-semibold text-brand">
              Day
            </th>
            {WEEK_LABELS.map((label) => (
              <th
                key={label}
                className="px-2.5 py-2 font-semibold text-muted-foreground"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plan.rows.map((row, rowIndex) => (
            <tr
              key={`${row.day}-${rowIndex}`}
              className="border-b border-border/70 last:border-b-0"
            >
              <th className="sticky left-0 z-10 w-[9.5rem] bg-white px-2.5 py-2 align-top font-normal">
                <div className="font-semibold text-brand">{row.day}</div>
                {editing ? (
                  <input
                    type="text"
                    value={row.theme}
                    onChange={(e) => updateTheme(rowIndex, e.target.value)}
                    className="mt-1 w-full rounded border border-border bg-white px-1.5 py-1 text-[11px] text-muted-foreground"
                    aria-label={`${row.day} theme`}
                  />
                ) : (
                  <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {row.theme}
                  </div>
                )}
              </th>
              {row.weeks.map((cell, weekIndex) => (
                <td
                  key={weekIndex}
                  className="px-2 py-2 align-top text-[12px] leading-snug text-foreground/90"
                >
                  {editing ? (
                    <textarea
                      value={cell}
                      onChange={(e) =>
                        updateCell(
                          rowIndex,
                          weekIndex as 0 | 1 | 2 | 3,
                          e.target.value
                        )
                      }
                      rows={3}
                      className="w-full resize-y rounded border border-border bg-white px-1.5 py-1 text-[11px] leading-snug"
                      aria-label={`${row.day} ${WEEK_LABELS[weekIndex]}`}
                    />
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SocialMonthlyPlan() {
  const { view } = useHubView();
  const canEdit = view === "admin";

  const [open, setOpen] = useState(true);
  const [plan, setPlan] = useState(DEFAULT_SOCIAL_MONTHLY_PLAN);
  const [draft, setDraft] = useState(DEFAULT_SOCIAL_MONTHLY_PLAN);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/page-notes?key=${encodeURIComponent(SOCIAL_MONTHLY_PLAN_KEY)}`
        );
        if (!res.ok) throw new Error("Failed to load plan");
        const data = (await res.json()) as {
          body?: string;
          plan?: SocialMonthlyPlanMatrix;
        };
        if (cancelled) return;
        const next = data.plan ?? parseMonthlyPlan(data.body);
        setPlan(next);
        setDraft(cloneMonthlyPlan(next));
      } catch {
        if (!cancelled) {
          setPlan(DEFAULT_SOCIAL_MONTHLY_PLAN);
          setDraft(cloneMonthlyPlan(DEFAULT_SOCIAL_MONTHLY_PLAN));
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
    setDraft(cloneMonthlyPlan(plan));
    setError(null);
    setEditing(true);
    setOpen(true);
  }, [plan]);

  const cancelEdit = useCallback(() => {
    setDraft(cloneMonthlyPlan(plan));
    setError(null);
    setEditing(false);
  }, [plan]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/page-notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: SOCIAL_MONTHLY_PLAN_KEY,
          plan: draft,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || "Failed to save");
      }
      const data = (await res.json()) as { plan?: SocialMonthlyPlanMatrix };
      const next = data.plan ?? draft;
      setPlan(next);
      setDraft(cloneMonthlyPlan(next));
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
          <span className="font-display text-sm text-brand">
            Monthly posting plan
          </span>
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
              <PlanMatrixTable
                plan={editing ? draft : plan}
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
