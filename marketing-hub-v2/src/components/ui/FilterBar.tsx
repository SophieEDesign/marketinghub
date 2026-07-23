"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterSelectOption = { value: string; label: string };

export type FilterSelectSingle = {
  id: string;
  label: string;
  multiple?: false;
  value: string;
  options: FilterSelectOption[];
  onChange: (value: string) => void;
  /** Value treated as inactive / used by Clear. Defaults to "all". */
  clearValue?: string;
};

export type FilterSelectMulti = {
  id: string;
  label: string;
  multiple: true;
  value: string[];
  options: FilterSelectOption[];
  onChange: (value: string[]) => void;
  /** Shown when nothing is selected (means “all”). Defaults to "All". */
  allLabel?: string;
};

export type FilterSelect = FilterSelectSingle | FilterSelectMulti;

export type FilterDateRange = {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  /** Defaults when Clear is pressed. Empty string = no bound. */
  clearFrom?: string;
  clearTo?: string;
  fromLabel?: string;
  toLabel?: string;
};

function isMulti(select: FilterSelect): select is FilterSelectMulti {
  return select.multiple === true;
}

function selectIsActive(select: FilterSelect): boolean {
  if (isMulti(select)) return select.value.length > 0;
  return select.value !== (select.clearValue ?? "all");
}

function MultiFilterSelect({ select }: { select: FilterSelectMulti }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = new Set(select.value);
  const allLabel = select.allLabel ?? "All";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle(optionValue: string) {
    if (selected.has(optionValue)) {
      select.onChange(select.value.filter((v) => v !== optionValue));
      return;
    }
    select.onChange([...select.value, optionValue]);
  }

  const summary =
    select.value.length === 0
      ? allLabel
      : select.value.length === 1
        ? (select.options.find((o) => o.value === select.value[0])?.label ??
          select.value[0])
        : `${select.value.length} selected`;

  return (
    <div ref={rootRef} className="relative min-w-[140px]">
      <label className="label" htmlFor={`filter-${select.id}`}>
        {select.label}
      </label>
      <button
        id={`filter-${select.id}`}
        type="button"
        className={cn(
          "field flex w-full items-center justify-between gap-2 text-left",
          open && "border-brand/50 ring-2 ring-brand/15"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={cn(
            "truncate",
            select.value.length === 0 ? "text-muted" : "text-foreground"
          )}
        >
          {summary}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted transition",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-white p-1 shadow-lg"
        >
          <button
            type="button"
            role="option"
            aria-selected={select.value.length === 0}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition",
              select.value.length === 0
                ? "bg-brand/10 text-foreground"
                : "text-muted hover:bg-sand hover:text-foreground"
            )}
            onClick={() => select.onChange([])}
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                select.value.length === 0
                  ? "border-brand bg-brand text-white"
                  : "border-border bg-white"
              )}
            >
              {select.value.length === 0 ? (
                <Check className="h-3 w-3" strokeWidth={3} />
              ) : null}
            </span>
            {allLabel}
          </button>
          {select.options.map((opt) => {
            const checked = selected.has(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={checked}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition",
                  checked
                    ? "bg-brand/10 text-foreground"
                    : "text-muted hover:bg-sand hover:text-foreground"
                )}
                onClick={() => toggle(opt.value)}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    checked
                      ? "border-brand bg-brand text-white"
                      : "border-border bg-white"
                  )}
                >
                  {checked ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : null}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  selects = [],
  dateRange,
  resultCount,
  totalCount,
  className,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  selects?: FilterSelect[];
  dateRange?: FilterDateRange;
  resultCount?: number;
  totalCount?: number;
  className?: string;
}) {
  const rangeClearFrom = dateRange?.clearFrom ?? "";
  const rangeClearTo = dateRange?.clearTo ?? "";
  const rangeActive = Boolean(
    dateRange &&
      (dateRange.from !== rangeClearFrom || dateRange.to !== rangeClearTo)
  );

  const hasActive =
    search.trim().length > 0 ||
    selects.some(selectIsActive) ||
    rangeActive;

  function clearAll() {
    onSearchChange("");
    selects.forEach((s) => {
      if (isMulti(s)) s.onChange([]);
      else s.onChange(s.clearValue ?? "all");
    });
    if (dateRange) {
      dateRange.onFromChange(rangeClearFrom);
      dateRange.onToChange(rangeClearTo);
    }
  }

  return (
    <div
      className={cn(
        "surface-card mb-5 flex flex-wrap items-end gap-3 p-3",
        className
      )}
    >
      <div className="min-w-[200px] flex-1">
        <label className="label" htmlFor="filter-search">
          Search
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            id="filter-search"
            className="field pl-9"
            value={search}
            placeholder={searchPlaceholder}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {dateRange ? (
        <>
          <div className="min-w-[140px]">
            <label className="label" htmlFor="filter-date-from">
              {dateRange.fromLabel ?? "From"}
            </label>
            <input
              id="filter-date-from"
              type="date"
              className="field"
              value={dateRange.from}
              max={dateRange.to || undefined}
              onChange={(e) => dateRange.onFromChange(e.target.value)}
            />
          </div>
          <div className="min-w-[140px]">
            <label className="label" htmlFor="filter-date-to">
              {dateRange.toLabel ?? "To"}
            </label>
            <input
              id="filter-date-to"
              type="date"
              className="field"
              value={dateRange.to}
              min={dateRange.from || undefined}
              onChange={(e) => dateRange.onToChange(e.target.value)}
            />
          </div>
        </>
      ) : null}

      {selects.map((select) =>
        isMulti(select) ? (
          <MultiFilterSelect key={select.id} select={select} />
        ) : (
          <div key={select.id} className="min-w-[140px]">
            <label className="label" htmlFor={`filter-${select.id}`}>
              {select.label}
            </label>
            <select
              id={`filter-${select.id}`}
              className="field"
              value={select.value}
              onChange={(e) => select.onChange(e.target.value)}
            >
              {select.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )
      )}

      <div className="flex items-center gap-2 pb-0.5">
        {typeof resultCount === "number" && typeof totalCount === "number" ? (
          <span className="text-xs text-muted">
            {resultCount === totalCount
              ? `${totalCount} items`
              : `${resultCount} of ${totalCount}`}
          </span>
        ) : null}
        {hasActive ? (
          <button
            type="button"
            className="btn-ghost px-2.5 py-2 text-xs"
            onClick={clearAll}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Case-insensitive match across string fields. */
export function matchesSearch(
  query: string,
  fields: Array<string | null | undefined>
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}
