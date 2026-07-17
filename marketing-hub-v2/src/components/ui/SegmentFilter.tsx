"use client";

import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = {
  id: T;
  label: string;
};

export function SegmentFilter<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "lg",
}: {
  value: T;
  onChange: (next: T) => void;
  options: SegmentOption<T>[];
  label: string;
  size?: "md" | "lg";
}) {
  return (
    <div
      className={cn(
        "mb-6 inline-flex w-full max-w-xl flex-wrap gap-1 rounded-2xl border border-border bg-white p-1.5 shadow-sm",
        size === "lg" && "sm:max-w-2xl"
      )}
      role="tablist"
      aria-label={label}
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={value === opt.id}
          onClick={() => onChange(opt.id)}
          className={cn(
            "flex-1 rounded-xl font-semibold transition",
            size === "lg" ? "px-4 py-3 text-base" : "px-3 py-2 text-sm",
            value === opt.id
              ? "bg-brand text-white shadow-sm"
              : "text-muted hover:bg-sand hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
