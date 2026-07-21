"use client";

import { useMemo } from "react";
import type { WebEnquiry } from "@/lib/types";
import {
  computeEnquiryYearCompare,
  ENQUIRY_MONTH_LABELS,
  formatEnquiryDelta,
  formatEnquiryPct,
} from "@/lib/data/web-enquiries-stats";
import { cn } from "@/lib/utils";

/** Distinct year colours — brand-adjacent, readable on white. */
const YEAR_COLORS = [
  "#2563eb", // blue
  "#c2410c", // copper
  "#7c3aed", // violet
  "#0f7a4c", // success green
  "#0e7490", // teal
  "#a16207", // ochre
];

function yearColor(year: number, years: number[]): string {
  const i = years.indexOf(year);
  return YEAR_COLORS[i % YEAR_COLORS.length] ?? YEAR_COLORS[0];
}

function ChangePill({
  delta,
  pct,
}: {
  delta: number | null;
  pct: number | null;
}) {
  if (delta == null && pct == null) {
    return (
      <>
        <td className="px-3 py-2.5 text-right tabular-nums text-muted/50">—</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-muted/50">—</td>
      </>
    );
  }

  const up = (delta ?? 0) > 0;
  const down = (delta ?? 0) < 0;
  const tone = up
    ? "text-[var(--success)]"
    : down
      ? "text-muted"
      : "text-foreground";

  return (
    <>
      <td className={cn("px-3 py-2.5 text-right tabular-nums font-medium", tone)}>
        {formatEnquiryDelta(delta)}
      </td>
      <td className={cn("px-3 py-2.5 text-right tabular-nums text-sm", tone)}>
        {formatEnquiryPct(pct)}
      </td>
    </>
  );
}

export function EnquiryYearCompare({
  items,
  includeTest,
}: {
  items: WebEnquiry[];
  includeTest?: boolean;
}) {
  const data = useMemo(
    () => computeEnquiryYearCompare(items, { includeTest }),
    [items, includeTest]
  );

  if (data.years.length === 0) return null;

  const compareYi =
    data.compareYear != null ? data.years.indexOf(data.compareYear) : -1;
  const priorYi =
    data.priorYear != null ? data.years.indexOf(data.priorYear) : -1;
  const ytdSet = new Set(data.ytdMonthIndexes);
  const ytdLabel =
    data.ytdMonthIndexes.length > 0
      ? `YTD (${ENQUIRY_MONTH_LABELS[0]}–${ENQUIRY_MONTH_LABELS[data.ytdMonthIndexes.at(-1)!]})`
      : "YTD";

  return (
    <div className="surface-card mb-6 overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-sand/30 px-5 py-4">
        <div>
          <h2 className="font-display text-lg text-brand">Year comparison</h2>
          <p className="mt-0.5 text-sm text-muted">
            Monthly enquiry counts
            {data.compareYear != null && data.priorYear != null
              ? ` · Δ / % vs ${data.priorYear}`
              : null}
          </p>
        </div>
        <ul className="flex flex-wrap gap-3">
          {data.years.map((y) => (
            <li
              key={y}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: yearColor(y, data.years) }}
                aria-hidden
              />
              {y}
              {y === data.compareYear ? (
                <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                  Current
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="sticky left-0 z-10 bg-white px-5 py-3 font-semibold">
                Month
              </th>
              {data.years.map((y) => (
                <th
                  key={y}
                  className={cn(
                    "px-3 py-3 text-right font-semibold tabular-nums",
                    y === data.compareYear && "bg-accent-soft/40"
                  )}
                  style={{ color: yearColor(y, data.years) }}
                >
                  {y}
                </th>
              ))}
              <th className="px-3 py-3 text-right font-semibold">Δ</th>
              <th className="px-3 py-3 text-right font-semibold">%</th>
            </tr>
          </thead>
          <tbody>
            {ENQUIRY_MONTH_LABELS.map((label, month) => {
              const inYtd = ytdSet.has(month);
              const cur =
                compareYi >= 0 ? data.months[month]?.[compareYi] ?? 0 : null;
              const prior =
                priorYi >= 0 ? data.months[month]?.[priorYi] ?? 0 : null;
              const showChange = inYtd && cur != null && prior != null;
              const delta = showChange ? cur - prior : null;
              const pct =
                showChange && prior !== 0
                  ? ((cur - prior) / prior) * 100
                  : showChange && prior === 0
                    ? cur === 0
                      ? 0
                      : null
                    : null;

              return (
                <tr
                  key={label}
                  className={cn(
                    "border-b border-border/70 transition-colors last:border-b-0 hover:bg-sand/40",
                    !inYtd && "opacity-60"
                  )}
                >
                  <th className="sticky left-0 z-10 bg-white px-5 py-2.5 text-left font-medium text-foreground">
                    {label}
                  </th>
                  {data.years.map((y, yi) => {
                    const value = data.months[month]?.[yi] ?? 0;
                    const isFutureCompare =
                      y === data.compareYear && !inYtd;
                    return (
                      <td
                        key={y}
                        className={cn(
                          "px-3 py-2.5 text-right tabular-nums font-medium",
                          y === data.compareYear && "bg-accent-soft/25"
                        )}
                        style={{
                          color: isFutureCompare
                            ? undefined
                            : yearColor(y, data.years),
                        }}
                      >
                        {isFutureCompare ? (
                          <span className="text-muted/50">—</span>
                        ) : (
                          value
                        )}
                      </td>
                    );
                  })}
                  <ChangePill delta={delta} pct={pct} />
                </tr>
              );
            })}
          </tbody>
          {data.ytdMonthIndexes.length > 0 ? (
            <tfoot>
              <tr className="border-t-2 border-border bg-sand/50">
                <th className="sticky left-0 z-10 bg-sand/50 px-5 py-3.5 text-left font-semibold text-brand">
                  {ytdLabel}
                </th>
                {data.years.map((y) => (
                  <td
                    key={y}
                    className={cn(
                      "px-3 py-3.5 text-right font-display text-base tabular-nums font-semibold",
                      y === data.compareYear && "bg-accent-soft/40"
                    )}
                    style={{ color: yearColor(y, data.years) }}
                  >
                    {data.ytdTotals[y] ?? 0}
                  </td>
                ))}
                <ChangePill delta={data.ytdDelta} pct={data.ytdPct} />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}
