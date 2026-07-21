"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachMonthOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  max as maxDate,
  min as minDate,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { cn } from "@/lib/utils";

export type TimelineChartItem = {
  id: string;
  label: string;
  subtitle?: string;
  start: Date;
  end: Date;
  color: string;
};

type TimelineChartProps = {
  items: TimelineChartItem[];
  onSelect?: (id: string) => void;
  emptyMessage?: string;
  footer?: ReactNode;
  className?: string;
};

function clampPct(n: number) {
  return Math.min(100, Math.max(0, n));
}

export function TimelineChart({
  items,
  onSelect,
  emptyMessage = "Add dates to see items on the timeline.",
  footer,
  className,
}: TimelineChartProps) {
  const chart = useMemo(() => {
    if (items.length === 0) {
      const today = startOfDay(new Date());
      return {
        rows: [] as Array<
          TimelineChartItem & { left: number; width: number }
        >,
        rangeStart: startOfMonth(today),
        rangeEnd: endOfMonth(addMonths(today, 2)),
        days: 90,
        months: [] as Date[],
        todayPct: null as number | null,
      };
    }

    const starts = items.map((i) => i.start);
    const ends = items.map((i) => i.end);
    const rangeStart = startOfMonth(minDate(starts));
    const rangeEnd = endOfMonth(addMonths(maxDate(ends), 0));
    const days = Math.max(
      14,
      differenceInCalendarDays(rangeEnd, rangeStart) || 14
    );

    const months = eachMonthOfInterval({ start: rangeStart, end: rangeEnd });
    const today = startOfDay(new Date());
    const todayOffset = differenceInCalendarDays(today, rangeStart);
    const todayPct =
      todayOffset >= 0 && todayOffset <= days
        ? (todayOffset / days) * 100
        : null;

    const rows = items
      .slice()
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map((item) => {
        const start = item.start.getTime() <= item.end.getTime()
          ? item.start
          : item.end;
        const end = item.end.getTime() >= item.start.getTime()
          ? item.end
          : item.start;
        const left =
          (differenceInCalendarDays(start, rangeStart) / days) * 100;
        const spanDays = Math.max(
          1,
          differenceInCalendarDays(end, start) + 1
        );
        const width = Math.max(1.2, (spanDays / days) * 100);
        return { ...item, left, width, start, end };
      });

    return { rows, rangeStart, rangeEnd, days, months, todayPct };
  }, [items]);

  if (items.length === 0) {
    return (
      <div className={cn("surface-card p-4 md:p-6", className)}>
        <p className="text-sm text-muted">{emptyMessage}</p>
        {footer}
      </div>
    );
  }

  return (
    <div className={cn("surface-card overflow-hidden p-4", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">Click a bar to open.</p>
        <p className="text-xs text-muted">
          {format(chart.rangeStart, "MMM yyyy")} –{" "}
          {format(chart.rangeEnd, "MMM yyyy")}
        </p>
      </div>

      <div className="w-full min-w-0">
        {/* Month header */}
        <div className="mb-1 grid grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)] gap-2 sm:grid-cols-[minmax(0,8rem)_minmax(0,1fr)] sm:gap-3 md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
          <div />
          <div className="relative h-8 min-w-0 border-b border-border">
            {chart.months.map((month) => {
              const left =
                (differenceInCalendarDays(month, chart.rangeStart) /
                  chart.days) *
                100;
              const monthEnd = endOfMonth(month);
              const width =
                ((differenceInCalendarDays(monthEnd, month) + 1) /
                  chart.days) *
                100;
              const isCurrent = isSameMonth(month, new Date());
              return (
                <div
                  key={month.toISOString()}
                  className={cn(
                    "absolute bottom-0 top-0 flex items-end border-l border-border/70 px-0.5 pb-1 text-[9px] font-semibold uppercase tracking-wide sm:px-1.5 sm:text-[10px]",
                    isCurrent ? "bg-brand/10 text-brand" : "text-muted"
                  )}
                  style={{
                    left: `${clampPct(left)}%`,
                    width: `${Math.max(0.5, width)}%`,
                  }}
                >
                  <span className="truncate">
                    {format(
                      month,
                      chart.months.length > 6 ? "MMM" : "MMM yyyy"
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rows */}
        <div className="space-y-1.5">
          {chart.rows.map((row) => {
            const labelFits = row.width >= 14;
            const barWidth = Math.min(100 - clampPct(row.left), row.width);
            return (
              <div
                key={row.id}
                className="grid grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[minmax(0,8rem)_minmax(0,1fr)] sm:gap-3 md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]"
              >
                <button
                  type="button"
                  className="min-w-0 truncate text-left text-xs font-medium hover:text-brand sm:text-sm"
                  onClick={() => onSelect?.(row.id)}
                  title={row.label}
                >
                  {row.label}
                  {row.subtitle ? (
                    <span className="mt-0.5 block truncate text-[10px] font-normal text-muted sm:text-[11px]">
                      {row.subtitle}
                    </span>
                  ) : null}
                </button>

                <div className="relative h-9 min-w-0 overflow-hidden rounded-lg bg-sand/70">
                  {chart.months.map((month) => {
                    const left =
                      (differenceInCalendarDays(month, chart.rangeStart) /
                        chart.days) *
                      100;
                    return (
                      <span
                        key={`${row.id}-${month.toISOString()}`}
                        className="absolute bottom-0 top-0 w-px bg-border/60"
                        style={{ left: `${clampPct(left)}%` }}
                        aria-hidden
                      />
                    );
                  })}

                  {chart.todayPct != null ? (
                    <span
                      className="absolute bottom-0 top-0 z-10 w-0.5 bg-rose-500"
                      style={{ left: `${chart.todayPct}%` }}
                      aria-hidden
                    />
                  ) : null}

                  <button
                    type="button"
                    className={cn(
                      "absolute top-1.5 z-[1] h-6 max-w-full rounded-md text-left text-[11px] font-medium text-white shadow-sm transition hover:opacity-90",
                      labelFits ? "px-2" : "px-0"
                    )}
                    style={{
                      left: `${clampPct(row.left)}%`,
                      width: `${barWidth}%`,
                      background: row.color,
                    }}
                    onClick={() => onSelect?.(row.id)}
                    title={`${row.label} · ${format(row.start, "d MMM")} – ${format(row.end, "d MMM yyyy")}`}
                  >
                    {labelFits ? (
                      <span className="block truncate">{row.label}</span>
                    ) : null}
                  </button>

                  {!labelFits ? (
                    <button
                      type="button"
                      className="absolute top-1.5 z-[1] max-w-[35%] truncate pl-1 text-left text-[11px] font-medium text-foreground hover:text-brand"
                      style={{
                        left: `${clampPct(row.left + row.width)}%`,
                      }}
                      onClick={() => onSelect?.(row.id)}
                      title={row.label}
                    >
                      {row.label}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {footer}
    </div>
  );
}

/** Build a short bar around a single date (e.g. due date only). */
export function pointRange(date: Date, padDays = 3): { start: Date; end: Date } {
  return {
    start: addDays(date, -padDays),
    end: addDays(date, padDays),
  };
}
