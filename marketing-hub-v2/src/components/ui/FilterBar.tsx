"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterSelect = {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  /** Value treated as inactive / used by Clear. Defaults to "all". */
  clearValue?: string;
};

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  selects = [],
  resultCount,
  totalCount,
  className,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  selects?: FilterSelect[];
  resultCount?: number;
  totalCount?: number;
  className?: string;
}) {
  const hasActive =
    search.trim().length > 0 ||
    selects.some((s) => s.value !== (s.clearValue ?? "all"));

  function clearAll() {
    onSearchChange("");
    selects.forEach((s) => s.onChange(s.clearValue ?? "all"));
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

      {selects.map((select) => (
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
      ))}

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
