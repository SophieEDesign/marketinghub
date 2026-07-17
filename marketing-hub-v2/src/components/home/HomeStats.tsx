"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useHubView } from "@/lib/hub-view";

type Stats = {
  upcomingCount: number;
  inFlight: number;
  activeSponsors: number;
  openTaskCount: number;
};

type OpenTask = {
  id: string;
  title: string;
  owner: string;
  due_date: string | null;
};

export function HomeStats({
  stats,
  openTasks,
}: {
  stats: Stats;
  openTasks: OpenTask[];
}) {
  const { view } = useHubView();
  const isAdmin = view === "admin";

  return (
    <>
      <div
        className={`mb-8 grid gap-4 sm:grid-cols-2 ${
          isAdmin ? "lg:grid-cols-4" : "lg:grid-cols-2"
        }`}
      >
        <div className="surface-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Upcoming events
          </p>
          <p className="mt-2 font-display text-3xl text-brand">
            {stats.upcomingCount}
          </p>
        </div>
        {isAdmin ? (
          <div className="surface-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Content in flight
            </p>
            <p className="mt-2 font-display text-3xl text-brand">
              {stats.inFlight}
            </p>
          </div>
        ) : null}
        <div className="surface-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Active partners
          </p>
          <p className="mt-2 font-display text-3xl text-brand">
            {stats.activeSponsors}
          </p>
        </div>
        {isAdmin ? (
          <div className="surface-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Open tasks
            </p>
            <p className="mt-2 font-display text-3xl text-brand">
              {stats.openTaskCount}
            </p>
          </div>
        ) : null}
      </div>

      {isAdmin && openTasks.length > 0 ? (
        <div className="surface-card mb-8 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl text-brand">Open tasks</h2>
            <Link href="/app/tasks" className="btn-secondary shrink-0 text-xs">
              All tasks
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-border">
            {openTasks.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <span className="font-medium">{t.title}</span>
                <span className="text-xs text-muted">
                  {[
                    t.owner,
                    t.due_date
                      ? format(new Date(t.due_date), "d MMM yyyy")
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
