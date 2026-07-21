"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useHubView } from "@/lib/hub-view";

type Stats = {
  upcomingCount: number;
  inFlight: number;
  activeSponsors: number;
  openTaskCount: number;
  newEnquiries?: number;
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

  const kpiClassName =
    "surface-card block p-5 transition hover:-translate-y-0.5 hover:border-accent";

  return (
    <>
      <div
        className={`mb-8 grid gap-4 sm:grid-cols-2 ${
          isAdmin ? "lg:grid-cols-5" : "lg:grid-cols-3"
        }`}
      >
        <Link href="/app/events" className={kpiClassName}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Upcoming events
          </p>
          <p className="mt-2 font-display text-3xl text-brand">
            {stats.upcomingCount}
          </p>
        </Link>
        {isAdmin ? (
          <Link href="/app/content" className={kpiClassName}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Content in flight
            </p>
            <p className="mt-2 font-display text-3xl text-brand">
              {stats.inFlight}
            </p>
          </Link>
        ) : null}
        <Link href="/app/partners" className={kpiClassName}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Active partners
          </p>
          <p className="mt-2 font-display text-3xl text-brand">
            {stats.activeSponsors}
          </p>
        </Link>
        <Link href="/app/enquiries" className={kpiClassName}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            New enquiries
          </p>
          <p className="mt-2 font-display text-3xl text-brand">
            {stats.newEnquiries ?? 0}
          </p>
        </Link>
        {isAdmin ? (
          <Link href="/app/tasks" className={kpiClassName}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Open tasks
            </p>
            <p className="mt-2 font-display text-3xl text-brand">
              {stats.openTaskCount}
            </p>
          </Link>
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
              <li key={t.id}>
                <Link
                  href="/app/tasks"
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm transition hover:text-brand"
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
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
