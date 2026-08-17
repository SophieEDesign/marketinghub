"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Lock } from "lucide-react";
import type {
  BudgetAmount,
  BudgetLine,
  MarketingBudget,
} from "@/lib/budget/2026";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils";

function gbp(value: BudgetAmount) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function varianceLabel(value: BudgetAmount) {
  if (value == null) return "—";
  if (value === 0) return "In line";
  if (value > 0) return `${gbp(value)} less`;
  return `${gbp(Math.abs(value))} more`;
}

function varianceClass(value: BudgetAmount) {
  if (value == null || value === 0) return "text-muted";
  if (value > 0) return "text-emerald-700";
  return "text-amber-800";
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "breakdowns", label: "Breakdowns" },
  { id: "notes", label: "Notes" },
  { id: "quarters", label: "Quarters" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="surface-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl text-brand">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function BudgetTable({
  title,
  lines,
  total,
  priorYearTotal,
}: {
  title: string;
  lines: BudgetLine[];
  total: number;
  priorYearTotal?: number;
}) {
  const [openIds, setOpenIds] = useState<string[]>([]);

  return (
    <div className="surface-card overflow-hidden">
      <div className="border-b border-border bg-accent-soft/40 px-5 py-3">
        <h2 className="font-display text-xl text-brand">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-sand/50 text-left text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-2.5 font-medium">Line</th>
              <th className="px-3 py-2.5 font-medium">Code</th>
              <th className="px-3 py-2.5 text-right font-medium">Marketing</th>
              <th className="px-3 py-2.5 text-right font-medium">
                Sponsorship
              </th>
              <th className="px-3 py-2.5 text-right font-medium">T&amp;E</th>
              <th className="px-3 py-2.5 text-right font-medium">Total</th>
              <th className="px-3 py-2.5 text-right font-medium">2025</th>
              <th className="px-5 py-2.5 text-right font-medium">vs 2025</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.map((line) => {
              const expandable = Boolean(line.children?.length);
              const open = openIds.includes(line.id);
              return (
                <tr key={line.id} className="align-top">
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      className={cn(
                        "flex items-start gap-2 text-left",
                        expandable
                          ? "hover:text-brand"
                          : "cursor-default"
                      )}
                      onClick={() => {
                        if (!expandable) return;
                        setOpenIds((ids) =>
                          ids.includes(line.id)
                            ? ids.filter((id) => id !== line.id)
                            : [...ids, line.id]
                        );
                      }}
                      disabled={!expandable}
                    >
                      {expandable ? (
                        open ? (
                          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />
                        )
                      ) : (
                        <span className="mt-0.5 w-4 shrink-0" />
                      )}
                      <span>
                        <span className="font-medium">{line.name}</span>
                        {line.notes ? (
                          <span className="mt-1 block text-xs text-muted">
                            {line.notes}
                          </span>
                        ) : null}
                        {open && line.children ? (
                          <ul className="mt-2 space-y-1 text-xs text-muted">
                            {line.children.map((child) => (
                              <li
                                key={child.name}
                                className="flex justify-between gap-4"
                              >
                                <span>
                                  {child.name}
                                  {child.note ? ` — ${child.note}` : ""}
                                </span>
                                <span className="shrink-0 tabular-nums">
                                  {gbp(child.amount)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-3 text-muted">{line.code || "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {gbp(line.marketing)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {gbp(line.sponsorship)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {gbp(line.travel)}
                  </td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums">
                    {gbp(line.total)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-muted">
                    {gbp(line.priorYear)}
                  </td>
                  <td
                    className={cn(
                      "px-5 py-3 text-right tabular-nums",
                      varianceClass(line.variance)
                    )}
                  >
                    {varianceLabel(line.variance)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-sand/60 font-medium">
              <td className="px-5 py-3" colSpan={5}>
                {title} total
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {gbp(total)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-muted">
                {priorYearTotal != null ? gbp(priorYearTotal) : "—"}
              </td>
              <td className="px-5 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export function BudgetClient({ data }: { data: MarketingBudget }) {
  const [tab, setTab] = useState<TabId>("overview");
  const [quarterId, setQuarterId] = useState<(typeof data.quarters)[number]["id"]>(
    "Q1"
  );

  const extraSpend = Math.abs(Math.min(data.variance, 0));
  const quarter = useMemo(
    () => data.quarters.find((item) => item.id === quarterId) ?? data.quarters[0],
    [data.quarters, quarterId]
  );

  return (
    <div>
      <PageHeader
        title={data.title}
        description={`Draft figures from ${data.source}. Amounts are GBP.`}
      />

      <p className="mb-6 inline-flex items-center gap-2 rounded-xl border border-border bg-sand/70 px-3 py-2 text-xs text-muted">
        <Lock className="h-3.5 w-3.5" />
        Restricted to Hub admins, plus Simon, Tom, and Michael.
      </p>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="2026 total"
          value={gbp(data.grandTotal)}
          hint={`${gbp(extraSpend)} more than 2025`}
        />
        <SummaryCard
          label="Committed"
          value={gbp(data.committedTotal)}
          hint="Contracts and ongoing providers"
        />
        <SummaryCard
          label="Uncommitted"
          value={gbp(data.uncommittedTotal)}
          hint="Shows, travel, merch, and reserve"
        />
        <SummaryCard
          label="2025 total"
          value={gbp(data.priorYearTotal)}
          hint={varianceLabel(data.variance)}
        />
      </div>

      <div className="mb-6 inline-flex rounded-xl border border-border bg-sand/60 p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              tab === item.id
                ? "bg-white text-brand shadow-sm"
                : "text-muted hover:text-foreground"
            )}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="space-y-6">
          <BudgetTable
            title="Committed"
            lines={data.committed}
            total={data.committedTotal}
            priorYearTotal={data.committedPriorYearTotal}
          />
          <BudgetTable
            title="Uncommitted"
            lines={data.uncommitted}
            total={data.uncommittedTotal}
            priorYearTotal={data.uncommittedPriorYearTotal}
          />
        </div>
      ) : null}

      {tab === "breakdowns" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.uncommitted
            .concat(data.committed.filter((line) => line.children?.length))
            .filter((line) => line.children?.length)
            .map((line) => (
              <div key={line.id} className="surface-card overflow-hidden">
                <div className="border-b border-border bg-accent-soft/40 px-5 py-3">
                  <h2 className="font-display text-lg text-brand">
                    {line.name}
                  </h2>
                  <p className="text-xs text-muted">
                    {line.code ? `${line.code} · ` : ""}
                    {gbp(line.total)}
                  </p>
                </div>
                <ul className="divide-y divide-border">
                  {line.children?.map((child) => (
                    <li
                      key={child.name}
                      className="flex items-start justify-between gap-4 px-5 py-3 text-sm"
                    >
                      <span>
                        {child.name}
                        {child.note ? (
                          <span className="mt-1 block text-xs text-muted">
                            {child.note}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {gbp(child.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      ) : null}

      {tab === "notes" ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {data.notes.map((note) => (
              <div key={note.title} className="surface-card p-5">
                <h2 className="font-display text-lg text-brand">{note.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {note.body}
                </p>
              </div>
            ))}
          </div>
          <div className="surface-card overflow-hidden">
            <div className="border-b border-border bg-accent-soft/40 px-5 py-3">
              <h2 className="font-display text-lg text-brand">
                Additional events
              </h2>
            </div>
            <ul className="divide-y divide-border">
              {data.extraEvents.map((event) => (
                <li key={event.name} className="px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-medium">{event.name}</h3>
                    <span className="text-xs text-muted">{event.when}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{event.detail}</p>
                  {event.people ? (
                    <p className="mt-1 text-xs text-muted">{event.people}</p>
                  ) : null}
                  {event.cap ? (
                    <p className="mt-1 text-xs text-muted">{event.cap}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {tab === "quarters" ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Quarterly sheets in the draft are mostly still empty, except the
            £6,000 event reserve in each quarter.
          </p>
          <div className="inline-flex rounded-xl border border-border bg-sand/60 p-1">
            {data.quarters.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  quarterId === item.id
                    ? "bg-white text-brand shadow-sm"
                    : "text-muted hover:text-foreground"
                )}
                onClick={() => setQuarterId(item.id)}
              >
                {item.id}
              </button>
            ))}
          </div>
          <div className="surface-card overflow-hidden">
            <div className="border-b border-border bg-accent-soft/40 px-5 py-3">
              <h2 className="font-display text-lg text-brand">
                {quarter.title}
              </h2>
            </div>
            <ul className="divide-y divide-border">
              {quarter.lines.map((line, index) =>
                line.section ? (
                  <li
                    key={`${line.name}-${index}`}
                    className="bg-sand/50 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted"
                  >
                    {line.name}
                  </li>
                ) : (
                  <li
                    key={`${line.name}-${index}`}
                    className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
                  >
                    <span>
                      {line.name}
                      {line.code ? (
                        <span className="ml-2 text-xs text-muted">
                          {line.code}
                        </span>
                      ) : null}
                    </span>
                    <span className="tabular-nums text-muted">
                      {line.total != null ? gbp(line.total) : "—"}
                    </span>
                  </li>
                )
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
