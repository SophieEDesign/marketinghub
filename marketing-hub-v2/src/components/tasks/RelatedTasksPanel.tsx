"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import type { HubTask, TaskRelatedType } from "@/lib/types";
import { isClosedTaskStatus } from "@/lib/data/collections";
import { cn } from "@/lib/utils";

function statusTone(status: string) {
  const s = status.trim().toLowerCase();
  if (isClosedTaskStatus(s)) {
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }
  if (
    s === "doing" ||
    s === "inprogress" ||
    s.includes("progress") ||
    s.includes("wait")
  ) {
    return "bg-sky-50 text-sky-800 border-sky-200";
  }
  return "bg-amber-50 text-amber-900 border-amber-200";
}

/**
 * Reverse lookup: tasks that link to this content / theme / partner / award / event.
 */
export function RelatedTasksPanel({
  relatedType,
  relatedId,
  className,
}: {
  relatedType: TaskRelatedType;
  relatedId: string | null | undefined;
  className?: string;
}) {
  const [tasks, setTasks] = useState<HubTask[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!relatedId) {
      setTasks([]);
      setLoaded(true);
      return;
    }
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) return;
      const data = (await res.json()) as { tasks?: HubTask[] };
      const linked = (data.tasks ?? []).filter(
        (t) =>
          (t.related_type || "") === relatedType && t.related_id === relatedId
      );
      setTasks(linked);
    } catch {
      /* keep previous */
    } finally {
      setLoaded(true);
    }
  }, [relatedType, relatedId]);

  useEffect(() => {
    setLoaded(false);
    void refresh();
  }, [refresh]);

  if (!relatedId) return null;

  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-sand/40 p-3",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Related tasks
        </h3>
        <Link
          href="/app/tasks"
          className="text-[11px] font-medium text-brand hover:underline"
        >
          Open tasks
        </Link>
      </div>

      {!loaded ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="text-xs text-muted">
          No tasks linked here yet. Link one from Tasks → Linked to.
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link
                href="/app/tasks"
                className="block rounded-lg border border-border bg-white px-3 py-2 transition hover:border-brand/30"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-medium text-foreground">
                    {task.title}
                  </p>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      statusTone(task.status)
                    )}
                  >
                    {task.status}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted">
                  {[
                    task.owner,
                    task.due_date
                      ? `Due ${format(parseISO(task.due_date), "d MMM yyyy")}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
